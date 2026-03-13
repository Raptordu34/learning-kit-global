import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface Metadata {
  sha: string;
  syncedAt: string;
}

export function getCachePath(context: vscode.ExtensionContext): vscode.Uri {
  return vscode.Uri.joinPath(context.globalStorageUri, 'learning-kit');
}

export async function getMetadata(context: vscode.ExtensionContext): Promise<Metadata | null> {
  const metaPath = path.join(context.globalStorageUri.fsPath, 'metadata.json');
  try {
    const raw = fs.readFileSync(metaPath, 'utf-8');
    return JSON.parse(raw) as Metadata;
  } catch {
    return null;
  }
}

export async function saveMetadata(context: vscode.ExtensionContext, sha: string): Promise<void> {
  fs.mkdirSync(context.globalStorageUri.fsPath, { recursive: true });
  const metaPath = path.join(context.globalStorageUri.fsPath, 'metadata.json');
  const metadata: Metadata = { sha, syncedAt: new Date().toISOString() };
  fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2));
}

export async function cacheExists(context: vscode.ExtensionContext): Promise<boolean> {
  const templatesPath = path.join(context.globalStorageUri.fsPath, 'learning-kit', 'templates');
  return fs.existsSync(templatesPath);
}
