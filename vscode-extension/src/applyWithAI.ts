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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    prompt: (templateName: string) =>
      `Lis design/DESIGN_SYSTEM.md et tous les fichiers section-*.html (et slide-*.html) de ce dossier. ` +
      `Pour chaque fichier de contenu : ` +
      `1) Vérifie que seules les classes CSS documentées dans DESIGN_SYSTEM.md sont utilisées. ` +
      `2) Signale tout style inline non documenté. ` +
      `3) Vérifie que la structure HTML respecte les patterns du template '${templateName}'. ` +
      `Liste les problèmes par fichier, puis corrige-les directement.`,
  },
  {
    label: '📝 Contenu',
    description: 'Enrichir : exemples, analogies, explications',
    prompt: (_templateName: string) =>
      `Lis CLAUDE.md pour le contexte, puis tous les fichiers section-*.html de ce dossier. ` +
      `Pour chaque section : ` +
      `1) Vérifie l'exactitude et la complétude du contenu. ` +
      `2) Identifie les passages qui manquent d'exemples concrets, d'analogies ou d'explications intermédiaires. ` +
      `3) Enrichis le contenu directement : ajoute des exemples, analogies pédagogiques, détails explicatifs. ` +
      `Respecte strictement les classes CSS existantes — ne crée aucun style nouveau.`,
  },
  {
    label: '📐 Schémas',
    description: 'Créer des diagrammes SVG pertinents',
    prompt: (_templateName: string) =>
      `Lis design/svg/CATALOG.md et les fichiers du catalogue dans design/svg/ (arrows.md, nodes.md, arch.md, callouts.md, charts.md, braces.md, lines.md), ` +
      `puis lis tous les fichiers section-*.html de ce dossier. ` +
      `Pour chaque concept qui bénéficierait d'un schéma visuel (flux, architecture, comparaison, processus) : ` +
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

  // 3. Lancer le terminal
  const tool = await resolveAiTool();
  if (!tool) { return; }

  const prompt = mode.prompt(templateName);
  const terminal = vscode.window.createTerminal({
    name: `Learning Kit — Relecture ${mode.label}`,
    cwd: docFolder,
  });
  terminal.show();
  terminal.sendText(`${tool} "${prompt.replace(/"/g, '\\"')}"`);
}

// ─── Démarrer avec l'IA ───────────────────────────────────────────────────────

export async function launchAISession(context: vscode.ExtensionContext): Promise<void> {
  // 1. Scan + QuickPick
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
    // description holds the relative path; find the matching manifest by templateName
    const match = manifests.find(m => {
      const relPath = workspaceRoot
        ? './' + path.relative(workspaceRoot.fsPath, m.folderPath).split(path.sep).join('/')
        : m.folderPath;
      return m.templateName === picked.label && relPath === picked.description;
    });
    docFolder = match?.folderPath ?? picked.description!;
    templateName = picked.label;
  }

  // 2. InputBox précisions
  const extra = await vscode.window.showInputBox({
    prompt: 'Précisions pour l\'IA (optionnel — appuyer sur Entrée pour ignorer)',
    placeHolder: 'ex: Cours d\'algèbre linéaire, niveau L2, 6 sections',
  });
  if (extra === undefined) { return; }  // Escape = annuler

  // 3. Construire le prompt
  const precisions = extra.trim() ? ` ${extra.trim()}.` : '';
  const prompt =
    `Lis PROMPT.md dans ce dossier. Tu travailles sur un template '${templateName}'.` +
    `${precisions} Pose-moi des questions si besoin.`;

  // 4. Lancer le terminal
  const tool = await resolveAiTool();
  if (!tool) { return; }

  const terminal = vscode.window.createTerminal({
    name: 'Learning Kit — Session IA',
    cwd: docFolder,
  });
  terminal.show();
  terminal.sendText(`${tool} "${prompt.replace(/"/g, '\\"')}"`);
}
