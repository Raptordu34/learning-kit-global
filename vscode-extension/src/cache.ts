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

/** Read templates/versions.json from the local cache. Returns null if not found. */
export function readVersions(context: vscode.ExtensionContext): Record<string, string> | null {
  const versionsPath = path.join(
    getCachePath(context).fsPath,
    'templates',
    'versions.json'
  );
  try {
    const raw = fs.readFileSync(versionsPath, 'utf-8');
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return null;
  }
}

/** Read CHANGELOG.md from the local cache. Returns empty string if not found. */
export function readChangelog(context: vscode.ExtensionContext): string {
  const changelogPath = path.join(getCachePath(context).fsPath, 'CHANGELOG.md');
  try {
    return fs.readFileSync(changelogPath, 'utf-8');
  } catch {
    return '';
  }
}
