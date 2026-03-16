import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { readVersions, getMetadata, getCachePath } from './cache';
import { inlineStyles, inlineScripts } from './htmlBundler';
import {
  findManifests, findResourceFiles, findExampleFile,
  countRemainingTasks, findNextPlanTask,
  resolveAiTool, launchAI,
  buildStartPrompt, buildReviewPrompt,
} from './applyWithAI';
import { shareDocumentDirect } from './shareDocument';

interface ManifestEntry {
  templateName: string;
  folderPath: string;
  relPath: string;
  hasUpdateMd: boolean;
}

interface CommandConfig {
  docFolder?: string;
  mode?: string;
  resources?: string[];
  filesScope?: string[];
  prompt?: string;
}

interface SidebarState {
  templates: Record<string, string>;
  templateSrcdocs: Record<string, string>;
  syncTime: string;
  config: {
    githubRepo: string;
    sourcePath: string;
    aiTool: string;
  };
  manifests: ManifestEntry[];
  savedConfigs: Record<string, CommandConfig>;
}

export class WebviewSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'learningKitWebview';
  private _view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.globalStorageUri, 'learning-kit')
      ]
    };

    this._update();

    webviewView.webview.onDidReceiveMessage(async (message) => {
      const config = vscode.workspace.getConfiguration('learningKit');
      switch (message.command) {
        case 'refresh':
          this.refresh();
          break;
        case 'executeCommand':
          await vscode.commands.executeCommand(message.id);
          this.refresh();
          break;
        case 'saveSetting':
          await config.update(message.key, message.value, vscode.ConfigurationTarget.Global);
          this.refresh();
          break;
        case 'pickFolder': {
          const uri = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            openLabel: 'Sélectionner le dossier'
          });
          if (uri?.[0]) {
            await config.update('sourcePath', uri[0].fsPath, vscode.ConfigurationTarget.Global);
            this.refresh();
          }
          break;
        }
        case 'loadResources': {
          const { accId, docFolder } = message;
          const resources = findResourceFiles(docFolder);
          const exampleFile = findExampleFile(docFolder);

          let sectionFiles: string[] = [];
          try {
            sectionFiles = fs.readdirSync(docFolder)
              .filter(f => /^(section|slide)-.*\.html$/.test(f) && !f.includes('EXAMPLE'))
              .sort();
          } catch { /* dossier inaccessible */ }

          const planPath = path.join(docFolder, 'PLAN.md');
          const planExists = fs.existsSync(planPath);
          let planStatus: { exists: boolean; remaining?: number; next?: { file: string; description: string } | null } = { exists: false };
          if (planExists) {
            planStatus = {
              exists: true,
              remaining: countRemainingTasks(planPath),
              next: findNextPlanTask(planPath),
            };
          }

          const defaultResources = (accId === 'review')
            ? ['PROMPT.md', ...(exampleFile ? [exampleFile] : []), 'design/DESIGN_SYSTEM.md'].filter(r => resources.includes(r))
            : ['PROMPT.md'].filter(r => resources.includes(r));

          this._view?.webview.postMessage({
            command: 'resourcesLoaded',
            accId, docFolder, resources, sectionFiles, planStatus, defaultResources,
          });
          break;
        }
        case 'buildPrompt': {
          const { aiCommand, docFolder, templateName, mode, resources, filesScope } = message;
          let prompt = '';
          if (aiCommand === 'start') {
            prompt = buildStartPrompt({
              templateName, docFolder,
              mode: mode as 'progressive' | 'direct' | 'resume' | 'restart',
              resources: resources ?? [],
              filesScope: (filesScope && filesScope !== 'tous les fichiers section-*.html et slide-*.html') ? filesScope : undefined,
            });
          } else if (aiCommand === 'review') {
            prompt = buildReviewPrompt({
              templateName, docFolder,
              reviewMode: mode,
              resources: resources ?? [],
              filesScope: filesScope || 'tous les fichiers section-*.html et slide-*.html',
            });
          }
          this._view?.webview.postMessage({ command: 'promptBuilt', aiCommand, prompt });
          break;
        }
        case 'executeAICommand': {
          const { aiCommand, docFolder, mode, prompt, config: aiConfig } = message;
          if (aiCommand === 'start') {
            if (mode === 'restart') {
              const planPath = path.join(docFolder, 'PLAN.md');
              try { fs.unlinkSync(planPath); } catch { /* ok */ }
            }
            const tool = await resolveAiTool();
            if (!tool) { return; }
            const terminal = vscode.window.createTerminal({ name: 'Learning Kit — Session IA', cwd: docFolder });
            terminal.show();
            terminal.sendText(`${tool} "${prompt.replace(/"/g, '\\"')}"`);
          } else if (aiCommand === 'review') {
            const tool = await resolveAiTool();
            if (!tool) { return; }
            const terminal = vscode.window.createTerminal({ name: 'Learning Kit — Relecture', cwd: docFolder });
            terminal.show();
            terminal.sendText(`${tool} "${prompt.replace(/"/g, '\\"')}"`);
          } else if (aiCommand === 'apply') {
            await launchAI(docFolder);
          } else if (aiCommand === 'share') {
            await shareDocumentDirect(docFolder);
          }
          if (aiConfig) {
            await this._saveConfig(aiCommand, aiConfig);
          }
          break;
        }
        case 'saveConfig': {
          await this._saveConfig(message.aiCommand, message.config);
          break;
        }
        case 'showError': {
          vscode.window.showWarningMessage(message.message);
          break;
        }
      }
    });
  }

  refresh(): void {
    if (this._view) {
      this._update();
    }
  }

  private async _update(): Promise<void> {
    if (!this._view) { return; }
    const state = await this._getState();
    this._view.webview.html = this._getHtml(state, this._view.webview.cspSource);
  }

  private async _getState(): Promise<SidebarState> {
    const versions = readVersions(this.context) ?? {};
    const metadata = await getMetadata(this.context);
    let syncTime = 'Jamais';
    if (metadata) {
      const diffMs = Date.now() - new Date(metadata.syncedAt).getTime();
      const diffH = Math.floor(diffMs / 3_600_000);
      syncTime = diffH >= 1 ? `Il y a ${diffH}h` : 'Récente';
    }
    const cachePath = getCachePath(this.context);
    const templateSrcdocs: Record<string, string> = {};
    for (const name of Object.keys(versions)) {
      const fileUri = vscode.Uri.joinPath(cachePath, 'templates', name, 'index.html');
      try {
        const templateDir = fileUri.fsPath.replace(/[/\\]index\.html$/, '');
        let html = fs.readFileSync(fileUri.fsPath, 'utf-8');
        html = inlineStyles(html, fileUri.fsPath);

        const contentFiles = fs.readdirSync(templateDir).filter(f => /^(section|slide)-.*\.html$/.test(f));
        if (contentFiles.length > 0) {
          const preloaded: Record<string, string> = {};
          for (const sf of contentFiles) {
            const sp = path.join(templateDir, sf);
            let sh = fs.readFileSync(sp, 'utf-8');
            sh = inlineStyles(sh, sp);
            sh = inlineScripts(sh, sp);
            preloaded[sf] = sh;
          }
          const safeJson = JSON.stringify(preloaded).replace(/<\//g, '<\\/');
          const patch = `<script>(function(){const P=${safeJson};const oF=window.fetch;window.fetch=function(url,opts){const k=String(url).split('/').pop().split('?')[0];if(P[k])return Promise.resolve(new Response(P[k],{status:200}));return oF.call(this,url,opts);};const oL=window.loadSection;window.loadSection=function(url,btn){const c=P[url];if(!c){if(oL)oL(url,btn);return;}const f=document.getElementById('content-frame');f.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms');f.style.opacity=0;try{localStorage.setItem('currentSection',url);}catch(e){}setTimeout(()=>{f.srcdoc=c;f.onload=()=>{f.style.opacity=1;if(typeof applyModeToFrame==='function')applyModeToFrame();if(typeof attachIframeHalo==='function')attachIframeHalo(f);};},300);document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');};})();</script>`;
          html = html.replace('</body>', patch + '</body>');
        }

        templateSrcdocs[name] = html;
      } catch {
        templateSrcdocs[name] = '<p style="color:red">Template introuvable</p>';
      }
    }

    const vsConfig = vscode.workspace.getConfiguration('learningKit');

    // Manifests
    const rawManifests = await findManifests();
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
    const manifests: ManifestEntry[] = rawManifests.map(m => {
      const relPath = workspaceRoot
        ? './' + path.relative(workspaceRoot.fsPath, m.folderPath).split(path.sep).join('/')
        : m.folderPath;
      return {
        templateName: m.templateName,
        folderPath: m.folderPath,
        relPath,
        hasUpdateMd: fs.existsSync(path.join(m.folderPath, 'UPDATE.md')),
      };
    });

    // Saved configs
    const savedConfigs: Record<string, CommandConfig> = {
      start:  this.context.workspaceState.get('aiConfig.start',  {}),
      review: this.context.workspaceState.get('aiConfig.review', {}),
      apply:  this.context.workspaceState.get('aiConfig.apply',  {}),
      share:  this.context.workspaceState.get('aiConfig.share',  {}),
    };

    return {
      templates: versions,
      templateSrcdocs,
      syncTime,
      config: {
        githubRepo: vsConfig.get<string>('githubRepo', ''),
        sourcePath: vsConfig.get<string>('sourcePath', ''),
        aiTool: vsConfig.get<string>('aiTool', 'ask'),
      },
      manifests,
      savedConfigs,
    };
  }

  private async _saveConfig(aiCommand: string, config: CommandConfig): Promise<void> {
    await this.context.workspaceState.update(`aiConfig.${aiCommand}`, config);
  }

  private _getHtml(state: SidebarState, cspSource: string): string {
    const templateEntries = Object.entries(state.templates);
    const templateRows = templateEntries.length > 0
      ? templateEntries.map(([name, version]) => {
          const srcdoc = (state.templateSrcdocs[name] ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
          return `<div class="template-item" onclick="togglePreview('${esc(name)}')">
            <span class="template-name">${esc(name)}</span>
            <div style="display:flex;align-items:center;gap:6px">
              <span class="badge">v${esc(version)}</span>
              <span class="chevron" id="chevron-${esc(name)}">▶</span>
            </div>
          </div>
          <div class="template-preview" id="preview-${esc(name)}">
            <div class="preview-container">
              <iframe srcdoc="${srcdoc}" title="${esc(name)} preview"></iframe>
            </div>
          </div>`;
        }).join('')
      : `<div class="empty-msg">Aucun cache — configurez GitHub Repo</div>`;

    const aiOptions = ['ask', 'claude', 'gemini'].map(v => {
      const labels: Record<string, string> = { ask: 'Demander à chaque fois', claude: 'Claude', gemini: 'Gemini' };
      return `<option value="${v}"${state.config.aiTool === v ? ' selected' : ''}>${labels[v]}</option>`;
    }).join('');

    // Inject manifests + savedConfigs as JSON into the webview script
    const manifestsJson = JSON.stringify(state.manifests).replace(/<\//g, '<\\/');
    const savedConfigsJson = JSON.stringify(state.savedConfigs).replace(/<\//g, '<\\/');

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-src ${cspSource};">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    color: var(--vscode-foreground);
    background: var(--vscode-sideBar-background);
    padding: 8px;
    overflow-y: auto;
  }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 12px; padding-bottom: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
  }
  .header-title { font-weight: 600; font-size: calc(var(--vscode-font-size) + 1px); }
  .icon-btn {
    background: none; border: none; color: var(--vscode-icon-foreground);
    cursor: pointer; padding: 4px; border-radius: 4px; font-size: 14px;
    line-height: 1; display: flex; align-items: center;
  }
  .icon-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
  .section { margin-bottom: 12px; }
  .btn {
    display: block; width: 100%; text-align: left; padding: 6px 10px;
    border-radius: 4px; border: none; cursor: pointer;
    font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); margin-bottom: 4px;
  }
  .btn-primary { background: var(--vscode-button-background); color: var(--vscode-button-foreground); font-weight: 500; }
  .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
  .btn-secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
  .section-label {
    font-size: calc(var(--vscode-font-size) - 1px);
    color: var(--vscode-descriptionForeground);
    text-transform: uppercase; letter-spacing: 0.05em;
    margin-bottom: 6px; font-weight: 600;
  }
  .template-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 4px 6px; border-radius: 3px; cursor: pointer;
  }
  .template-item:hover { background: var(--vscode-list-hoverBackground); }
  .template-preview { display: none; margin: 2px 0 8px 0; }
  .template-preview.open { display: block; }
  .preview-container {
    height: 240px; border: 1px solid var(--vscode-panel-border);
    border-radius: 4px; overflow: hidden; position: relative; background: #0f172a;
  }
  .preview-container iframe { border: none; width: 200%; height: 200%; transform: scale(0.5); transform-origin: top left; }
  .badge {
    font-size: calc(var(--vscode-font-size) - 2px);
    background: var(--vscode-badge-background); color: var(--vscode-badge-foreground);
    padding: 1px 5px; border-radius: 10px;
  }
  .sync-info { font-size: calc(var(--vscode-font-size) - 1px); color: var(--vscode-descriptionForeground); margin-top: 6px; }
  .empty-msg { font-size: calc(var(--vscode-font-size) - 1px); color: var(--vscode-descriptionForeground); padding: 4px 0; font-style: italic; }
  .chevron { font-size: 10px; color: var(--vscode-descriptionForeground); transition: transform 0.15s; display: inline-block; }
  .chevron.open { transform: rotate(90deg); }
  .collapsible-body { display: none; }
  .collapsible-body.open { display: block; }
  .field { margin-bottom: 8px; }
  .field-label { font-size: calc(var(--vscode-font-size) - 1px); color: var(--vscode-descriptionForeground); margin-bottom: 3px; }
  .input-row { display: flex; gap: 4px; }
  .field input[type="text"], .field select, select.full {
    flex: 1; width: 100%; padding: 4px 6px;
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent); border-radius: 3px;
    font-family: var(--vscode-font-family); font-size: var(--vscode-font-size);
    outline: none; min-width: 0;
  }
  .field input[type="text"]:focus, .field select:focus, select.full:focus { border-color: var(--vscode-focusBorder); }
  .save-btn, .pick-btn {
    padding: 4px 8px; border: none; border-radius: 3px; cursor: pointer;
    white-space: nowrap; font-size: calc(var(--vscode-font-size) - 1px); flex-shrink: 0;
  }
  .save-btn { background: var(--vscode-button-background); color: var(--vscode-button-foreground); }
  .save-btn:hover { background: var(--vscode-button-hoverBackground); }
  .pick-btn { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); font-size: 13px; }
  .pick-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
  /* ── AI Accordions ─────────────────────────────────────────────────────── */
  .ai-section { margin-bottom: 12px; }
  .accordion { border-bottom: 1px solid var(--vscode-panel-border); }
  .acc-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 7px 0; cursor: pointer; user-select: none;
  }
  .acc-header:hover .acc-title { color: var(--vscode-textLink-foreground); }
  .acc-icon { margin-right: 6px; font-size: 12px; color: var(--vscode-descriptionForeground); }
  .acc-title { font-size: var(--vscode-font-size); flex: 1; }
  .acc-chev { font-size: 10px; color: var(--vscode-descriptionForeground); transition: transform 0.15s; }
  .acc-chev.open { transform: rotate(90deg); }
  .acc-body { padding: 4px 0 10px 4px; }
  .radio-label { display: block; padding: 2px 0; cursor: pointer; font-size: var(--vscode-font-size); }
  .radio-label input { margin-right: 4px; }
  .checkbox-label { display: block; padding: 1px 0; cursor: pointer; font-size: calc(var(--vscode-font-size) - 1px); }
  .checkbox-label input { margin-right: 4px; }
  .prompt-header { display: flex; align-items: center; gap: 4px; margin-bottom: 3px; }
  .prompt-header .field-label { margin-bottom: 0; }
  .rebuild-btn {
    background: none; border: none; color: var(--vscode-descriptionForeground);
    cursor: pointer; font-size: 11px; padding: 1px 4px; border-radius: 3px; line-height: 1;
  }
  .rebuild-btn:hover { background: var(--vscode-toolbar-hoverBackground); color: var(--vscode-foreground); }
  .prompt-textarea {
    width: 100%; padding: 4px 6px;
    background: var(--vscode-input-background); color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent); border-radius: 3px;
    font-family: var(--vscode-font-family); font-size: calc(var(--vscode-font-size) - 1px);
    outline: none; resize: vertical; min-height: 70px;
  }
  .prompt-textarea:focus { border-color: var(--vscode-focusBorder); }
  .plan-info {
    font-size: calc(var(--vscode-font-size) - 1px); color: var(--vscode-descriptionForeground);
    margin-bottom: 4px; font-style: italic; padding: 3px 6px;
    background: var(--vscode-editor-infoForeground, transparent); border-radius: 3px;
    border-left: 2px solid var(--vscode-descriptionForeground);
  }
  .subsection-label {
    font-size: calc(var(--vscode-font-size) - 2px); color: var(--vscode-descriptionForeground);
    text-transform: uppercase; letter-spacing: 0.04em; margin: 6px 0 3px 0; font-weight: 600;
  }
</style>
</head>
<body>

<div class="header">
  <span class="header-title">Learning Kit</span>
  <button class="icon-btn" onclick="cmd('refresh')" title="Actualiser">↻</button>
</div>

<div class="section">
  <button class="btn btn-primary" onclick="exec('learningKit.createDocument')">+ Nouveau document</button>
  <button class="btn btn-secondary" onclick="exec('learningKit.updateDocument')">↑ Mettre à jour</button>
  <button class="btn btn-secondary" onclick="exec('learningKit.adoptDocument')">⊕ Adopter</button>
</div>

<!-- ═══════════════ AI Accordions ═══════════════ -->
<div class="section ai-section">
  <div class="section-label" style="margin-bottom:4px">Outils IA</div>

  <!-- ▶ Démarrer avec l'IA -->
  <div class="accordion">
    <div class="acc-header" onclick="toggleAcc('start')">
      <span class="acc-icon">▶</span>
      <span class="acc-title">Démarrer avec l'IA</span>
      <span class="acc-chev" id="chev-start">›</span>
    </div>
    <div class="acc-body" id="body-start" style="display:none">
      <div class="field">
        <div class="field-label">Document</div>
        <select class="full" id="start-doc" onchange="startDocChanged()">
          <option value="">Sélectionner un document...</option>
        </select>
      </div>
      <div id="start-mode-section" style="display:none">
        <div class="field" id="start-new-mode">
          <div class="field-label">Mode</div>
          <label class="radio-label"><input type="radio" name="start-mode" value="progressive" checked onchange="startUpdatePrompt()"> 📋 Progressif (PLAN.md)</label>
          <label class="radio-label"><input type="radio" name="start-mode" value="direct" onchange="startUpdatePrompt()"> ⚡ Direct</label>
        </div>
        <div class="field" id="start-plan-mode" style="display:none">
          <div class="field-label">PLAN.md détecté</div>
          <div id="start-plan-info" class="plan-info"></div>
          <label class="radio-label"><input type="radio" name="start-mode" value="resume" checked onchange="startUpdatePrompt()"> ▶ Reprendre</label>
          <label class="radio-label"><input type="radio" name="start-mode" value="restart" onchange="startUpdatePrompt()"> ↺ Recommencer</label>
        </div>
      </div>
      <div id="start-resources-section" style="display:none">
        <div class="subsection-label">Ressources</div>
        <div id="start-resources-list"></div>
      </div>
      <div id="start-files-section" style="display:none">
        <div class="subsection-label">Fichiers de travail</div>
        <div id="start-files-list"></div>
      </div>
      <div class="field">
        <div class="prompt-header">
          <span class="field-label">Prompt</span>
          <button class="rebuild-btn" onclick="startUpdatePrompt()" title="Reconstruire le prompt">↺</button>
        </div>
        <textarea id="start-prompt" class="prompt-textarea" rows="5" placeholder="Sélectionnez un document pour générer le prompt..."></textarea>
      </div>
      <button class="btn btn-primary" onclick="launchStart()">▶ Démarrer</button>
    </div>
  </div>

  <!-- ⊙ Relire avec l'IA -->
  <div class="accordion">
    <div class="acc-header" onclick="toggleAcc('review')">
      <span class="acc-icon">⊙</span>
      <span class="acc-title">Relire avec l'IA</span>
      <span class="acc-chev" id="chev-review">›</span>
    </div>
    <div class="acc-body" id="body-review" style="display:none">
      <div class="field">
        <div class="field-label">Document</div>
        <select class="full" id="review-doc" onchange="reviewDocChanged()">
          <option value="">Sélectionner un document...</option>
        </select>
      </div>
      <div class="field">
        <div class="field-label">Mode</div>
        <label class="radio-label"><input type="radio" name="review-mode" value="style" checked onchange="reviewUpdatePrompt()"> 🎨 Style</label>
        <label class="radio-label"><input type="radio" name="review-mode" value="content" onchange="reviewUpdatePrompt()"> 📝 Contenu</label>
        <label class="radio-label"><input type="radio" name="review-mode" value="schema" onchange="reviewUpdatePrompt()"> 📐 Schémas</label>
      </div>
      <div id="review-resources-section" style="display:none">
        <div class="subsection-label">Ressources</div>
        <div id="review-resources-list"></div>
      </div>
      <div id="review-files-section" style="display:none">
        <div class="subsection-label">Fichiers</div>
        <div id="review-files-list"></div>
      </div>
      <div class="field">
        <div class="prompt-header">
          <span class="field-label">Prompt</span>
          <button class="rebuild-btn" onclick="reviewUpdatePrompt()" title="Reconstruire le prompt">↺</button>
        </div>
        <textarea id="review-prompt" class="prompt-textarea" rows="5" placeholder="Sélectionnez un document pour générer le prompt..."></textarea>
      </div>
      <button class="btn btn-primary" onclick="launchReview()">⊙ Relire</button>
    </div>
  </div>

  <!-- ✓ Appliquer avec l'IA -->
  <div class="accordion">
    <div class="acc-header" onclick="toggleAcc('apply')">
      <span class="acc-icon">✓</span>
      <span class="acc-title">Appliquer avec l'IA</span>
      <span class="acc-chev" id="chev-apply">›</span>
    </div>
    <div class="acc-body" id="body-apply" style="display:none">
      <div class="field">
        <div class="field-label">Document (avec UPDATE.md)</div>
        <select class="full" id="apply-doc">
          <option value="">Sélectionner un document...</option>
        </select>
      </div>
      <div id="apply-no-update" class="empty-msg" style="display:none">Aucun UPDATE.md trouvé dans le workspace.</div>
      <button class="btn btn-primary" onclick="launchApply()" style="margin-top:4px">✓ Appliquer</button>
    </div>
  </div>

  <!-- ⬡ Partager -->
  <div class="accordion">
    <div class="acc-header" onclick="toggleAcc('share')">
      <span class="acc-icon">⬡</span>
      <span class="acc-title">Partager</span>
      <span class="acc-chev" id="chev-share">›</span>
    </div>
    <div class="acc-body" id="body-share" style="display:none">
      <div class="field">
        <div class="field-label">Document</div>
        <select class="full" id="share-doc">
          <option value="">Sélectionner un document...</option>
        </select>
      </div>
      <button class="btn btn-primary" onclick="launchShare()" style="margin-top:4px">⬡ Partager</button>
    </div>
  </div>
</div>
<!-- ════════════════════════════════════════════ -->

<div class="section">
  <div class="section-label">Templates disponibles</div>
  ${templateRows}
  <div class="sync-info">Dernière sync : ${esc(state.syncTime)}</div>
</div>

<div class="section">
  <div class="collapsible-header" onclick="toggleConfig()">
    <span class="section-label">⚙ Configuration</span>
    <span class="chevron" id="chevron">▶</span>
  </div>
  <div class="collapsible-body" id="configBody">
    <div class="field">
      <div class="field-label">GitHub Repo</div>
      <div class="input-row">
        <input type="text" id="githubRepo" value="${esc(state.config.githubRepo)}" placeholder="owner/repo">
        <button class="save-btn" onclick="saveSetting('githubRepo', 'githubRepo')">✓</button>
      </div>
    </div>
    <div class="field">
      <div class="field-label">Chemin local (sourcePath)</div>
      <div class="input-row">
        <input type="text" id="sourcePath" value="${esc(state.config.sourcePath)}" placeholder="/chemin/vers/dossier">
        <button class="pick-btn" onclick="pickFolder()" title="Parcourir">📁</button>
        <button class="save-btn" onclick="saveSetting('sourcePath', 'sourcePath')">✓</button>
      </div>
    </div>
    <div class="field">
      <div class="field-label">Outil IA</div>
      <select id="aiTool" onchange="saveSelect('aiTool')">
        ${aiOptions}
      </select>
    </div>
  </div>
</div>

<script>
  const vscode = acquireVsCodeApi();

  // ── Injected data ──────────────────────────────────────────────────────
  const MANIFESTS = ${manifestsJson};
  const ALL_MANIFESTS = MANIFESTS;
  const UPDATE_MANIFESTS = MANIFESTS.filter(m => m.hasUpdateMd);
  let savedConfigs = ${savedConfigsJson};

  // ── State ──────────────────────────────────────────────────────────────
  let currentAcc = null;
  let loadedData = {}; // { [docFolder]: { resources, sectionFiles, planStatus, defaultResources } }

  // ── VSCode messages ────────────────────────────────────────────────────
  function cmd(command, extra) { vscode.postMessage({ command, ...extra }); }
  function exec(id) { cmd('executeCommand', { id }); }
  function saveSetting(inputId, key) {
    const value = document.getElementById(inputId).value;
    cmd('saveSetting', { key, value });
  }
  function saveSelect(id) {
    const value = document.getElementById(id).value;
    cmd('saveSetting', { key: id, value });
  }
  function pickFolder() { cmd('pickFolder'); }

  // ── Accordion ──────────────────────────────────────────────────────────
  function toggleAcc(id) {
    const body = document.getElementById('body-' + id);
    const chev = document.getElementById('chev-' + id);
    if (currentAcc === id) {
      body.style.display = 'none';
      chev.classList.remove('open');
      currentAcc = null;
    } else {
      if (currentAcc) {
        document.getElementById('body-' + currentAcc).style.display = 'none';
        document.getElementById('chev-' + currentAcc).classList.remove('open');
      }
      body.style.display = 'block';
      chev.classList.add('open');
      currentAcc = id;
      initAccordion(id);
    }
  }

  function initAccordion(id) {
    if (id === 'start' || id === 'review') {
      const manifests = ALL_MANIFESTS;
      populateDocSelect(id + '-doc', manifests);
      const cfg = savedConfigs[id] || {};
      if (cfg.docFolder) {
        const sel = document.getElementById(id + '-doc');
        sel.value = cfg.docFolder;
        if (sel.value === cfg.docFolder) {
          onDocSelected(id, cfg.docFolder);
        }
      }
      if (cfg.mode) {
        const radio = document.querySelector('input[name="' + id + '-mode"][value="' + cfg.mode + '"]');
        if (radio) { radio.checked = true; }
      }
      if (cfg.prompt) {
        document.getElementById(id + '-prompt').value = cfg.prompt;
      }
    } else if (id === 'apply') {
      populateDocSelect('apply-doc', UPDATE_MANIFESTS);
      document.getElementById('apply-no-update').style.display = UPDATE_MANIFESTS.length === 0 ? 'block' : 'none';
      const cfg = savedConfigs['apply'] || {};
      if (cfg.docFolder) {
        const sel = document.getElementById('apply-doc');
        sel.value = cfg.docFolder;
      }
    } else if (id === 'share') {
      populateDocSelect('share-doc', ALL_MANIFESTS);
      const cfg = savedConfigs['share'] || {};
      if (cfg.docFolder) {
        const sel = document.getElementById('share-doc');
        sel.value = cfg.docFolder;
      }
    }
  }

  function populateDocSelect(selectId, manifests) {
    const sel = document.getElementById(selectId);
    sel.innerHTML = '<option value="">Sélectionner un document...</option>';
    for (const m of manifests) {
      const opt = document.createElement('option');
      opt.value = m.folderPath;
      opt.dataset.template = m.templateName;
      opt.textContent = m.templateName + ' — ' + m.relPath;
      sel.appendChild(opt);
    }
  }

  // ── Document selection ─────────────────────────────────────────────────
  function onDocSelected(accId, docFolder) {
    if (!docFolder) { clearResources(accId); return; }
    if (loadedData[docFolder]) {
      applyLoadedData(accId, docFolder);
    } else {
      vscode.postMessage({ command: 'loadResources', accId, docFolder });
    }
  }

  function startDocChanged() {
    const sel = document.getElementById('start-doc');
    onDocSelected('start', sel.value);
  }

  function reviewDocChanged() {
    const sel = document.getElementById('review-doc');
    onDocSelected('review', sel.value);
  }

  function clearResources(accId) {
    if (accId === 'start') {
      document.getElementById('start-mode-section').style.display = 'none';
      document.getElementById('start-resources-section').style.display = 'none';
      document.getElementById('start-files-section').style.display = 'none';
      document.getElementById('start-prompt').value = '';
    } else if (accId === 'review') {
      document.getElementById('review-resources-section').style.display = 'none';
      document.getElementById('review-files-section').style.display = 'none';
      document.getElementById('review-prompt').value = '';
    }
  }

  // ── Apply loaded data ──────────────────────────────────────────────────
  function applyLoadedData(accId, docFolder) {
    const data = loadedData[docFolder];
    if (!data) { return; }
    const cfg = savedConfigs[accId] || {};
    const sameDoc = cfg.docFolder === docFolder;

    if (accId === 'start') {
      document.getElementById('start-mode-section').style.display = 'block';
      if (data.planStatus && data.planStatus.exists) {
        document.getElementById('start-plan-mode').style.display = 'block';
        document.getElementById('start-new-mode').style.display = 'none';
        const rem = data.planStatus.remaining;
        const nxt = data.planStatus.next;
        document.getElementById('start-plan-info').textContent =
          rem > 0 ? rem + ' tâche(s) restante(s). Prochaine : ' + (nxt ? nxt.file : '?')
                  : 'Toutes les tâches sont terminées.';
        const defaultMode = (sameDoc && cfg.mode) ? cfg.mode : 'resume';
        const radio = document.querySelector('input[name="start-mode"][value="' + defaultMode + '"]');
        if (radio) { radio.checked = true; }
      } else {
        document.getElementById('start-plan-mode').style.display = 'none';
        document.getElementById('start-new-mode').style.display = 'block';
        const defaultMode = (sameDoc && cfg.mode && (cfg.mode === 'progressive' || cfg.mode === 'direct')) ? cfg.mode : 'progressive';
        const radio = document.querySelector('input[name="start-mode"][value="' + defaultMode + '"]');
        if (radio) { radio.checked = true; }
      }

      if (data.resources.length > 0) {
        document.getElementById('start-resources-section').style.display = 'block';
        const defaultRes = sameDoc && cfg.resources ? cfg.resources : data.defaultResources;
        renderCheckboxes('start-resources-list', data.resources, defaultRes, function() { startUpdatePrompt(); });
      } else {
        document.getElementById('start-resources-section').style.display = 'none';
      }

      if (data.sectionFiles.length > 0) {
        document.getElementById('start-files-section').style.display = 'block';
        const allFiles = ['📋 Tous les fichiers'].concat(data.sectionFiles);
        const defaultFiles = sameDoc && cfg.filesScope ? cfg.filesScope : ['📋 Tous les fichiers'];
        renderCheckboxes('start-files-list', allFiles, defaultFiles, function() { startUpdatePrompt(); });
      } else {
        document.getElementById('start-files-section').style.display = 'none';
      }

      if (!sameDoc || !cfg.prompt) {
        startUpdatePrompt();
      }

    } else if (accId === 'review') {
      if (data.resources.length > 0) {
        document.getElementById('review-resources-section').style.display = 'block';
        const defaultRes = sameDoc && cfg.resources ? cfg.resources : data.defaultResources;
        renderCheckboxes('review-resources-list', data.resources, defaultRes, function() { reviewUpdatePrompt(); });
      } else {
        document.getElementById('review-resources-section').style.display = 'none';
      }

      if (data.sectionFiles.length > 0) {
        document.getElementById('review-files-section').style.display = 'block';
        const allFiles = ['📋 Tous les fichiers'].concat(data.sectionFiles);
        const defaultFiles = sameDoc && cfg.filesScope ? cfg.filesScope : ['📋 Tous les fichiers'];
        renderCheckboxes('review-files-list', allFiles, defaultFiles, function() { reviewUpdatePrompt(); });
      } else {
        document.getElementById('review-files-section').style.display = 'none';
      }

      if (!sameDoc || !cfg.prompt) {
        reviewUpdatePrompt();
      }
    }
  }

  // ── Checkbox helpers ───────────────────────────────────────────────────
  function renderCheckboxes(containerId, items, checked, onChange) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    for (const item of items) {
      const label = document.createElement('label');
      label.className = 'checkbox-label';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = item;
      input.checked = checked.includes(item);
      if (onChange) { input.addEventListener('change', onChange); }
      label.appendChild(input);
      label.appendChild(document.createTextNode(' ' + item));
      container.appendChild(label);
    }
  }

  function getCheckedValues(containerId) {
    const container = document.getElementById(containerId);
    if (!container) { return []; }
    return Array.from(container.querySelectorAll('input[type="checkbox"]'))
      .filter(i => i.checked).map(i => i.value);
  }

  function buildFilesScope(containerId) {
    const checked = getCheckedValues(containerId);
    const hasTous = checked.some(v => v.startsWith('📋'));
    if (hasTous || checked.length === 0) {
      return 'tous les fichiers section-*.html et slide-*.html';
    }
    const files = checked.filter(v => !v.startsWith('📋'));
    return files.length > 0 ? 'les fichiers : ' + files.join(', ') : 'tous les fichiers section-*.html et slide-*.html';
  }

  // ── Prompt update ──────────────────────────────────────────────────────
  function getSelectedManifest(selectId) {
    const sel = document.getElementById(selectId);
    if (!sel || !sel.value) { return null; }
    return MANIFESTS.find(m => m.folderPath === sel.value) || null;
  }

  function startUpdatePrompt() {
    const m = getSelectedManifest('start-doc');
    if (!m) { return; }
    const mode = (document.querySelector('input[name="start-mode"]:checked') || {}).value || 'progressive';
    const resources = getCheckedValues('start-resources-list');
    const filesScope = buildFilesScope('start-files-list');
    vscode.postMessage({ command: 'buildPrompt', aiCommand: 'start', docFolder: m.folderPath, templateName: m.templateName, mode, resources, filesScope });
  }

  function reviewUpdatePrompt() {
    const m = getSelectedManifest('review-doc');
    if (!m) { return; }
    const mode = (document.querySelector('input[name="review-mode"]:checked') || {}).value || 'style';
    const resources = getCheckedValues('review-resources-list');
    const filesScope = buildFilesScope('review-files-list');
    vscode.postMessage({ command: 'buildPrompt', aiCommand: 'review', docFolder: m.folderPath, templateName: m.templateName, mode, resources, filesScope });
  }

  // ── Launch commands ────────────────────────────────────────────────────
  function launchStart() {
    const m = getSelectedManifest('start-doc');
    if (!m) { vscode.postMessage({ command: 'showError', message: 'Veuillez sélectionner un document.' }); return; }
    const prompt = document.getElementById('start-prompt').value.trim();
    if (!prompt) { vscode.postMessage({ command: 'showError', message: 'Prompt vide — cliquez ↺ pour le générer.' }); return; }
    const mode = (document.querySelector('input[name="start-mode"]:checked') || {}).value || 'progressive';
    const resources = getCheckedValues('start-resources-list');
    const filesScope = getCheckedValues('start-files-list');
    const config = { docFolder: m.folderPath, mode, resources, filesScope, prompt };
    savedConfigs['start'] = config;
    vscode.postMessage({ command: 'executeAICommand', aiCommand: 'start', docFolder: m.folderPath, mode, prompt, config });
  }

  function launchReview() {
    const m = getSelectedManifest('review-doc');
    if (!m) { vscode.postMessage({ command: 'showError', message: 'Veuillez sélectionner un document.' }); return; }
    const prompt = document.getElementById('review-prompt').value.trim();
    if (!prompt) { vscode.postMessage({ command: 'showError', message: 'Prompt vide — cliquez ↺ pour le générer.' }); return; }
    const mode = (document.querySelector('input[name="review-mode"]:checked') || {}).value || 'style';
    const resources = getCheckedValues('review-resources-list');
    const filesScope = getCheckedValues('review-files-list');
    const config = { docFolder: m.folderPath, mode, resources, filesScope, prompt };
    savedConfigs['review'] = config;
    vscode.postMessage({ command: 'executeAICommand', aiCommand: 'review', docFolder: m.folderPath, prompt, config });
  }

  function launchApply() {
    const sel = document.getElementById('apply-doc');
    if (!sel || !sel.value) { vscode.postMessage({ command: 'showError', message: 'Veuillez sélectionner un document avec UPDATE.md.' }); return; }
    const docFolder = sel.value;
    const config = { docFolder };
    savedConfigs['apply'] = config;
    vscode.postMessage({ command: 'executeAICommand', aiCommand: 'apply', docFolder, config });
  }

  function launchShare() {
    const sel = document.getElementById('share-doc');
    if (!sel || !sel.value) { vscode.postMessage({ command: 'showError', message: 'Veuillez sélectionner un document.' }); return; }
    const docFolder = sel.value;
    const config = { docFolder };
    savedConfigs['share'] = config;
    vscode.postMessage({ command: 'executeAICommand', aiCommand: 'share', docFolder, config });
  }

  // ── Collapsible config (existing) ─────────────────────────────────────
  function toggleConfig() {
    document.getElementById('configBody').classList.toggle('open');
    document.getElementById('chevron').classList.toggle('open');
  }

  // ── Template previews (existing) ──────────────────────────────────────
  let openPreview = null;
  function togglePreview(name) {
    if (openPreview && openPreview !== name) {
      document.getElementById('preview-' + openPreview).classList.remove('open');
      document.getElementById('chevron-' + openPreview).classList.remove('open');
    }
    const preview = document.getElementById('preview-' + name);
    const chevron = document.getElementById('chevron-' + name);
    if (openPreview === name) {
      preview.classList.remove('open');
      chevron.classList.remove('open');
      openPreview = null;
    } else {
      preview.classList.add('open');
      chevron.classList.add('open');
      openPreview = name;
    }
  }

  // ── Message listener ──────────────────────────────────────────────────
  window.addEventListener('message', event => {
    const msg = event.data;
    switch (msg.command) {
      case 'resourcesLoaded': {
        const { accId, docFolder, resources, sectionFiles, planStatus, defaultResources } = msg;
        loadedData[docFolder] = { resources, sectionFiles, planStatus, defaultResources };
        if (currentAcc === accId) {
          const sel = document.getElementById(accId + '-doc');
          if (sel && sel.value === docFolder) {
            applyLoadedData(accId, docFolder);
          }
        }
        break;
      }
      case 'promptBuilt': {
        const { aiCommand, prompt } = msg;
        const ta = document.getElementById(aiCommand + '-prompt');
        if (ta) { ta.value = prompt; }
        break;
      }
    }
  });
</script>
</body>
</html>`;
  }
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
