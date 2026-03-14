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
