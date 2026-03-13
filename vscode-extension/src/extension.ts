import * as vscode from 'vscode';
import * as path from 'path';
import * as scaffolder from './scaffolder';
import * as pathPatcher from './pathPatcher';
import * as aiInstructions from './aiInstructions';
import * as manifest from './manifest';

export function activate(context: vscode.ExtensionContext): void {
  const disposable = vscode.commands.registerCommand(
    'learningKit.createDocument',
    async () => {
      // 1. Lire la configuration
      const config = vscode.workspace.getConfiguration('learningKit');
      const sourcePath = config.get<string>('sourcePath', '');

      if (!sourcePath) {
        vscode.window.showErrorMessage(
          'Learning Kit: Le chemin source n\'est pas configuré. Ouvrez les paramètres (Ctrl+,) et configurez "learningKit.sourcePath".'
        );
        return;
      }

      const kitUri = vscode.Uri.file(path.join(sourcePath, 'learning-kit'));
      const templatesUri = vscode.Uri.joinPath(kitUri, 'templates');

      // 2. Lire les templates disponibles
      let templateEntries: [string, vscode.FileType][];
      try {
        templateEntries = await vscode.workspace.fs.readDirectory(templatesUri);
      } catch {
        vscode.window.showErrorMessage(
          `Learning Kit: Impossible de lire les templates dans "${templatesUri.fsPath}". Vérifiez "learningKit.sourcePath".`
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
          await manifest.generate(projectUri, templateName);

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
