import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { bundleDocument } from './htmlBundler';

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

export async function shareDocument(_context: vscode.ExtensionContext): Promise<void> {
  // 1. Scan manifests
  const manifests = await findManifests();
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;

  const items: vscode.QuickPickItem[] = manifests.map(m => {
    const relPath = workspaceRoot
      ? './' + path.relative(workspaceRoot.fsPath, m.folderPath).split(path.sep).join('/')
      : m.folderPath;
    return { label: m.templateName, description: relPath };
  });
  items.push({ label: '📁 Choisir un dossier manuellement...', description: '' });

  // 2. QuickPick
  const picked = await vscode.window.showQuickPick(items, {
    placeHolder: 'Sélectionner le document à exporter',
    title: 'Learning Kit: Partager un document',
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
  } else {
    const match = manifests.find(m => {
      const relPath = workspaceRoot
        ? './' + path.relative(workspaceRoot.fsPath, m.folderPath).split(path.sep).join('/')
        : m.folderPath;
      return m.templateName === picked.label && relPath === picked.description;
    });
    docFolder = match?.folderPath ?? picked.description!;
  }

  // 3. Resolve output path
  const outputPath = path.join(
    path.dirname(docFolder),
    path.basename(docFolder) + '-shared.html'
  );

  // 4. Confirm overwrite if file exists
  if (fs.existsSync(outputPath)) {
    const choice = await vscode.window.showWarningMessage(
      `"${path.basename(outputPath)}" existe déjà. Écraser ?`,
      { modal: true },
      'Écraser'
    );
    if (choice !== 'Écraser') { return; }
  }

  // 5. Bundle and write
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Learning Kit: Export en cours...',
      cancellable: false,
    },
    async () => {
      const html = await bundleDocument(docFolder);
      fs.writeFileSync(outputPath, html, 'utf-8');
    }
  );

  // 6. Notify
  const choice = await vscode.window.showInformationMessage(
    `Export réussi : ${path.basename(outputPath)}`,
    'Ouvrir'
  );
  if (choice === 'Ouvrir') {
    await vscode.env.openExternal(vscode.Uri.file(outputPath));
  }
}
