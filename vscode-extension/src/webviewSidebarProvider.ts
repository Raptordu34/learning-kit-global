import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { readVersions, getMetadata, getCachePath } from './cache';

interface SidebarState {
  templates: Record<string, string>;
  templateSrcdocs: Record<string, string>;
  syncTime: string;
  config: {
    githubRepo: string;
    sourcePath: string;
    aiTool: string;
  };
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

        // Pre-load section/slide files for all template types
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
          // </script> inside JSON would terminate the script tag — escape it
          const safeJson = JSON.stringify(preloaded).replace(/<\//g, '<\\/');
          // Patch both fetch() (presentation) and loadSection() (sidebar-iframe)
          const patch = `<script>(function(){const P=${safeJson};const oF=window.fetch;window.fetch=function(url,opts){const k=String(url).split('/').pop().split('?')[0];if(P[k])return Promise.resolve(new Response(P[k],{status:200}));return oF.call(this,url,opts);};const oL=window.loadSection;window.loadSection=function(url,btn){const c=P[url];if(!c){if(oL)oL(url,btn);return;}const f=document.getElementById('content-frame');f.setAttribute('sandbox','allow-scripts allow-same-origin allow-forms');f.style.opacity=0;try{localStorage.setItem('currentSection',url);}catch(e){}setTimeout(()=>{f.srcdoc=c;f.onload=()=>{f.style.opacity=1;if(typeof applyModeToFrame==='function')applyModeToFrame();if(typeof attachIframeHalo==='function')attachIframeHalo(f);};},300);document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));if(btn)btn.classList.add('active');};})();</script>`;
          html = html.replace('</body>', patch + '</body>');
        }

        templateSrcdocs[name] = html;
      } catch {
        templateSrcdocs[name] = '<p style="color:red">Template introuvable</p>';
      }
    }
    const config = vscode.workspace.getConfiguration('learningKit');
    return {
      templates: versions,
      templateSrcdocs,
      syncTime,
      config: {
        githubRepo: config.get<string>('githubRepo', ''),
        sourcePath: config.get<string>('sourcePath', ''),
        aiTool: config.get<string>('aiTool', 'ask'),
      }
    };
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
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
  }
  .header-title {
    font-weight: 600;
    font-size: calc(var(--vscode-font-size) + 1px);
  }
  .icon-btn {
    background: none;
    border: none;
    color: var(--vscode-icon-foreground);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1;
    display: flex;
    align-items: center;
  }
  .icon-btn:hover { background: var(--vscode-toolbar-hoverBackground); }
  .section { margin-bottom: 12px; }
  .btn {
    display: block;
    width: 100%;
    text-align: left;
    padding: 6px 10px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    margin-bottom: 4px;
  }
  .btn-primary {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    font-weight: 500;
  }
  .btn-primary:hover { background: var(--vscode-button-hoverBackground); }
  .btn-secondary {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
  }
  .btn-secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
  .section-label {
    font-size: calc(var(--vscode-font-size) - 1px);
    color: var(--vscode-descriptionForeground);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
    font-weight: 600;
  }
  .template-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 6px;
    border-radius: 3px;
    cursor: pointer;
  }
  .template-item:hover { background: var(--vscode-list-hoverBackground); }
  .template-preview {
    display: none;
    margin: 2px 0 8px 0;
  }
  .template-preview.open { display: block; }
  .preview-container {
    height: 240px;
    border: 1px solid var(--vscode-panel-border);
    border-radius: 4px;
    overflow: hidden;
    position: relative;
    background: #0f172a;
  }
  .preview-container iframe {
    border: none;
    width: 200%;
    height: 200%;
    transform: scale(0.5);
    transform-origin: top left;
  }
  .badge {
    font-size: calc(var(--vscode-font-size) - 2px);
    background: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    padding: 1px 5px;
    border-radius: 10px;
  }
  .sync-info {
    font-size: calc(var(--vscode-font-size) - 1px);
    color: var(--vscode-descriptionForeground);
    margin-top: 6px;
  }
  .empty-msg {
    font-size: calc(var(--vscode-font-size) - 1px);
    color: var(--vscode-descriptionForeground);
    padding: 4px 0;
    font-style: italic;
  }
  .collapsible-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    user-select: none;
    padding: 4px 0;
    margin-bottom: 4px;
  }
  .chevron {
    font-size: 10px;
    color: var(--vscode-descriptionForeground);
    transition: transform 0.15s;
    display: inline-block;
  }
  .chevron.open { transform: rotate(90deg); }
  .collapsible-body { display: none; }
  .collapsible-body.open { display: block; }
  .field { margin-bottom: 8px; }
  .field-label {
    font-size: calc(var(--vscode-font-size) - 1px);
    color: var(--vscode-descriptionForeground);
    margin-bottom: 3px;
  }
  .input-row { display: flex; gap: 4px; }
  .field input, .field select {
    flex: 1;
    padding: 4px 6px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    border-radius: 3px;
    font-family: var(--vscode-font-family);
    font-size: var(--vscode-font-size);
    outline: none;
    min-width: 0;
  }
  .field input:focus, .field select:focus { border-color: var(--vscode-focusBorder); }
  .save-btn, .pick-btn {
    padding: 4px 8px;
    border: none;
    border-radius: 3px;
    cursor: pointer;
    white-space: nowrap;
    font-size: calc(var(--vscode-font-size) - 1px);
    flex-shrink: 0;
  }
  .save-btn {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
  }
  .save-btn:hover { background: var(--vscode-button-hoverBackground); }
  .pick-btn {
    background: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    font-size: 13px;
  }
  .pick-btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
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
  <button class="btn btn-secondary" onclick="exec('learningKit.applyWithAI')">▶ Appliquer avec l'IA</button>
</div>

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
  function toggleConfig() {
    document.getElementById('configBody').classList.toggle('open');
    document.getElementById('chevron').classList.toggle('open');
  }
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

function readCssWithImports(cssPath: string): string {
  const cssDir = path.dirname(cssPath);
  let css = fs.readFileSync(cssPath, 'utf-8');
  css = css.replace(/@import\s+url\(['"]?([^'")\s]+)['"]?\)[^;]*;/g, (_, href) => {
    if (href.startsWith('http')) { return ''; }
    try { return readCssWithImports(path.resolve(cssDir, href)); } catch { return ''; }
  });
  return css;
}

function inlineScripts(html: string, htmlFilePath: string): string {
  const dir = path.dirname(htmlFilePath);
  return html.replace(
    /<script\s+([^>]*)src=["']([^"']+)["'][^>]*><\/script>/gi,
    (match, _attrs, src) => {
      if (src.startsWith('http')) { return ''; }
      try {
        const content = fs.readFileSync(path.resolve(dir, src), 'utf-8');
        // defer can appear anywhere in the tag — check full match
        const isDeferred = /\bdefer\b/i.test(match);
        return isDeferred
          ? `<script>document.addEventListener('DOMContentLoaded',function(){${content}});</script>`
          : `<script>${content}</script>`;
      } catch { return ''; }
    }
  );
}

function inlineStyles(html: string, htmlFilePath: string): string {
  const dir = path.dirname(htmlFilePath);
  return html.replace(
    /<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi,
    (_, href) => {
      if (href.startsWith('http')) { return ''; }
      try { return `<style>${readCssWithImports(path.resolve(dir, href))}</style>`; } catch { return ''; }
    }
  );
}
