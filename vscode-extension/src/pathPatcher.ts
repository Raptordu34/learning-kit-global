import * as vscode from 'vscode';

async function patchFile(fileUri: vscode.Uri): Promise<void> {
  let content: string;
  try {
    const bytes = await vscode.workspace.fs.readFile(fileUri);
    content = Buffer.from(bytes).toString('utf8');
  } catch {
    return; // Le fichier n'existe pas, on ignore
  }

  content = content.replace(/\.\.\/\.\.\/layouts\//g, './layouts/');
  content = content.replace(/\.\.\/\.\.\/design\//g, './design/');
  content = content.replace(/\.\.\/design\//g, './design/');

  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
}

export async function patchPaths(projectUri: vscode.Uri): Promise<void> {
  const filesToPatch = ['index.html', 'components.css'];

  for (const filename of filesToPatch) {
    await patchFile(vscode.Uri.joinPath(projectUri, filename));
  }
}
