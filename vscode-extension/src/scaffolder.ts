import * as vscode from 'vscode';

async function copyDir(src: vscode.Uri, dst: vscode.Uri, exclude: string[] = []): Promise<void> {
  await vscode.workspace.fs.createDirectory(dst);
  const entries = await vscode.workspace.fs.readDirectory(src);

  for (const [name, type] of entries) {
    if (exclude.includes(name)) {
      continue;
    }

    const srcChild = vscode.Uri.joinPath(src, name);
    const dstChild = vscode.Uri.joinPath(dst, name);

    if (type === vscode.FileType.Directory) {
      await copyDir(srcChild, dstChild);
    } else if (type === vscode.FileType.File) {
      await vscode.workspace.fs.copy(srcChild, dstChild, { overwrite: true });
    }
  }
}

export async function scaffold(
  kitUri: vscode.Uri,
  templateName: string,
  projectName: string,
  targetUri: vscode.Uri
): Promise<vscode.Uri> {
  const projectUri = vscode.Uri.joinPath(targetUri, projectName);
  await vscode.workspace.fs.createDirectory(projectUri);

  // Copier le template (sans PROMPT.md)
  const templateUri = vscode.Uri.joinPath(kitUri, 'templates', templateName);
  await copyDir(templateUri, projectUri, ['PROMPT.md']);

  // Copier design/ et layouts/
  const designSrc = vscode.Uri.joinPath(kitUri, 'design');
  const designDst = vscode.Uri.joinPath(projectUri, 'design');
  await copyDir(designSrc, designDst);

  const layoutsSrc = vscode.Uri.joinPath(kitUri, 'layouts');
  const layoutsDst = vscode.Uri.joinPath(projectUri, 'layouts');
  await copyDir(layoutsSrc, layoutsDst);

  // Créer le dossier ressources/ vide
  const ressourcesUri = vscode.Uri.joinPath(projectUri, 'ressources');
  await vscode.workspace.fs.createDirectory(ressourcesUri);

  return projectUri;
}
