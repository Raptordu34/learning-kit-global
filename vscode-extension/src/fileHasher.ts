import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/** Hash a file, returns hex SHA-256. Returns empty string if file not found. */
export function hashFile(filePath: string): string {
  try {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return '';
  }
}

/** Recursively hash all files in a directory. Returns { "relPath": "hash", ... } */
export function hashDir(dirPath: string, baseDir: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(dirPath)) { return result; }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(baseDir, fullPath).split(path.sep).join('/');
    if (entry.isDirectory()) {
      Object.assign(result, hashDir(fullPath, baseDir));
    } else if (entry.isFile()) {
      result[relPath] = hashFile(fullPath);
    }
  }
  return result;
}

/**
 * Files excluded from infra hashes at the project root level.
 * These are either generated (AI instructions, UPDATE.md, PLAN.md),
 * user content (ressources/), or the manifest itself.
 */
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

/**
 * Hash all infra files of a document project:
 * - Root files (excluding section-*.html, ressources/, manifest, AI instructions, UPDATE.md, PLAN.md)
 * - design/ and layouts/ directories entirely
 */
export async function computeInfraHashes(projectUri: vscode.Uri): Promise<Record<string, string>> {
  const projectPath = projectUri.fsPath;
  const result: Record<string, string> = {};

  // Hash root files
  try {
    const entries = fs.readdirSync(projectPath, { withFileTypes: true });
    for (const entry of entries) {
      if (ROOT_EXCLUDES.has(entry.name)) { continue; }
      if (entry.isDirectory()) { continue; } // design/ and layouts/ handled below
      if (/^section-.+\.html$/.test(entry.name)) { continue; } // user-created sections
      if (entry.isFile()) {
        const filePath = path.join(projectPath, entry.name);
        result[entry.name] = hashFile(filePath);
      }
    }
  } catch {
    // Project folder not readable
  }

  // Hash design/ and layouts/ recursively
  for (const dir of ['design', 'layouts']) {
    const dirPath = path.join(projectPath, dir);
    Object.assign(result, hashDir(dirPath, projectPath));
  }

  return result;
}
