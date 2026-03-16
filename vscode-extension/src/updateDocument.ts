import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { readVersions, readChangelog, getCachePath, cacheExists } from './cache';
import { launchAI } from './applyWithAI';
import { compareSemver } from './semver';
import { getUpdateEntries } from './changelogParser';
import * as aiInstructions from './aiInstructions';
import * as pathPatcher from './pathPatcher';
import { hashFile, computeInfraHashes } from './fileHasher';

interface LkitManifest {
  templateName: string;
  templateVersion?: string;
  version?: string; // legacy key — treated as templateVersion
  createdAt: string;
  fileHashes?: Record<string, string>;
}

interface ManifestPickItem extends vscode.QuickPickItem {
  manifestUri: vscode.Uri;
  manifest: LkitManifest;
  resolvedVersion: string;
  docFolder: string;
}

/** Resolve kitUri the same way createDocument does */
async function resolveKitUri(context: vscode.ExtensionContext): Promise<vscode.Uri | null> {
  const cfg = vscode.workspace.getConfiguration('learningKit');
  const sourcePath = cfg.get<string>('sourcePath', '');
  if (sourcePath) {
    return vscode.Uri.file(path.join(sourcePath, 'learning-kit'));
  }
  if (await cacheExists(context)) {
    return getCachePath(context);
  }
  return null;
}

/**
 * Update infra files from the kit source, using stored hashes to detect
 * user modifications. Shows a dialog per file when user has modified it.
 * Returns the updated fileHashes record.
 */
async function updateInfraFiles(
  kitUri: vscode.Uri,
  templateName: string,
  docFolder: string,
  storedHashes: Record<string, string>
): Promise<Record<string, string>> {
  const templateSrcUri = vscode.Uri.joinPath(kitUri, 'templates', templateName);
  const designSrcUri = vscode.Uri.joinPath(kitUri, 'design');
  const layoutsSrcUri = vscode.Uri.joinPath(kitUri, 'layouts');

  // Files excluded from infra update at root level
  const ROOT_EXCLUDES = new Set([
    '.lkit-manifest.json',
    'CLAUDE.md',
    'GEMINI.md',
    'copilot-instructions.md',
    'UPDATE.md',
    'PLAN.md',
    'ressources',
    'index.html'
  ]);

  // Collect { relPath, srcPath } for all infra files to update
  const infraFiles: Array<{ relPath: string; srcPath: string }> = [];

  // Root template files
  try {
    const entries = await vscode.workspace.fs.readDirectory(templateSrcUri);
    for (const [name, type] of entries) {
      if (type !== vscode.FileType.File) { continue; }
      if (ROOT_EXCLUDES.has(name)) { continue; }
      if (/^section-.+\.html$/.test(name)) { continue; }
      infraFiles.push({
        relPath: name,
        srcPath: vscode.Uri.joinPath(templateSrcUri, name).fsPath
      });
    }
  } catch {
    // Template folder not readable
  }

  // design/ files
  async function collectDir(srcDirUri: vscode.Uri, relPrefix: string): Promise<void> {
    let entries: [string, vscode.FileType][];
    try {
      entries = await vscode.workspace.fs.readDirectory(srcDirUri);
    } catch {
      return;
    }
    for (const [name, type] of entries) {
      const childUri = vscode.Uri.joinPath(srcDirUri, name);
      const relPath = relPrefix + '/' + name;
      if (type === vscode.FileType.Directory) {
        await collectDir(childUri, relPath);
      } else if (type === vscode.FileType.File) {
        infraFiles.push({ relPath, srcPath: childUri.fsPath });
      }
    }
  }

  await collectDir(designSrcUri, 'design');
  await collectDir(layoutsSrcUri, 'layouts');

  // Process each infra file
  for (const { relPath, srcPath } of infraFiles) {
    const dstPath = path.join(docFolder, relPath.split('/').join(path.sep));
    const newHash = hashFile(srcPath);
    const currentHash = hashFile(dstPath);

    // File unchanged vs new template → nothing to do
    if (currentHash === newHash) { continue; }

    const storedHash = storedHashes[relPath];

    if (storedHash && currentHash === storedHash) {
      // User has NOT modified the file — replace silently
      fs.mkdirSync(path.dirname(dstPath), { recursive: true });
      fs.copyFileSync(srcPath, dstPath);
    } else {
      // User may have modified the file (or no stored hash) → ask
      const choice = await vscode.window.showQuickPick(
        [
          { label: '$(check) Garder le fichier actuel', action: 'keep' },
          { label: '$(arrow-right) Remplacer par la nouvelle version', action: 'replace' },
          { label: '$(copy) Backup (.backup) puis remplacer', action: 'backup' }
        ],
        {
          title: `Fichier modifié : ${relPath}`,
          placeHolder: 'Ce fichier a été modifié localement. Que faire ?'
        }
      );

      if (!choice || choice.action === 'keep') {
        continue;
      }

      if (choice.action === 'backup') {
        const backupPath = dstPath + '.backup';
        if (fs.existsSync(dstPath)) {
          fs.copyFileSync(dstPath, backupPath);
        }
      }

      fs.mkdirSync(path.dirname(dstPath), { recursive: true });
      fs.copyFileSync(srcPath, dstPath);
    }
  }

  // Patch paths in root CSS/HTML files (e.g. ../../design/ → ./design/)
  const projectUri = vscode.Uri.file(docFolder);
  await pathPatcher.patchPaths(projectUri);

  // Recompute all infra hashes after replacements
  return await computeInfraHashes(projectUri);
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

  // 6.5 Update infrastructure files
  const kitUri = await resolveKitUri(context);
  if (kitUri) {
    const storedHashes = selected.manifest.fileHashes ?? {};
    const updatedHashes = await updateInfraFiles(
      kitUri,
      templateName,
      selected.docFolder,
      storedHashes
    );

    // Regenerate AI instruction files (always, no dialog needed)
    const projectUri = vscode.Uri.file(selected.docFolder);
    await aiInstructions.generate(projectUri, templateName);

    // Persist updated hashes in manifest (version updated below)
    selected.manifest.fileHashes = updatedHashes;
  } else {
    vscode.window.showWarningMessage(
      'Kit source introuvable — les fichiers d\'infrastructure n\'ont pas été mis à jour.'
    );
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
  if (selected.manifest.fileHashes) {
    updatedManifest['fileHashes'] = selected.manifest.fileHashes;
  }
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
