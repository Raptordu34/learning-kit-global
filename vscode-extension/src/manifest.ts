import * as vscode from 'vscode';

export async function generate(
  projectUri: vscode.Uri,
  templateName: string,
  version: string,
  fileHashes?: Record<string, string>
): Promise<void> {
  const manifest: Record<string, unknown> = {
    templateName,
    templateVersion: version,
    createdAt: new Date().toISOString()
  };

  if (fileHashes) {
    manifest['fileHashes'] = fileHashes;
  }

  const content = JSON.stringify(manifest, null, 2);
  const fileUri = vscode.Uri.joinPath(projectUri, '.lkit-manifest.json');
  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
}
