import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const AI_PROMPT =
  'Lis le fichier UPDATE.md dans ce dossier et applique toutes les modifications ' +
  'décrites sur les fichiers du projet. Supprime UPDATE.md une fois terminé.';

async function resolveAiTool(): Promise<string | undefined> {
  const config = vscode.workspace.getConfiguration('learningKit');
  const setting = config.get<string>('aiTool', 'ask');

  if (setting === 'ask') {
    return vscode.window.showQuickPick(['claude', 'gemini'], {
      placeHolder: 'Quel outil IA utiliser ?',
      title: 'Learning Kit: Lancer l\'IA'
    });
  }
  return setting;
}

/** Ouvre un terminal dans docFolder et lance l'IA avec le prompt. */
export async function launchAI(docFolder: string): Promise<void> {
  const tool = await resolveAiTool();
  if (!tool) { return; }

  const terminal = vscode.window.createTerminal({
    name: 'Learning Kit — Apply',
    cwd: docFolder
  });
  terminal.show();
  terminal.sendText(`${tool} "${AI_PROMPT}"`);
}

// ─── Plan helpers ─────────────────────────────────────────────────────────────

function findNextPlanTask(planPath: string): { file: string; description: string } | null {
  const lines = fs.readFileSync(planPath, 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/^- \[ \] ([^\s]+\.html)\s*[—\-]\s*(.+)$/);
    if (m) { return { file: m[1].trim(), description: m[2].trim() }; }
  }
  return null;
}

function countRemainingTasks(planPath: string): number {
  return (fs.readFileSync(planPath, 'utf-8').match(/^- \[ \]/gm) ?? []).length;
}

// ─── Session helpers ───────────────────────────────────────────────────────────

/** Retourne le fichier EXAMPLE du template (section, slide, ou null si absent). */
function findExampleFile(docFolder: string): string | null {
  for (const f of ['section-EXAMPLE.html', 'slide-EXAMPLE.html']) {
    if (fs.existsSync(path.join(docFolder, f))) { return f; }
  }
  return null;
}

/** Retourne les chemins relatifs de tous les fichiers ressources détectés dans docFolder. */
function findResourceFiles(docFolder: string): string[] {
  const candidates: string[] = [];
  for (const f of ['PROMPT.md', 'CLAUDE.md']) {
    if (fs.existsSync(path.join(docFolder, f))) { candidates.push(f); }
  }
  const exampleFile = findExampleFile(docFolder);
  if (exampleFile) { candidates.push(exampleFile); }
  if (fs.existsSync(path.join(docFolder, 'design', 'DESIGN_SYSTEM.md'))) {
    candidates.push('design/DESIGN_SYSTEM.md');
  }
  try {
    fs.readdirSync(path.join(docFolder, 'design', 'svg'))
      .filter(f => f.endsWith('.md'))
      .sort()
      .forEach(f => candidates.push(`design/svg/${f}`));
  } catch { /* pas de dossier svg */ }
  try {
    fs.readdirSync(path.join(docFolder, 'ressources'))
      .sort()
      .forEach(f => candidates.push(`ressources/${f}`));
  } catch { /* pas de dossier ressources */ }
  return candidates;
}

type ReviewResources = { mode: 'free' } | { mode: 'constrained'; files: string[] };
type ReviewSelection = { resources: ReviewResources; filesScope: string } | undefined;

/** QuickPick ressources seules (utilisé par launchAISession). */
async function selectResources(docFolder: string, defaultKeys: string[]): Promise<ReviewResources | undefined> {
  const all = findResourceFiles(docFolder);
  if (all.length === 0) { return { mode: 'free' }; }
  const items: vscode.QuickPickItem[] = [
    { label: '🔍 Libre — l\'IA explore par elle-même', description: 'Aucune contrainte de lecture', picked: false },
    ...all.map(f => ({ label: f, picked: defaultKeys.some(d => f === d || f.startsWith(d)) })),
  ];
  const selected = await vscode.window.showQuickPick(items, {
    title: 'Learning Kit: Fichiers ressources',
    placeHolder: 'Sélectionner les fichiers à lire, ou laisser tout décoché pour le mode libre',
    canPickMany: true,
  });
  if (selected === undefined) { return undefined; }
  if (selected.length === 0 || selected.some(s => s.label.startsWith('🔍'))) { return { mode: 'free' }; }
  return { mode: 'constrained', files: selected.map(s => s.label) };
}

/** QuickPick fichiers à traiter seuls (utilisé par launchAISession). */
async function selectWorkingFiles(docFolder: string): Promise<string | undefined> {
  let sectionFiles: string[] = [];
  try {
    sectionFiles = fs.readdirSync(docFolder)
      .filter(f => /^(section|slide)-.*\.html$/.test(f) && !f.includes('EXAMPLE'))
      .sort();
  } catch { /* dossier inaccessible */ }
  if (sectionFiles.length === 0) {
    if (fs.existsSync(path.join(docFolder, 'index.html'))) { return 'index.html'; }
    return 'tous les fichiers section-*.html et slide-*.html';
  }
  const items: vscode.QuickPickItem[] = [
    { label: '📋 Tous les fichiers', description: 'Traiter tout le document', picked: true },
    ...sectionFiles.map(f => ({ label: f, picked: false })),
  ];
  const selected = await vscode.window.showQuickPick(items, {
    title: 'Learning Kit: Fichiers à traiter',
    placeHolder: 'Sélectionner les fichiers sur lesquels travailler',
    canPickMany: true,
  });
  if (!selected || selected.length === 0) { return undefined; }
  if (selected.some(s => s.label.startsWith('📋'))) { return 'tous les fichiers section-*.html et slide-*.html'; }
  return `les fichiers : ${selected.map(s => s.label).join(', ')}`;
}

/**
 * QuickPick unique combinant ressources et fichiers à traiter.
 * Deux sections séparées visuellement par des séparateurs VSCode.
 * Retourne undefined si annulation (Echap).
 */
async function selectResourcesAndFiles(
  docFolder: string,
  defaultResourceKeys: string[],
): Promise<ReviewSelection> {
  const allResources = findResourceFiles(docFolder);

  // Calcul des fichiers section/slide
  let sectionFiles: string[] = [];
  try {
    sectionFiles = fs.readdirSync(docFolder)
      .filter(f => /^(section|slide)-.*\.html$/.test(f) && !f.includes('EXAMPLE'))
      .sort();
  } catch { /* dossier inaccessible */ }

  // One-pager : pas de section files → scope automatique, pas de section "Fichiers"
  const autoFilesScope = sectionFiles.length === 0
    ? (fs.existsSync(path.join(docFolder, 'index.html')) ? 'index.html' : 'tous les fichiers section-*.html et slide-*.html')
    : null;

  const items: vscode.QuickPickItem[] = [];

  // ── Section Ressources ──
  items.push({ label: 'Ressources', kind: vscode.QuickPickItemKind.Separator });
  if (allResources.length > 0) {
    items.push({
      label: '🔍 Libre — l\'IA explore par elle-même',
      description: 'Aucune contrainte de lecture',
      picked: false,
    });
    for (const f of allResources) {
      items.push({ label: f, picked: defaultResourceKeys.some(d => f === d || f.startsWith(d)) });
    }
  }

  // ── Section Fichiers à traiter ──
  if (sectionFiles.length > 0) {
    items.push({ label: 'Fichiers à traiter', kind: vscode.QuickPickItemKind.Separator });
    items.push({ label: '📋 Tous les fichiers', description: 'Traiter tout le document', picked: true });
    for (const f of sectionFiles) {
      items.push({ label: f, picked: false });
    }
  }

  const selected = await vscode.window.showQuickPick(items, {
    title: 'Learning Kit: Ressources & fichiers',
    placeHolder: 'Ajuster les fichiers de contexte et le périmètre à traiter',
    canPickMany: true,
  });
  if (selected === undefined) { return undefined; }

  // Résolution des ressources
  const resourceSet = new Set(allResources);
  const selectedResources = selected.filter(s => resourceSet.has(s.label)).map(s => s.label);
  const hasFree = selected.some(s => s.label.startsWith('🔍'));
  const resources: ReviewResources = (hasFree || selectedResources.length === 0)
    ? { mode: 'free' }
    : { mode: 'constrained', files: selectedResources };

  // Résolution du scope fichiers
  let filesScope: string;
  if (autoFilesScope !== null) {
    filesScope = autoFilesScope;
  } else {
    const hasAll = selected.some(s => s.label.startsWith('📋'));
    if (hasAll) {
      filesScope = 'tous les fichiers section-*.html et slide-*.html';
    } else {
      const sectionSet = new Set(sectionFiles);
      const selectedFiles = selected.filter(s => sectionSet.has(s.label)).map(s => s.label);
      filesScope = selectedFiles.length > 0
        ? `les fichiers : ${selectedFiles.join(', ')}`
        : 'tous les fichiers section-*.html et slide-*.html';
    }
  }

  return { resources, filesScope };
}

/**
 * Ouvre le prompt dans un fichier temporaire dans l'éditeur VSCode.
 * Affiche une notification "Lancer ▶ / Annuler" non-modale pendant l'édition.
 * Retourne le contenu final du fichier, ou undefined si annulation.
 */
async function editPromptInEditor(basePrompt: string): Promise<string | undefined> {
  const tmpFile = path.join(os.tmpdir(), 'lkit-review-prompt.txt');
  fs.writeFileSync(tmpFile, basePrompt, 'utf-8');
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(tmpFile));
  await vscode.window.showTextDocument(doc, { preview: false });

  const choice = await vscode.window.showInformationMessage(
    '✏️  Modifiez le prompt ci-dessus, puis cliquez sur Lancer.',
    'Lancer ▶',
    'Annuler',
  );
  if (choice !== 'Lancer ▶') { return undefined; }
  return fs.readFileSync(tmpFile, 'utf-8').trim();
}

// ─── Helpers manifest ─────────────────────────────────────────────────────────

interface ManifestInfo {
  templateName: string;
  folderPath: string;
}

async function findManifests(): Promise<ManifestInfo[]> {
  const uris = await vscode.workspace.findFiles('**/.lkit-manifest.json', '**/node_modules/**');
  const results: ManifestInfo[] = [];
  for (const uri of uris) {
    const folderPath = path.dirname(uri.fsPath);
    try {
      const m = JSON.parse(fs.readFileSync(uri.fsPath, 'utf-8'));
      results.push({ templateName: m.templateName ?? 'inconnu', folderPath });
    } catch {
      results.push({ templateName: 'inconnu', folderPath });
    }
  }
  return results;
}

// ─── Commande sidebar ─────────────────────────────────────────────────────────

export async function applyWithAI(): Promise<void> {
  // 1. Manifests filtrés sur la présence d'un UPDATE.md
  const manifests = (await findManifests()).filter(m =>
    fs.existsSync(path.join(m.folderPath, 'UPDATE.md'))
  );

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  const items: vscode.QuickPickItem[] = manifests.map(m => {
    const relPath = workspaceRoot
      ? './' + path.relative(workspaceRoot.fsPath, m.folderPath).split(path.sep).join('/')
      : m.folderPath;
    return { label: m.templateName, description: relPath };
  });
  items.push({ label: '📁 Choisir un dossier manuellement...', description: '' });

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: manifests.length === 0
      ? 'Aucun UPDATE.md trouvé — choisir un dossier manuellement'
      : 'Sélectionner le document à appliquer',
    title: 'Learning Kit: Appliquer avec l\'IA',
  });
  if (!picked) { return; }

  let docFolder: string;

  if (picked.label.startsWith('📁')) {
    const uri = await vscode.window.showOpenDialog({
      canSelectFolders: true, canSelectFiles: false, canSelectMany: false,
      openLabel: 'Sélectionner le dossier du document',
    });
    if (!uri?.[0]) { return; }
    docFolder = uri[0].fsPath;
    if (!fs.existsSync(path.join(docFolder, 'UPDATE.md'))) {
      vscode.window.showWarningMessage('Aucun UPDATE.md dans ce dossier.');
      return;
    }
  } else {
    const match = manifests.find(m => {
      const relPath = workspaceRoot
        ? './' + path.relative(workspaceRoot.fsPath, m.folderPath).split(path.sep).join('/')
        : m.folderPath;
      return m.templateName === picked.label && relPath === picked.description;
    });
    docFolder = match?.folderPath ?? picked.description!;
  }

  await launchAI(docFolder);
}

// ─── Relire avec l'IA ─────────────────────────────────────────────────────────

const REVIEW_MODES = [
  {
    label: '🎨 Style',
    description: 'Vérifier le respect des conventions visuelles',
    task: (templateName: string, filesScope: string, exampleFile: string | null) => {
      const ref = exampleFile
        ? `${exampleFile} (référence visuelle de tous les composants du template)`
        : `PROMPT.md (structure du template)`;
      return (
        `Lis PROMPT.md pour comprendre les conventions et la structure du template '${templateName}'. ` +
        `Lis ${ref} pour identifier les patterns HTML attendus. ` +
        `Lis design/DESIGN_SYSTEM.md pour connaître toutes les classes CSS autorisées. ` +
        `Pour chaque fichier dans ${filesScope} : ` +
        `1) Vérifie que seules les classes CSS documentées dans DESIGN_SYSTEM.md sont utilisées — signale tout style inline ou classe inconnue. ` +
        `2) Vérifie que la structure HTML et les composants utilisés correspondent aux patterns de ${exampleFile ?? 'PROMPT.md'}. ` +
        `3) Corrige directement tout écart constaté. ` +
        `Liste les problèmes trouvés avant chaque correction.`
      );
    },
  },
  {
    label: '📝 Contenu',
    description: 'Enrichir : exemples, analogies, explications',
    task: (templateName: string, filesScope: string, exampleFile: string | null) => {
      const ref = exampleFile
        ? `${exampleFile} (catalogue de tous les composants disponibles pour enrichir la présentation)`
        : `PROMPT.md (structure et objectifs du template)`;
      return (
        `Lis PROMPT.md pour comprendre la structure et les objectifs pédagogiques du template '${templateName}'. ` +
        `Lis ${ref} pour savoir quels composants utiliser lors de l'enrichissement. ` +
        `Lis design/DESIGN_SYSTEM.md pour respecter les classes CSS existantes. ` +
        `Pour chaque section dans ${filesScope} : ` +
        `1) Vérifie l'exactitude et la complétude du contenu. ` +
        `2) Identifie les passages qui manquent d'exemples concrets, d'analogies ou d'explications intermédiaires. ` +
        `3) Enrichis le contenu directement : ajoute des exemples, analogies pédagogiques, détails explicatifs — ` +
        `en utilisant les composants de ${exampleFile ?? 'PROMPT.md'} quand ils améliorent la lisibilité (tip-box, callout, algo-block, etc.). ` +
        `Ne crée aucune classe CSS nouvelle — utilise uniquement celles documentées dans DESIGN_SYSTEM.md.`
      );
    },
  },
  {
    label: '📐 Schémas',
    description: 'Créer des diagrammes SVG pertinents',
    task: (templateName: string, filesScope: string, exampleFile: string | null) => {
      const ref = exampleFile
        ? `${exampleFile} pour comprendre le contexte visuel du template`
        : `PROMPT.md pour comprendre les conventions du template`;
      return (
        `Lis PROMPT.md pour comprendre les conventions du template '${templateName}'. ` +
        `Lis ${ref}. ` +
        `Lis design/DESIGN_SYSTEM.md pour les couleurs et tokens graphiques autorisés. ` +
        `Pour chaque concept dans ${filesScope} qui bénéficierait d'un schéma visuel (flux, architecture, comparaison, processus) : ` +
        `1) Identifie l'endroit précis dans le fichier HTML. ` +
        `2) Crée un SVG inline en utilisant UNIQUEMENT les couleurs de DESIGN_SYSTEM.md ` +
        `(accent: #d67556, muted: #9e9a94 ; stroke-width: 1.5 ; fill: none sur le SVG racine). ` +
        `3) Intègre le SVG directement dans le fichier HTML à l'endroit pertinent.`
      );
    },
  },
];

export async function reviewDocument(context: vscode.ExtensionContext): Promise<void> {
  // 1. Sélection du document
  const manifests = await findManifests();
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  const items: vscode.QuickPickItem[] = manifests.map(m => {
    const relPath = workspaceRoot
      ? './' + path.relative(workspaceRoot.fsPath, m.folderPath).split(path.sep).join('/')
      : m.folderPath;
    return {
      label: path.basename(m.folderPath),
      description: relPath,
      detail: m.templateName,
    };
  });
  items.push({ label: '📁 Choisir un dossier manuellement...', description: '' });

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Sélectionner le document à relire',
    title: 'Learning Kit: Relire avec l\'IA',
  });
  if (!picked) { return; }

  let docFolder: string;
  let templateName: string;

  if (picked.label.startsWith('📁')) {
    const uri = await vscode.window.showOpenDialog({
      canSelectFolders: true, canSelectFiles: false, canSelectMany: false,
      openLabel: 'Sélectionner le dossier du document',
    });
    if (!uri?.[0]) { return; }
    docFolder = uri[0].fsPath;
    try {
      const m = JSON.parse(fs.readFileSync(path.join(docFolder, '.lkit-manifest.json'), 'utf-8'));
      templateName = m.templateName ?? 'inconnu';
    } catch { templateName = 'inconnu'; }
  } else {
    const match = manifests.find(m => {
      const relPath = workspaceRoot
        ? './' + path.relative(workspaceRoot.fsPath, m.folderPath).split(path.sep).join('/')
        : m.folderPath;
      return relPath === picked.description;
    });
    docFolder = match?.folderPath ?? picked.description!;
    templateName = match?.templateName ?? picked.detail ?? 'inconnu';
  }

  // 2. Sélection du mode de relecture
  const mode = await vscode.window.showQuickPick(REVIEW_MODES, {
    placeHolder: 'Choisir le mode de relecture',
    title: 'Learning Kit: Mode de relecture',
  });
  if (!mode) { return; }

  // 3 & 4. Sélection combinée des ressources et des fichiers à traiter
  const exampleFile = findExampleFile(docFolder);
  const defaultResources = [
    'PROMPT.md',
    ...(exampleFile ? [exampleFile] : []),
    'design/DESIGN_SYSTEM.md',
  ];
  const selection = await selectResourcesAndFiles(docFolder, defaultResources);
  if (selection === undefined) { return; }
  const { resources, filesScope } = selection;

  // 5. Construire et éditer le prompt dans l'éditeur
  const resourcesPreamble = resources.mode === 'constrained'
    ? `Lis les fichiers suivants : ${resources.files.join(', ')}. `
    : '';
  const basePrompt = resourcesPreamble + mode.task(templateName, filesScope, exampleFile);
  const prompt = await editPromptInEditor(basePrompt);
  if (prompt === undefined) { return; }

  // 6. Lancer le terminal
  const tool = await resolveAiTool();
  if (!tool) { return; }

  const terminal = vscode.window.createTerminal({
    name: `Learning Kit — Relecture ${mode.label}`,
    cwd: docFolder,
  });
  terminal.show();
  terminal.sendText(`${tool} "${prompt.replace(/"/g, '\\"')}"`);
}

// ─── Démarrer avec l'IA ───────────────────────────────────────────────────────

export async function launchAISession(context: vscode.ExtensionContext): Promise<void> {
  // 1. Sélection du document
  const manifests = await findManifests();
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  const items: vscode.QuickPickItem[] = manifests.map(m => {
    const relPath = workspaceRoot
      ? './' + path.relative(workspaceRoot.fsPath, m.folderPath).split(path.sep).join('/')
      : m.folderPath;
    return { label: m.templateName, description: relPath };
  });
  items.push({ label: '📁 Choisir un dossier manuellement...', description: '' });

  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Sélectionner le document sur lequel travailler',
    title: 'Learning Kit: Démarrer avec l\'IA',
  });
  if (!picked) { return; }

  let docFolder: string;
  let templateName: string;

  if (picked.label.startsWith('📁')) {
    const uri = await vscode.window.showOpenDialog({
      canSelectFolders: true, canSelectFiles: false, canSelectMany: false,
      openLabel: 'Sélectionner le dossier du document',
    });
    if (!uri?.[0]) { return; }
    docFolder = uri[0].fsPath;
    const manifestPath = path.join(docFolder, '.lkit-manifest.json');
    try {
      const m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      templateName = m.templateName ?? 'inconnu';
    } catch {
      templateName = 'inconnu';
    }
  } else {
    const match = manifests.find(m => {
      const relPath = workspaceRoot
        ? './' + path.relative(workspaceRoot.fsPath, m.folderPath).split(path.sep).join('/')
        : m.folderPath;
      return m.templateName === picked.label && relPath === picked.description;
    });
    docFolder = match?.folderPath ?? picked.description!;
    templateName = picked.label;
  }

  // 2. Logique progressive via PLAN.md
  const planPath = path.join(docFolder, 'PLAN.md');
  const planExists = fs.existsSync(planPath);

  if (planExists) {
    // ── Reprise ──────────────────────────────────────────────────────────────
    const remaining = countRemainingTasks(planPath);
    const next = findNextPlanTask(planPath);

    if (!next) {
      vscode.window.showInformationMessage('✓ Toutes les sections du PLAN.md ont été créées.');
      return;
    }

    const resumeItems = [
      { label: `▶ Continuer (${remaining} section(s) restante(s))`, description: `Prochaine : ${next.file}` },
      { label: '↺ Recommencer depuis zéro', description: 'Supprime PLAN.md et repart de l\'analyse' },
    ];
    const resumePick = await vscode.window.showQuickPick(resumeItems, {
      title: 'Learning Kit: Démarrer avec l\'IA',
      placeHolder: 'Un PLAN.md existe dans ce dossier',
    });
    if (!resumePick) { return; }

    if (resumePick.label.startsWith('↺')) {
      fs.unlinkSync(planPath);
      return launchAISession(context);
    }

    // Continuer : ressources + prompt éditable
    const resources = await selectResources(docFolder, ['PROMPT.md']);
    if (resources === undefined) { return; }
    const resourcesPreamble = resources.mode === 'constrained'
      ? `Lis les fichiers suivants : ${resources.files.join(', ')}. `
      : '';
    const basePrompt =
      `${resourcesPreamble}Tu travailles sur un template '${templateName}'. ` +
      `MISSION (cette session uniquement) : créer le fichier \`${next.file}\` — ${next.description}. ` +
      `Respecte strictement les patterns de PROMPT.md. ` +
      `Après avoir créé le fichier, coche la tâche dans PLAN.md : remplace \`- [ ] ${next.file}\` par \`- [x] ${next.file}\`. ` +
      `Arrête-toi après cette unique tâche. Ne crée pas d'autres fichiers.`;
    const prompt = await editPromptInEditor(basePrompt);
    if (prompt === undefined) { return; }

    const tool = await resolveAiTool();
    if (!tool) { return; }
    const terminal = vscode.window.createTerminal({ name: 'Learning Kit — Session IA', cwd: docFolder });
    terminal.show();
    terminal.sendText(`${tool} "${prompt.replace(/"/g, '\\"')}"`);

  } else {
    // ── Première session ──────────────────────────────────────────────────────
    const modeItems = [
      { label: '📋 Mode progressif (recommandé)', description: 'Planifie d\'abord, puis crée section par section' },
      { label: '⚡ Mode direct', description: 'Tout en une session' },
    ];
    const modePick = await vscode.window.showQuickPick(modeItems, {
      title: 'Learning Kit: Démarrer avec l\'IA',
      placeHolder: 'Choisir le mode de travail',
    });
    if (!modePick) { return; }

    // Ressources (commun aux deux modes)
    const defaultRes = modePick.label.startsWith('📋') ? ['PROMPT.md'] : ['PROMPT.md', 'CLAUDE.md'];
    const resources = await selectResources(docFolder, defaultRes);
    if (resources === undefined) { return; }
    const resourcesPreamble = resources.mode === 'constrained'
      ? `Lis les fichiers suivants : ${resources.files.join(', ')}. `
      : '';

    let basePrompt: string;

    if (modePick.label.startsWith('📋')) {
      // Phase 1 : créer PLAN.md uniquement — pas de sélection de fichiers de travail
      basePrompt =
        `${resourcesPreamble}Tu travailles sur un template '${templateName}'. ` +
        `MISSION (cette session uniquement) : planifier la structure du document. ` +
        `1) Analyse PROMPT.md pour comprendre les composants disponibles et la structure attendue. ` +
        `2) Crée UNIQUEMENT le fichier PLAN.md avec la liste de toutes les sections à créer, ` +
        `une section par ligne au format : \`- [ ] section-xxx.html — [titre] : [description en 1 ligne]\`. ` +
        `Ordonne les sections dans l'ordre logique du document. ` +
        `3) N'écris aucun fichier HTML. Arrête-toi après avoir créé PLAN.md.`;
    } else {
      // Mode direct : sélection des fichiers de travail existants
      const filesScope = await selectWorkingFiles(docFolder);
      if (filesScope === undefined) { return; }
      basePrompt =
        `${resourcesPreamble}Tu travailles sur un template '${templateName}'. ` +
        `Travaille sur ${filesScope}. Pose-moi des questions si besoin.`;
    }

    const prompt = await editPromptInEditor(basePrompt);
    if (prompt === undefined) { return; }

    const tool = await resolveAiTool();
    if (!tool) { return; }
    const terminal = vscode.window.createTerminal({ name: 'Learning Kit — Session IA', cwd: docFolder });
    terminal.show();
    terminal.sendText(`${tool} "${prompt.replace(/"/g, '\\"')}"`);
  }
}
