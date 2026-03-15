import * as vscode from 'vscode';
import * as path from 'path';
import * as scaffolder from './scaffolder';
import * as pathPatcher from './pathPatcher';
import * as aiInstructions from './aiInstructions';
import * as manifest from './manifest';
import { cacheExists, getCachePath, readVersions } from './cache';
import { checkForUpdates, downloadAndExtract } from './updater';
import { WebviewSidebarProvider } from './webviewSidebarProvider';
import { updateDocument } from './updateDocument';
import { adoptDocument } from './adoptDocument';
import { applyWithAI } from './applyWithAI';

export function activate(context: vscode.ExtensionContext): void {
  // Check for updates in background (non-blocking)
  const config = vscode.workspace.getConfiguration('learningKit');
  const repoSlug = config.get<string>('githubRepo', '');
  if (repoSlug) {
    checkForUpdates(context, repoSlug).then(result => {
      if (result.available) {
        vscode.window.showInformationMessage(
          'Learning Kit : nouveaux templates disponibles.',
          'Mettre à jour', 'Plus tard'
        ).then(choice => {
          if (choice === 'Mettre à jour') {
            const cleanSlug = repoSlug.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\/$/, '');
            const [owner, repo] = cleanSlug.split('/');
            vscode.window.withProgress({
              location: vscode.ProgressLocation.Notification,
              title: 'Learning Kit: Mise à jour des templates...',
              cancellable: false
            }, () => downloadAndExtract(context, owner, repo));
          }
        });
      }
    }).catch(() => {}); // Silencieux si pas d'internet
  }

  // Register sidebar provider
  const sidebarProvider = new WebviewSidebarProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      WebviewSidebarProvider.viewType,
      sidebarProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // Refresh sidebar command
  context.subscriptions.push(
    vscode.commands.registerCommand('learningKit.refreshSidebar', () => {
      sidebarProvider.refresh();
    })
  );

  // Update document command
  context.subscriptions.push(
    vscode.commands.registerCommand('learningKit.updateDocument', async () => {
      await updateDocument(context);
      sidebarProvider.refresh();
    })
  );

  // Adopt document command
  context.subscriptions.push(
    vscode.commands.registerCommand('learningKit.adoptDocument', async () => {
      await adoptDocument(context);
      sidebarProvider.refresh();
    })
  );

  // Apply with AI command
  context.subscriptions.push(
    vscode.commands.registerCommand('learningKit.applyWithAI', async () => {
      await applyWithAI();
    })
  );

  const disposable = vscode.commands.registerCommand(
    'learningKit.createDocument',
    async () => {
      // 1. Lire la configuration
      const cfg = vscode.workspace.getConfiguration('learningKit');
      const sourcePath = cfg.get<string>('sourcePath', '');
      const slug = cfg.get<string>('githubRepo', '');

      let kitUri: vscode.Uri;

      if (sourcePath) {
        kitUri = vscode.Uri.file(path.join(sourcePath, 'learning-kit'));
      } else {
        // Fallback vers cache global
        if (!await cacheExists(context)) {
          if (!slug) {
            vscode.window.showErrorMessage(
              'Learning Kit: Configurez "learningKit.githubRepo" (ex: owner/learning-kit) ou "learningKit.sourcePath".'
            );
            return;
          }
          // Premier démarrage : télécharger
          const cleanSlug = slug.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\/$/, '');
          const [owner, repo] = cleanSlug.split('/');
          await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Learning Kit: Téléchargement des templates...',
            cancellable: false
          }, () => downloadAndExtract(context, owner, repo));
        }
        kitUri = getCachePath(context);
      }

      const templatesUri = vscode.Uri.joinPath(kitUri, 'templates');

      // 2. Lire les templates disponibles
      let templateEntries: [string, vscode.FileType][];
      try {
        templateEntries = await vscode.workspace.fs.readDirectory(templatesUri);
      } catch {
        vscode.window.showErrorMessage(
          `Learning Kit: Impossible de lire les templates dans "${templatesUri.fsPath}". Vérifiez votre configuration.`
        );
        return;
      }

      const templateNames = templateEntries
        .filter(([, type]) => type === vscode.FileType.Directory)
        .map(([name]) => name);

      if (templateNames.length === 0) {
        vscode.window.showErrorMessage('Learning Kit: Aucun template trouvé dans le dossier templates/.');
        return;
      }

      // 3. Sélectionner le template
      const templateName = await vscode.window.showQuickPick(templateNames, {
        placeHolder: 'Sélectionnez un template',
        title: 'Learning Kit: Choisir un template'
      });

      if (!templateName) {
        return;
      }

      // 4. Saisir le nom du projet
      const projectName = await vscode.window.showInputBox({
        prompt: 'Nom du projet (sans espaces)',
        placeHolder: 'mon-projet',
        title: 'Learning Kit: Nom du projet',
        validateInput: (value) => {
          if (!value || value.trim() === '') {
            return 'Le nom du projet ne peut pas être vide.';
          }
          if (/\s/.test(value)) {
            return 'Le nom du projet ne doit pas contenir d\'espaces.';
          }
          return null;
        }
      });

      if (!projectName) {
        return;
      }

      // 5. Déterminer le dossier cible
      let targetUri: vscode.Uri;
      const workspaceFolders = vscode.workspace.workspaceFolders;

      if (workspaceFolders && workspaceFolders.length > 0) {
        targetUri = workspaceFolders[0].uri;
      } else {
        const chosen = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          title: 'Choisir le dossier de destination'
        });
        if (!chosen || chosen.length === 0) {
          return;
        }
        targetUri = chosen[0];
      }

      // 6. Scaffolding
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Learning Kit: Création de "${projectName}"...`,
          cancellable: false
        },
        async () => {
          const projectUri = await scaffolder.scaffold(kitUri, templateName, projectName, targetUri);

          await pathPatcher.patchPaths(projectUri);
          await aiInstructions.generate(projectUri, templateName);

          // Resolve template version from cached versions.json (fall back to 1.0.0)
          const versions = readVersions(context);
          const templateVersion = versions?.[templateName] ?? '1.0.0';
          await manifest.generate(projectUri, templateName, templateVersion);

          // Ouvrir index.html
          const indexUri = vscode.Uri.joinPath(projectUri, 'index.html');
          try {
            await vscode.window.showTextDocument(indexUri);
          } catch {
            // index.html peut ne pas exister pour certains templates
          }

          vscode.window.showInformationMessage(`✓ Projet "${projectName}" créé avec succès !`);
        }
      );
    }
  );

  context.subscriptions.push(disposable);
}

export function deactivate(): void {}
