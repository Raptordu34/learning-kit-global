import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

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

/** Retourne les chemins relatifs de tous les fichiers ressources détectés dans docFolder. */
function findResourceFiles(docFolder: string): string[] {
  const candidates: string[] = [];
  for (const f of ['PROMPT.md', 'CLAUDE.md']) {
    if (fs.existsSync(path.join(docFolder, f))) { candidates.push(f); }
  }
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

type ResourcesSelection =
  | { mode: 'free' }
  | { mode: 'constrained'; files: string[] }
  | undefined; // annulation (Echap)

/**
 * QuickPick multi-select sur les fichiers ressources.
 * - Rien coché ou item "Libre" → mode libre (l'IA explore elle-même).
 * - Fichiers cochés → mode contraint (preamble "Lis les fichiers suivants").
 * - Echap → undefined (annulation).
 */
async function selectResources(
  docFolder: string,
  defaultKeys: string[],
): Promise<ResourcesSelection> {
  const all = findResourceFiles(docFolder);
  if (all.length === 0) { return { mode: 'free' }; }

  const freeItem: vscode.QuickPickItem = {
    label: '🔍 Libre — l\'IA explore par elle-même',
    description: 'Aucune contrainte de lecture — l\'IA choisit les fichiers pertinents',
    picked: false,
  };
  const items: vscode.QuickPickItem[] = [
    freeItem,
    ...all.map(f => ({
      label: f,
      picked: defaultKeys.some(d => f === d || f.startsWith(d)),
    })),
  ];
  const selected = await vscode.window.showQuickPick(items, {
    title: 'Learning Kit: Fichiers ressources',
    placeHolder: 'Sélectionner les fichiers à lire, ou laisser tout décoché pour le mode libre',
    canPickMany: true,
  });
  if (selected === undefined) { return undefined; }
  if (selected.length === 0 || selected.some(s => s.label.startsWith('🔍'))) {
    return { mode: 'free' };
  }
  return { mode: 'constrained', files: selected.map(s => s.label) };
}

/**
 * QuickPick multi-select sur les fichiers section-*.html / slide-*.html.
 * Retourne une chaîne décrivant le scope, ou undefined si annulation.
 * Si aucun fichier n'existe, retourne directement le scope générique.
 */
async function selectWorkingFiles(docFolder: string): Promise<string | undefined> {
  let sectionFiles: string[] = [];
  try {
    sectionFiles = fs.readdirSync(docFolder)
      .filter(f => /^(section|slide)-.*\.html$/.test(f))
      .sort();
  } catch { /* dossier inaccessible */ }

  if (sectionFiles.length === 0) {
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
  if (selected.some(s => s.label.startsWith('📋'))) {
    return 'tous les fichiers section-*.html et slide-*.html';
  }
  return `les fichiers : ${selected.map(s => s.label).join(', ')}`;
}

/**
 * InputBox pré-remplie avec basePrompt — l'utilisateur peut tout modifier.
 * Retourne undefined si annulation (Echap).
 */
async function editPrompt(basePrompt: string): Promise<string | undefined> {
  return vscode.window.showInputBox({
    title: 'Learning Kit: Prompt final',
    prompt: 'Modifiez ou complétez le prompt avant le lancement',
    value: basePrompt,
    valueSelection: [basePrompt.length, basePrompt.length],
    ignoreFocusOut: true,
  });
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
    defaultResources: ['design/DESIGN_SYSTEM.md'],
    task: (templateName: string, filesScope: string) =>
      `Pour chaque fichier dans ${filesScope} : ` +
      `1) Vérifie que seules les classes CSS documentées dans DESIGN_SYSTEM.md sont utilisées. ` +
      `2) Signale tout style inline non documenté. ` +
      `3) Vérifie que la structure HTML respecte les patterns du template '${templateName}'. ` +
      `Liste les problèmes par fichier, puis corrige-les directement.`,
  },
  {
    label: '📝 Contenu',
    description: 'Enrichir : exemples, analogies, explications',
    defaultResources: ['CLAUDE.md'],
    task: (_templateName: string, filesScope: string) =>
      `Pour chaque section dans ${filesScope} : ` +
      `1) Vérifie l'exactitude et la complétude du contenu. ` +
      `2) Identifie les passages qui manquent d'exemples concrets, d'analogies ou d'explications intermédiaires. ` +
      `3) Enrichis le contenu directement : ajoute des exemples, analogies pédagogiques, détails explicatifs. ` +
      `Respecte strictement les classes CSS existantes — ne crée aucun style nouveau.`,
  },
  {
    label: '📐 Schémas',
    description: 'Créer des diagrammes SVG pertinents',
    defaultResources: ['design/svg/'],
    task: (_templateName: string, filesScope: string) =>
      `Pour chaque concept dans ${filesScope} qui bénéficierait d'un schéma visuel (flux, architecture, comparaison, processus) : ` +
      `1) Identifie l'endroit précis dans le fichier. ` +
      `2) Crée un SVG inline en utilisant UNIQUEMENT les composants du catalogue ` +
      `(couleurs: #d67556 accent, #9e9a94 muted ; stroke-width: 1.5 ; fill: none sur le SVG racine). ` +
      `3) Intègre le SVG directement dans le fichier HTML à l'endroit pertinent.`,
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
    return { label: m.templateName, description: relPath };
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
      return m.templateName === picked.label && relPath === picked.description;
    });
    docFolder = match?.folderPath ?? picked.description!;
    templateName = picked.label;
  }

  // 2. Sélection du mode de relecture
  const mode = await vscode.window.showQuickPick(REVIEW_MODES, {
    placeHolder: 'Choisir le mode de relecture',
    title: 'Learning Kit: Mode de relecture',
  });
  if (!mode) { return; }

  // 3. Sélection des ressources
  const resources = await selectResources(docFolder, mode.defaultResources);
  if (resources === undefined) { return; }

  // 4. Sélection des fichiers à traiter
  const filesScope = await selectWorkingFiles(docFolder);
  if (filesScope === undefined) { return; }

  // 5. Construire et éditer le prompt
  const resourcesPreamble = resources.mode === 'constrained'
    ? `Lis les fichiers suivants : ${resources.files.join(', ')}. `
    : '';
  const basePrompt = resourcesPreamble + mode.task(templateName, filesScope);
  const prompt = await editPrompt(basePrompt);
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
    const prompt = await editPrompt(basePrompt);
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

    const prompt = await editPrompt(basePrompt);
    if (prompt === undefined) { return; }

    const tool = await resolveAiTool();
    if (!tool) { return; }
    const terminal = vscode.window.createTerminal({ name: 'Learning Kit — Session IA', cwd: docFolder });
    terminal.show();
    terminal.sendText(`${tool} "${prompt.replace(/"/g, '\\"')}"`);
  }
}
