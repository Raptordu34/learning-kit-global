import * as https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as AdmZip from 'adm-zip';
import { saveMetadata, getCachePath, getMetadata } from './cache';

export async function getLatestSha(owner: string, repo: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repo}/commits/HEAD`,
      headers: { 'User-Agent': 'learning-kit-vscode' }
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (!parsed.sha) { reject(new Error('No SHA in response')); return; }
          resolve(parsed.sha);
        } catch { reject(new Error('Invalid response')); }
      });
    }).on('error', reject);
  });
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const makeRequest = (requestUrl: string): void => {
      https.get(requestUrl, { headers: { 'User-Agent': 'learning-kit-vscode' } }, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          const newUrl = new URL(res.headers.location!, requestUrl).toString();
          makeRequest(newUrl);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
        file.on('error', reject);
      }).on('error', reject);
    };
    makeRequest(url);
  });
}

export async function downloadAndExtract(
  context: vscode.ExtensionContext,
  owner: string,
  repo: string
): Promise<void> {
  fs.mkdirSync(context.globalStorageUri.fsPath, { recursive: true });

  const zipPath = path.join(context.globalStorageUri.fsPath, '_tmp.zip');
  await downloadFile(
    `https://codeload.github.com/${owner}/${repo}/zip/HEAD`,
    zipPath
  );

  const zip = new AdmZip(zipPath);
  const cacheDir = context.globalStorageUri.fsPath;

  const entries = zip.getEntries();
  const prefix = entries[0]?.entryName.split('/')[0] + '/';

  for (const entry of entries) {
    if (!entry.entryName.startsWith(prefix)) { continue; }
    const relativePathInRepo = entry.entryName.slice(prefix.length);
    if (!relativePathInRepo) { continue; }
    
    // Extrait tout le contenu du repo dans le dossier "learning-kit" du cache
    const destPath = path.join(cacheDir, 'learning-kit', relativePathInRepo);
    
    if (entry.isDirectory) {
      fs.mkdirSync(destPath, { recursive: true });
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, entry.getData());
    }
  }

  const sha = await getLatestSha(owner, repo);
  await saveMetadata(context, sha);

  fs.unlinkSync(zipPath);
}

export async function checkForUpdates(
  context: vscode.ExtensionContext,
  repoSlug: string
): Promise<{ available: boolean; latestSha: string }> {
  const cleanSlug = repoSlug.replace(/^https?:\/\/(www\.)?github\.com\//, '').replace(/\/$/, '');
  const [owner, repo] = cleanSlug.split('/');
  const latestSha = await getLatestSha(owner, repo);
  const metadata = await getMetadata(context);

  if (!metadata || metadata.sha !== latestSha) {
    return { available: true, latestSha };
  }
  return { available: false, latestSha };
}
