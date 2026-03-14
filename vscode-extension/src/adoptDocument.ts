import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { readVersions, readChangelog, getCachePath } from './cache';
import { compareSemver } from './semver';
import { parseChangelog, getUpdateEntries } from './changelogParser';

export async function adoptDocument(context: vscode.ExtensionContext): Promise<void> {
  // 1. Read versions.json
  const versions = readVersions(context);
  if (!versions) {
    vscode.window.showErrorMessage(
      'Impossible de lire versions.json. Synchronisez les templates d\'abord (bouton ⟳).'
    );
    return;
  }

  // 2. User picks a folder
  const chosen = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    title: 'Learning Kit: Sélectionnez le dossier du document à adopter'
  });
  if (!chosen || chosen.length === 0) { return; }
  const docFolder = chosen[0].fsPath;

  // 3. Check no existing manifest
  const manifestPath = path.join(docFolder, '.lkit-manifest.json');
  if (fs.existsSync(manifestPath)) {
    vscode.window.showWarningMessage(
      'Ce document a déjà un manifeste. Utilisez \'Mettre à jour\'.'
    );
    return;
  }

  // 4. QuickPick template
  const templateNames = Object.keys(versions);
  const templateName = await vscode.window.showQuickPick(templateNames, {
    placeHolder: 'Sélectionnez le template de ce document',
    title: 'Learning Kit: Choisir un template'
  });
  if (!templateName) { return; }

  const latestVersion = versions[templateName];

  // 5. QuickPick version — 0.0.0 sentinel first, then parsed versions descending
  const changelogContent = readChangelog(context);
  const parsedVersions = changelogContent
    ? parseChangelog(changelogContent, templateName)
    : [];

  const versionItems: vscode.QuickPickItem[] = [
    { label: '0.0.0', description: '(pré-versioning — structure à revoir)' }
  ];

  if (parsedVersions.length > 0) {
    const sorted = [...parsedVersions].sort((a, b) => compareSemver(b.version, a.version));
    for (const entry of sorted) {
      versionItems.push({ label: `v${entry.version}` });
    }
  } else {
    versionItems.push({ label: `v${latestVersion}` });
  }

  const selectedItem = await vscode.window.showQuickPick(versionItems, {
    placeHolder: 'Version du template utilisée lors de la création de ce document',
    title: 'Learning Kit: Version du template'
  });
  if (!selectedItem) { return; }

  const selectedVersion = selectedItem.label.replace(/^v/, '');

  // 6. Write .lkit-manifest.json
  const manifestContent = {
    templateName,
    templateVersion: selectedVersion,
    createdAt: new Date().toISOString()
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifestContent, null, 2), 'utf-8');

  // 7. Compare selectedVersion with latestVersion
  if (compareSemver(selectedVersion, latestVersion) >= 0) {
    vscode.window.showInformationMessage(
      'Document adopté à la dernière version — aucune mise à jour nécessaire.'
    );
    return;
  }

  // 8. Generate UPDATE.md
  const updateMdPath = path.join(docFolder, 'UPDATE.md');

  // Check if UPDATE.md already exists
  if (fs.existsSync(updateMdPath)) {
    const choice = await vscode.window.showWarningMessage(
      'Un UPDATE.md existe déjà dans ce projet. Écraser ?',
      'Écraser',
      'Annuler'
    );
    if (choice !== 'Écraser') { return; }
  }

  let updateContent: string;

  if (selectedVersion === '0.0.0') {
    // Pre-versioning: full changelog from v1.0.0 onwards
    const entries = changelogContent
      ? getUpdateEntries(changelogContent, templateName, '0.0.0', latestVersion)
      : [];

    const templateRefPath = path.join(getCachePath(context).fsPath, 'templates', templateName);

    updateContent =
      `# Adoption — ${templateName} (document pré-versioning) → v${latestVersion}\n\n` +
      `Ce document a été créé **avant le système de versioning** du Learning Kit (antérieur à v1.0.0).\n` +
      `La structure du template a pu évoluer depuis sa création.\n\n` +
      `## Action 1 — Revue de structure complète\n\n` +
      `Ce document est antérieur à la v1.0.0. En plus des changements listés ci-dessous,\n` +
      `effectue une **revue de la structure globale** : compare les éléments HTML,\n` +
      `les classes CSS et les attributs \`data-*\` de ton document avec le template actuel.\n\n` +
      `**Template de référence :** \`${templateRefPath}\`\n\n` +
      `---\n\n` +
      `## Changements depuis v1.0.0\n\n`;

    if (entries.length > 0) {
      for (const entry of entries) {
        updateContent += `## Changements v${entry.version}\n`;
        for (const line of entry.lines) {
          updateContent += `${line}\n`;
        }
        updateContent += '\n';
      }
    } else {
      updateContent += `_Aucun détail de changement disponible._\n\n`;
    }

    updateContent += `---\nUne fois les modifications appliquées, supprime ce fichier UPDATE.md.\n`;
  } else {
    // Intermediate version: standard flow
    const entries = changelogContent
      ? getUpdateEntries(changelogContent, templateName, selectedVersion, latestVersion)
      : [];

    updateContent =
      `# Mise à jour requise — ${templateName} v${selectedVersion} → v${latestVersion}\n\n` +
      `Ce document a été adopté avec le template \`${templateName}\` v${selectedVersion}.\n` +
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
  }

  // 9. Write UPDATE.md and open in editor
  fs.writeFileSync(updateMdPath, updateContent, 'utf-8');
  await vscode.window.showTextDocument(vscode.Uri.file(updateMdPath));

  // 10. Confirmation message
  vscode.window.showInformationMessage(
    'Document adopté. UPDATE.md généré — demande à ton IA de les appliquer.'
  );
}
