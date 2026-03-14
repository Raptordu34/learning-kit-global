import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { readVersions, readChangelog } from './cache';
import { launchAI } from './applyWithAI';
import { compareSemver } from './semver';
import { getUpdateEntries } from './changelogParser';

interface LkitManifest {
  templateName: string;
  templateVersion?: string;
  version?: string; // legacy key — treated as templateVersion
  createdAt: string;
}

interface ManifestPickItem extends vscode.QuickPickItem {
  manifestUri: vscode.Uri;
  manifest: LkitManifest;
  resolvedVersion: string;
  docFolder: string;
}

export async function updateDocument(context: vscode.ExtensionContext): Promise<void> {
  // 1. Scan workspace for .lkit-manifest.json files
  const found = await vscode.workspace.findFiles(
    '**/.lkit-manifest.json',
    '**/node_modules/**'
  );

  if (found.length === 0) {
    vscode.window.showInformationMessage(
      'Aucun document Learning Kit trouvé dans le workspace.'
    );
    return;
  }

  // 2. Build Quick Pick items (skip unreadable manifests)
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  const picks: ManifestPickItem[] = [];

  for (const uri of found) {
    let manifest: LkitManifest;
    try {
      manifest = JSON.parse(fs.readFileSync(uri.fsPath, 'utf-8')) as LkitManifest;
    } catch {
      continue;
    }

    // Backwards compat: old 'version' key treated as templateVersion
    const resolvedVersion = manifest.templateVersion ?? manifest.version ?? '1.0.0';
    const docFolder = path.dirname(uri.fsPath);
    const relPath = workspaceRoot
      ? './' + path.relative(workspaceRoot.fsPath, docFolder).split(path.sep).join('/')
      : docFolder;

    picks.push({
      label: `${manifest.templateName}  v${resolvedVersion}`,
      description: relPath,
      manifestUri: uri,
      manifest,
      resolvedVersion,
      docFolder
    });
  }

  if (picks.length === 0) {
    vscode.window.showWarningMessage('Aucun fichier .lkit-manifest.json lisible trouvé.');
    return;
  }

  // 3. User selects a document
  const selected = await vscode.window.showQuickPick(picks, {
    placeHolder: 'Sélectionnez un document à mettre à jour',
    title: 'Learning Kit: Mettre à jour un document'
  });
  if (!selected) { return; }

  // 4. Read versions.json from cache
  const versions = readVersions(context);
  if (!versions) {
    vscode.window.showErrorMessage(
      'Impossible de lire versions.json. Synchronisez les templates d\'abord (bouton ⟳).'
    );
    return;
  }

  const { templateName } = selected.manifest;
  const latestVersion = versions[templateName];

  if (!latestVersion) {
    vscode.window.showWarningMessage(
      `Template "${templateName}" introuvable dans versions.json.`
    );
    return;
  }

  // 5. Compare versions
  if (compareSemver(selected.resolvedVersion, latestVersion) >= 0) {
    vscode.window.showInformationMessage(
      `Ce document est déjà à la dernière version (v${latestVersion}).`
    );
    return;
  }

  // 6. Check for existing UPDATE.md — ask before overwriting
  const updateMdPath = path.join(selected.docFolder, 'UPDATE.md');
  if (fs.existsSync(updateMdPath)) {
    const choice = await vscode.window.showWarningMessage(
      'Un UPDATE.md existe déjà dans ce projet. Écraser ?',
      'Écraser',
      'Annuler'
    );
    if (choice !== 'Écraser') { return; }
  }

  // 7. Parse CHANGELOG and collect update entries
  const changelogContent = readChangelog(context);
  const entries = changelogContent
    ? getUpdateEntries(changelogContent, templateName, selected.resolvedVersion, latestVersion)
    : [];

  // 8. Build UPDATE.md content
  let updateContent =
    `# Mise à jour requise — ${templateName} v${selected.resolvedVersion} → v${latestVersion}\n\n` +
    `Ce document a été créé avec le template \`${templateName}\` v${selected.resolvedVersion}.\n` +
    `Le template a été mis à jour vers la v${latestVersion}.\n\n` +
    `Applique les modifications suivantes à ce projet :\n\n`;

  if (entries.length > 0) {
    for (const entry of entries) {
      updateContent += `## Changements v${entry.version}\n`;
      for (const line of entry.lines) {
        updateContent += `${line}\n`;
      }
      updateContent += '\n';
    }
  } else {
    updateContent += `_Aucun détail de changement disponible pour cette version._\n\n`;
  }

  updateContent += `---\nUne fois les modifications appliquées, supprime ce fichier UPDATE.md.\n`;

  // 9. Write UPDATE.md
  fs.writeFileSync(updateMdPath, updateContent, 'utf-8');

  // 10. Update manifest templateVersion (and remove legacy 'version' key)
  const updatedManifest: Record<string, unknown> = {
    templateName: selected.manifest.templateName,
    templateVersion: latestVersion,
    createdAt: selected.manifest.createdAt
  };
  fs.writeFileSync(
    selected.manifestUri.fsPath,
    JSON.stringify(updatedManifest, null, 2),
    'utf-8'
  );

  // 11. Open UPDATE.md in editor
  const updateUri = vscode.Uri.file(updateMdPath);
  await vscode.window.showTextDocument(updateUri);
  const action = await vscode.window.showInformationMessage(
    'Instructions générées dans UPDATE.md.',
    'Lancer l\'IA'
  );
  if (action === 'Lancer l\'IA') {
    await launchAI(selected.docFolder);
  }
}
