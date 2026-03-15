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

interface UpdateMdPickItem extends vscode.QuickPickItem {
  docFolder: string;
}

export async function applyWithAI(): Promise<void> {
  // 1. Chercher les .lkit-manifest.json dans le workspace
  const manifests = await vscode.workspace.findFiles(
    '**/.lkit-manifest.json',
    '**/node_modules/**'
  );

  if (manifests.length === 0) {
    vscode.window.showInformationMessage(
      'Aucun document Learning Kit trouvé dans le workspace.'
    );
    return;
  }

  // 2. Garder seulement les dossiers qui ont un UPDATE.md
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  const picks: UpdateMdPickItem[] = [];

  for (const uri of manifests) {
    const docFolder = path.dirname(uri.fsPath);
    if (!fs.existsSync(path.join(docFolder, 'UPDATE.md'))) { continue; }

    const relPath = workspaceRoot
      ? './' + path.relative(workspaceRoot.fsPath, docFolder).split(path.sep).join('/')
      : docFolder;

    picks.push({ label: relPath, description: 'UPDATE.md présent', docFolder });
  }

  if (picks.length === 0) {
    vscode.window.showInformationMessage(
      'Aucun UPDATE.md trouvé. Générez-en un via "Mettre à jour" ou "Adopter".'
    );
    return;
  }

  // 3. Si un seul résultat, pas de QuickPick
  const selected = picks.length === 1
    ? picks[0]
    : await vscode.window.showQuickPick(picks, {
        placeHolder: 'Sélectionnez le document à traiter',
        title: 'Learning Kit: Appliquer avec l\'IA'
      });

  if (!selected) { return; }

  await launchAI(selected.docFolder);
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
