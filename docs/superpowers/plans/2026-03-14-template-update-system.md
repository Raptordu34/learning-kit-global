# Template Update System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-template semantic versioning and an AI-assisted update flow to the `learning-kit-manager` VS Code extension, including a sidebar panel with "Nouveau document" and "Mettre à jour" buttons.

**Architecture:** Templates in the GitHub repo get versioned via `templates/versions.json` + `CHANGELOG.md`. Created documents store `templateVersion` in `.lkit-manifest.json`. The extension compares versions, collects relevant CHANGELOG entries, and writes an `UPDATE.md` the user's AI assistant reads to apply changes. A new sidebar TreeView exposes the two main actions.

**Tech Stack:** TypeScript, VS Code Extension API (TreeDataProvider, commands, quickPick), Node.js fs, vitest (new, for pure utility tests), existing `adm-zip` + `cache.ts` infrastructure.

**Spec:** `docs/superpowers/specs/2026-03-14-template-update-system-design.md`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `learning-kit/templates/versions.json` | Create | Current version per template (source of truth) |
| `learning-kit/CHANGELOG.md` | Create | Human-authored change history per template/version |
| `vscode-extension/src/semver.ts` | Create | Pure semver comparison utility (no vscode import) |
| `vscode-extension/src/changelogParser.ts` | Create | Pure CHANGELOG parsing + version filtering |
| `vscode-extension/src/manifest.ts` | Modify | Accept `version` param, write `templateVersion` key |
| `vscode-extension/src/cache.ts` | Modify | Add `readVersions()` and `readChangelog()` helpers |
| `vscode-extension/src/updateDocument.ts` | Create | Full update flow: scan → compare → parse → write UPDATE.md |
| `vscode-extension/src/sidebarProvider.ts` | Create | TreeDataProvider for sidebar panel |
| `vscode-extension/src/extension.ts` | Modify | Resolve version at creation; register sidebar + updateDocument command |
| `vscode-extension/package.json` | Modify | Declare sidebar view, new command, activity bar icon |
| `vscode-extension/package.json` (devDeps) | Modify | Add vitest + @vitest/coverage-v8 |
| `vscode-extension/vitest.config.ts` | Create | Vitest config (exclude files that import vscode) |
| `vscode-extension/src/semver.test.ts` | Create | Unit tests for semver comparison |
| `vscode-extension/src/changelogParser.test.ts` | Create | Unit tests for CHANGELOG parsing |

---

## Chunk 1: Repo Assets + Pure Utilities

### Task 1: Create `versions.json` in the learning-kit repo

**Files:**
- Create: `learning-kit/templates/versions.json`

- [ ] **Step 1: Create the file**

```json
{
  "cheat-sheet": "1.0.0",
  "comparatif": "1.0.0",
  "compte-rendu": "1.0.0",
  "fiche-revision": "1.0.0",
  "one-pager": "1.0.0",
  "presentation": "1.0.0",
  "rapport-projet": "1.0.0",
  "synthese-article": "1.0.0",
  "td-exercice": "1.0.0"
}
```

- [ ] **Step 2: Commit**

```bash
git add learning-kit/templates/versions.json
git commit -m "feat: add template versions manifest"
```

---

### Task 2: Create `CHANGELOG.md` in the learning-kit repo

**Files:**
- Create: `learning-kit/CHANGELOG.md`

- [ ] **Step 1: Create the file**

```markdown
# Changelog

Ce fichier décrit les changements entre versions de chaque template.
Format: `## templateName` (H2), `### vX.Y.Z` (H3), bullet points describing changes.

---

## compte-rendu

### v1.0.0
- Version initiale

## presentation

### v1.0.0
- Version initiale

## cheat-sheet

### v1.0.0
- Version initiale

## comparatif

### v1.0.0
- Version initiale

## fiche-revision

### v1.0.0
- Version initiale

## one-pager

### v1.0.0
- Version initiale

## rapport-projet

### v1.0.0
- Version initiale

## synthese-article

### v1.0.0
- Version initiale

## td-exercice

### v1.0.0
- Version initiale
```

- [ ] **Step 2: Commit**

```bash
git add learning-kit/CHANGELOG.md
git commit -m "feat: add template changelog"
```

---

### Task 3: Set up vitest for pure utility tests

**Files:**
- Modify: `vscode-extension/package.json`
- Create: `vscode-extension/vitest.config.ts`

- [ ] **Step 1: Install vitest**

```bash
cd vscode-extension
npm install --save-dev vitest
```

- [ ] **Step 2: Add test script to `package.json`**

In `vscode-extension/package.json`, add to `"scripts"`:
```json
"test:unit": "vitest run",
"test:unit:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Exclude any test file that imports 'vscode' (requires VS Code extension host)
    exclude: ['**/node_modules/**'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Verify vitest runs (no tests yet)**

```bash
cd vscode-extension && npm run test:unit
```
Expected: `No test files found`

- [ ] **Step 5: Commit**

```bash
git add vscode-extension/package.json vscode-extension/vitest.config.ts vscode-extension/package-lock.json
git commit -m "chore: add vitest for unit tests"
```

---

### Task 4: Create `semver.ts` utility

**Files:**
- Create: `vscode-extension/src/semver.ts`
- Create: `vscode-extension/src/semver.test.ts`

- [ ] **Step 1: Write the failing tests first**

```typescript
// vscode-extension/src/semver.test.ts
import { describe, it, expect } from 'vitest';
import { compareSemver, isNewerThan } from './semver';

describe('compareSemver', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
  });
  it('handles v-prefix', () => {
    expect(compareSemver('v1.2.3', '1.2.3')).toBe(0);
  });
  it('returns positive when a > b (patch)', () => {
    expect(compareSemver('1.2.4', '1.2.3')).toBeGreaterThan(0);
  });
  it('returns negative when a < b (minor)', () => {
    expect(compareSemver('1.1.0', '1.2.0')).toBeLessThan(0);
  });
  it('compares major correctly', () => {
    expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0);
  });
  it('handles v1.10.0 vs v1.9.0 (not string sort)', () => {
    expect(compareSemver('1.10.0', '1.9.0')).toBeGreaterThan(0);
  });
});

describe('isNewerThan', () => {
  it('returns true when a is strictly newer', () => {
    expect(isNewerThan('1.2.0', '1.1.0')).toBe(true);
  });
  it('returns false for equal versions', () => {
    expect(isNewerThan('1.0.0', '1.0.0')).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd vscode-extension && npm run test:unit
```
Expected: FAIL — `semver.ts` not found

- [ ] **Step 3: Implement `semver.ts`**

```typescript
// vscode-extension/src/semver.ts

/** Parse a version string like "1.2.3" or "v1.2.3" into [major, minor, patch] */
function parse(v: string): [number, number, number] {
  const parts = v.replace(/^v/, '').split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/** Returns negative if a < b, 0 if equal, positive if a > b */
export function compareSemver(a: string, b: string): number {
  const [aMaj, aMin, aPatch] = parse(a);
  const [bMaj, bMin, bPatch] = parse(b);
  if (aMaj !== bMaj) { return aMaj - bMaj; }
  if (aMin !== bMin) { return aMin - bMin; }
  return aPatch - bPatch;
}

/** Returns true if a is strictly newer than b */
export function isNewerThan(a: string, b: string): boolean {
  return compareSemver(a, b) > 0;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd vscode-extension && npm run test:unit
```
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add vscode-extension/src/semver.ts vscode-extension/src/semver.test.ts
git commit -m "feat: add semver comparison utility"
```

---

### Task 5: Create `changelogParser.ts` utility

**Files:**
- Create: `vscode-extension/src/changelogParser.ts`
- Create: `vscode-extension/src/changelogParser.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// vscode-extension/src/changelogParser.test.ts
import { describe, it, expect } from 'vitest';
import { parseChangelog, getUpdateEntries } from './changelogParser';

const SAMPLE_CHANGELOG = `
# Changelog

## compte-rendu

### v1.2.0
- Added data-section attribute
- Updated nav aria-label

### v1.1.0
- Renamed .body-content to .main-content

### v1.0.0
- Version initiale

## presentation

### v1.1.0
- New slide transition
`;

describe('parseChangelog', () => {
  it('returns entries for the requested template', () => {
    const entries = parseChangelog(SAMPLE_CHANGELOG, 'compte-rendu');
    expect(entries).toHaveLength(3);
    expect(entries[0].version).toBe('1.2.0');
    expect(entries[1].version).toBe('1.1.0');
  });
  it('returns empty array for unknown template', () => {
    expect(parseChangelog(SAMPLE_CHANGELOG, 'unknown')).toHaveLength(0);
  });
  it('strips v-prefix from version numbers', () => {
    const entries = parseChangelog(SAMPLE_CHANGELOG, 'compte-rendu');
    expect(entries.every(e => !e.version.startsWith('v'))).toBe(true);
  });
  it('captures bullet lines for an entry', () => {
    const entries = parseChangelog(SAMPLE_CHANGELOG, 'compte-rendu');
    expect(entries[0].lines).toContain('- Added data-section attribute');
  });
  it('does not bleed into next template section', () => {
    const entries = parseChangelog(SAMPLE_CHANGELOG, 'presentation');
    expect(entries).toHaveLength(1);
    expect(entries[0].version).toBe('1.1.0');
  });
});

describe('getUpdateEntries', () => {
  it('returns entries strictly newer than fromVersion', () => {
    const entries = getUpdateEntries(SAMPLE_CHANGELOG, 'compte-rendu', '1.0.0', '1.2.0');
    expect(entries.map(e => e.version)).toEqual(['1.1.0', '1.2.0']);
  });
  it('returns entries sorted oldest first', () => {
    const entries = getUpdateEntries(SAMPLE_CHANGELOG, 'compte-rendu', '1.0.0', '1.2.0');
    expect(entries[0].version).toBe('1.1.0');
    expect(entries[1].version).toBe('1.2.0');
  });
  it('returns empty when already at latest', () => {
    const entries = getUpdateEntries(SAMPLE_CHANGELOG, 'compte-rendu', '1.2.0', '1.2.0');
    expect(entries).toHaveLength(0);
  });
  it('returns only the one missing version when one step behind', () => {
    const entries = getUpdateEntries(SAMPLE_CHANGELOG, 'compte-rendu', '1.1.0', '1.2.0');
    expect(entries).toHaveLength(1);
    expect(entries[0].version).toBe('1.2.0');
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd vscode-extension && npm run test:unit
```
Expected: FAIL — `changelogParser.ts` not found

- [ ] **Step 3: Implement `changelogParser.ts`**

```typescript
// vscode-extension/src/changelogParser.ts
import { compareSemver } from './semver';

export interface VersionEntry {
  version: string; // no v-prefix, e.g. "1.2.0"
  lines: string[];
}

/**
 * Parse all version entries for a given template from a CHANGELOG.md.
 * Template sections start with `## templateName` (H2).
 * Version entries start with `### vX.Y.Z` (H3).
 * Returns entries in the order they appear in the file (usually descending).
 */
export function parseChangelog(content: string, templateName: string): VersionEntry[] {
  const lines = content.split('\n');
  const entries: VersionEntry[] = [];
  let inTemplate = false;
  let currentEntry: VersionEntry | null = null;

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (currentEntry) {
        entries.push(currentEntry);
        currentEntry = null;
      }
      inTemplate = line.slice(3).trim() === templateName;
      continue;
    }

    if (!inTemplate) { continue; }

    if (line.startsWith('### ')) {
      if (currentEntry) { entries.push(currentEntry); }
      const version = line.slice(4).trim().replace(/^v/, '');
      currentEntry = { version, lines: [] };
      continue;
    }

    if (currentEntry && line.trim() !== '') {
      currentEntry.lines.push(line.trimEnd());
    }
  }

  if (currentEntry) { entries.push(currentEntry); }
  return entries;
}

/**
 * Returns changelog entries for `templateName` where:
 *   version > fromVersion  (exclusive)
 *   version <= toVersion   (inclusive)
 * Sorted ascending (oldest first) for chronological UPDATE.md output.
 */
export function getUpdateEntries(
  content: string,
  templateName: string,
  fromVersion: string,
  toVersion: string
): VersionEntry[] {
  return parseChangelog(content, templateName)
    .filter(e =>
      compareSemver(e.version, fromVersion) > 0 &&
      compareSemver(e.version, toVersion) <= 0
    )
    .sort((a, b) => compareSemver(a.version, b.version));
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
cd vscode-extension && npm run test:unit
```
Expected: All tests PASS (semver + changelogParser)

- [ ] **Step 5: Compile TypeScript to catch any type errors**

```bash
cd vscode-extension && npm run compile
```
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add vscode-extension/src/changelogParser.ts vscode-extension/src/changelogParser.test.ts
git commit -m "feat: add CHANGELOG parser utility"
```

---

## Chunk 2: Manifest + Cache Helpers

### Task 6: Update `manifest.ts` + `cache.ts` + `extension.ts` (atomic — all compile together)

**Files:**
- Modify: `vscode-extension/src/manifest.ts`
- Modify: `vscode-extension/src/cache.ts`
- Modify: `vscode-extension/src/extension.ts`

These three changes must be made together so the build stays green at every commit.

- [ ] **Step 1: Replace `manifest.ts`**

```typescript
// vscode-extension/src/manifest.ts
import * as vscode from 'vscode';

export async function generate(
  projectUri: vscode.Uri,
  templateName: string,
  version: string
): Promise<void> {
  const manifest = {
    templateName,
    templateVersion: version,
    createdAt: new Date().toISOString()
  };

  const content = JSON.stringify(manifest, null, 2);
  const fileUri = vscode.Uri.joinPath(projectUri, '.lkit-manifest.json');
  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
}
```

- [ ] **Step 2: Add `readVersions` + `readChangelog` at the bottom of `cache.ts`**

```typescript
// Add to the bottom of vscode-extension/src/cache.ts

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
```

- [ ] **Step 3: Update `extension.ts` — fix the `manifest.generate` call**

Update the cache import at the top of `extension.ts`:
```typescript
import { cacheExists, getCachePath, readVersions } from './cache';
```

Find this block (around line 147-151):
```typescript
          const projectUri = await scaffolder.scaffold(kitUri, templateName, projectName, targetUri);

          await pathPatcher.patchPaths(projectUri);
          await aiInstructions.generate(projectUri, templateName);
          await manifest.generate(projectUri, templateName);
```

Replace with:
```typescript
          const projectUri = await scaffolder.scaffold(kitUri, templateName, projectName, targetUri);

          await pathPatcher.patchPaths(projectUri);
          await aiInstructions.generate(projectUri, templateName);

          // Resolve template version from cached versions.json (fall back to 1.0.0)
          const versions = readVersions(context);
          const templateVersion = versions?.[templateName] ?? '1.0.0';
          await manifest.generate(projectUri, templateName, templateVersion);
```

- [ ] **Step 4: Compile — must be clean**

```bash
cd vscode-extension && npm run compile
```
Expected: **No errors**

- [ ] **Step 5: Run unit tests**

```bash
cd vscode-extension && npm run test:unit
```
Expected: All tests PASS

- [ ] **Step 6: Commit all three files together**

```bash
git add vscode-extension/src/manifest.ts vscode-extension/src/cache.ts vscode-extension/src/extension.ts
git commit -m "feat: dynamic templateVersion in manifest, add cache helpers, update call site"
```

---

## Chunk 3: Update Document Logic

### Task 9: Create `updateDocument.ts`

**Files:**
- Create: `vscode-extension/src/updateDocument.ts`

- [ ] **Step 1: Create the file**

```typescript
// vscode-extension/src/updateDocument.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { readVersions, readChangelog } from './cache';
import { compareSemver } from './semver';
import { getUpdateEntries } from './changelogParser';

interface LkitManifest {
  templateName: string;
  templateVersion?: string;
  version?: string; // legacy key — treated as templateVersion
  createdAt: string;
}

interface ManifestPickItem extends vscode.QuickPickItem {
  manifestUri: vscode.Uri;
  manifest: LkitManifest;
  resolvedVersion: string;
  docFolder: string;
}

export async function updateDocument(context: vscode.ExtensionContext): Promise<void> {
  // 1. Scan workspace for .lkit-manifest.json files
  const found = await vscode.workspace.findFiles(
    '**/.lkit-manifest.json',
    '**/node_modules/**'
  );

  if (found.length === 0) {
    vscode.window.showInformationMessage(
      'Aucun document Learning Kit trouvé dans le workspace.'
    );
    return;
  }

  // 2. Build Quick Pick items (skip unreadable manifests)
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;
  const picks: ManifestPickItem[] = [];

  for (const uri of found) {
    let manifest: LkitManifest;
    try {
      manifest = JSON.parse(fs.readFileSync(uri.fsPath, 'utf-8')) as LkitManifest;
    } catch {
      continue;
    }

    // Backwards compat: old 'version' key treated as templateVersion
    const resolvedVersion = manifest.templateVersion ?? manifest.version ?? '1.0.0';
    const docFolder = path.dirname(uri.fsPath);
    const relPath = workspaceRoot
      ? './' + path.relative(workspaceRoot.fsPath, docFolder).split(path.sep).join('/')
      : docFolder;

    picks.push({
      label: `${manifest.templateName}  v${resolvedVersion}`,
      description: relPath,
      manifestUri: uri,
      manifest,
      resolvedVersion,
      docFolder
    });
  }

  if (picks.length === 0) {
    vscode.window.showWarningMessage('Aucun fichier .lkit-manifest.json lisible trouvé.');
    return;
  }

  // 3. User selects a document
  const selected = await vscode.window.showQuickPick(picks, {
    placeHolder: 'Sélectionnez un document à mettre à jour',
    title: 'Learning Kit: Mettre à jour un document'
  });
  if (!selected) { return; }

  // 4. Read versions.json from cache
  const versions = readVersions(context);
  if (!versions) {
    vscode.window.showErrorMessage(
      'Impossible de lire versions.json. Synchronisez les templates d\'abord (bouton ⟳).'
    );
    return;
  }

  const { templateName } = selected.manifest;
  const latestVersion = versions[templateName];

  if (!latestVersion) {
    vscode.window.showWarningMessage(
      `Template "${templateName}" introuvable dans versions.json.`
    );
    return;
  }

  // 5. Compare versions
  if (compareSemver(selected.resolvedVersion, latestVersion) >= 0) {
    vscode.window.showInformationMessage(
      `Ce document est déjà à la dernière version (v${latestVersion}).`
    );
    return;
  }

  // 6. Check for existing UPDATE.md — ask before overwriting
  const updateMdPath = path.join(selected.docFolder, 'UPDATE.md');
  if (fs.existsSync(updateMdPath)) {
    const choice = await vscode.window.showWarningMessage(
      'Un UPDATE.md existe déjà dans ce projet. Écraser ?',
      'Écraser',
      'Annuler'
    );
    if (choice !== 'Écraser') { return; }
  }

  // 7. Parse CHANGELOG and collect update entries
  const changelogContent = readChangelog(context);
  const entries = changelogContent
    ? getUpdateEntries(changelogContent, templateName, selected.resolvedVersion, latestVersion)
    : [];

  // 8. Build UPDATE.md content
  let updateContent =
    `# Mise à jour requise — ${templateName} v${selected.resolvedVersion} → v${latestVersion}\n\n` +
    `Ce document a été créé avec le template \`${templateName}\` v${selected.resolvedVersion}.\n` +
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

  // 9. Write UPDATE.md
  fs.writeFileSync(updateMdPath, updateContent, 'utf-8');

  // 10. Update manifest templateVersion (and remove legacy 'version' key)
  const updatedManifest: Record<string, unknown> = {
    templateName: selected.manifest.templateName,
    templateVersion: latestVersion,
    createdAt: selected.manifest.createdAt
  };
  fs.writeFileSync(
    selected.manifestUri.fsPath,
    JSON.stringify(updatedManifest, null, 2),
    'utf-8'
  );

  // 11. Open UPDATE.md in editor
  const updateUri = vscode.Uri.file(updateMdPath);
  await vscode.window.showTextDocument(updateUri);
  vscode.window.showInformationMessage(
    'Instructions générées dans UPDATE.md — demande à ton IA de les appliquer.'
  );
}
```

- [ ] **Step 2: Compile**

```bash
cd vscode-extension && npm run compile
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add vscode-extension/src/updateDocument.ts
git commit -m "feat: add updateDocument command logic"
```

---

## Chunk 4: Sidebar + Registration

### Task 10: Create `sidebarProvider.ts`

**Files:**
- Create: `vscode-extension/src/sidebarProvider.ts`

- [ ] **Step 1: Create the file**

```typescript
// vscode-extension/src/sidebarProvider.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { getMetadata, readVersions } from './cache';

// ─── Tree item types ──────────────────────────────────────────────────────────

class ActionItem extends vscode.TreeItem {
  constructor(label: string, commandId: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.command = { command: commandId, title: label };
    this.contextValue = 'action';
  }
}

class TemplateItem extends vscode.TreeItem {
  constructor(name: string, version: string) {
    super(`${name}`, vscode.TreeItemCollapsibleState.None);
    this.description = `v${version}`;
    this.contextValue = 'template';
    this.iconPath = new vscode.ThemeIcon('file-code');
  }
}

class InfoItem extends vscode.TreeItem {
  constructor(label: string) {
    super(label, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'info';
    this.iconPath = new vscode.ThemeIcon('clock');
  }
}

// ─── Provider ────────────────────────────────────────────────────────────────

export class LearningKitSidebarProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined | void
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private readonly context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element) { return []; }

    const items: vscode.TreeItem[] = [];

    // Action buttons
    items.push(new ActionItem('$(add) Nouveau document', 'learningKit.createDocument'));
    items.push(new ActionItem('$(arrow-up) Mettre à jour', 'learningKit.updateDocument'));

    // Separator label
    const sep = new vscode.TreeItem('Templates disponibles');
    sep.contextValue = 'separator';
    items.push(sep);

    // Template list from cached versions.json
    const versions = readVersions(this.context);
    if (versions) {
      for (const [name, version] of Object.entries(versions)) {
        items.push(new TemplateItem(name, version));
      }
    } else {
      const noCache = new vscode.TreeItem('Aucun cache — configurez githubRepo');
      noCache.contextValue = 'info';
      items.push(noCache);
    }

    // Sync timestamp
    const metadata = await getMetadata(this.context);
    if (metadata) {
      const diffMs = Date.now() - new Date(metadata.syncedAt).getTime();
      const diffH = Math.floor(diffMs / 3_600_000);
      const syncLabel = diffH >= 1
        ? `Dernière sync : il y a ${diffH}h`
        : 'Dernière sync : récente';
      items.push(new InfoItem(syncLabel));
    }

    return items;
  }
}
```

- [ ] **Step 2: Compile**

```bash
cd vscode-extension && npm run compile
```
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add vscode-extension/src/sidebarProvider.ts
git commit -m "feat: add sidebar TreeView provider"
```

---

### Task 11: Update `package.json` — sidebar + new command

**Files:**
- Create: `vscode-extension/resources/learning-kit.svg`
- Modify: `vscode-extension/package.json`

- [ ] **Step 1: Create the activity bar SVG icon**

Create `vscode-extension/resources/learning-kit.svg` (24×24 monochrome — VS Code will colorize it):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <path fill="currentColor" d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z"/>
</svg>
```

- [ ] **Step 2: Replace `"contributes"` section in `package.json`**

```json
"contributes": {
  "viewsContainers": {
    "activitybar": [
      {
        "id": "learningKit",
        "title": "Learning Kit",
        "icon": "resources/learning-kit.svg"
      }
    ]
  },
  "views": {
    "learningKit": [
      {
        "id": "learningKit.sidebar",
        "name": "Learning Kit",
        "when": "true"
      }
    ]
  },
  "commands": [
    {
      "command": "learningKit.createDocument",
      "title": "Learning Kit: Créer un nouveau document"
    },
    {
      "command": "learningKit.updateDocument",
      "title": "Learning Kit: Mettre à jour un document"
    },
    {
      "command": "learningKit.refreshSidebar",
      "title": "Learning Kit: Actualiser",
      "icon": "$(refresh)"
    }
  ],
  "menus": {
    "view/title": [
      {
        "command": "learningKit.refreshSidebar",
        "when": "view == learningKit.sidebar",
        "group": "navigation"
      }
    ]
  },
  "configuration": {
    "title": "Learning Kit Manager",
    "properties": {
      "learningKit.githubRepo": {
        "type": "string",
        "default": "",
        "description": "Repo GitHub public au format owner/repo (ex: bapti/learning-kit). L'extension synchronise automatiquement les templates."
      },
      "learningKit.sourcePath": {
        "type": "string",
        "default": "",
        "description": "Chemin local optionnel — override du cache GitHub si défini."
      }
    }
  }
}
```

- [ ] **Step 3: Compile**

```bash
cd vscode-extension && npm run compile
```
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add vscode-extension/package.json vscode-extension/resources/learning-kit.svg
git commit -m "feat: declare sidebar view and updateDocument command in package.json"
```

---

### Task 12: Update `extension.ts` — register sidebar + new command

**Files:**
- Modify: `vscode-extension/src/extension.ts`

- [ ] **Step 1: Add new imports at the top**

```typescript
import { LearningKitSidebarProvider } from './sidebarProvider';
import { updateDocument } from './updateDocument';
```

- [ ] **Step 2: Register sidebar provider and new commands**

After the existing `checkForUpdates` block (around line 33), and before the `const disposable = ...` line, add:

```typescript
  // Register sidebar provider
  const sidebarProvider = new LearningKitSidebarProvider(context);
  vscode.window.registerTreeDataProvider('learningKit.sidebar', sidebarProvider);

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
```

- [ ] **Step 3: Final compile**

```bash
cd vscode-extension && npm run compile
```
Expected: **No errors**

- [ ] **Step 4: Run all unit tests**

```bash
cd vscode-extension && npm run test:unit
```
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add vscode-extension/src/extension.ts
git commit -m "feat: register sidebar and updateDocument in extension activation"
```

---

## Verification Checklist

Run the extension in VS Code Extension Development Host (`F5` in the `vscode-extension` folder):

- [ ] **1. Sidebar visible** — Learning Kit icon appears in Activity Bar; panel shows "Nouveau document", "Mettre à jour", template list with versions, sync timestamp
- [ ] **2. Refresh button** — ⟳ button in panel title triggers sidebar refresh
- [ ] **3. Document creation with version** — Create a doc via sidebar button; inspect `.lkit-manifest.json` → `templateVersion` matches value in `versions.json` (not static "1.0.0")
- [ ] **4. Update — already up to date** — Edit `.lkit-manifest.json` to match current version; trigger "Mettre à jour" → expect notification "Ce document est déjà à la dernière version"
- [ ] **5. Update — one version behind** — Set `templateVersion: "0.9.0"` in manifest; update `versions.json` to `"1.0.0"` for that template; add a changelog entry; trigger update → expect `UPDATE.md` with only that version's entries
- [ ] **6. Update — multiple versions behind** — Set `templateVersion: "0.8.0"`, add two changelog entries (v0.9.0, v1.0.0) → trigger update → expect `UPDATE.md` with both entries in chronological order (v0.9.0 first)
- [ ] **7. UPDATE.md overwrite prompt** — Trigger update twice without deleting `UPDATE.md` → expect overwrite confirmation dialog
- [ ] **8. Backwards compatibility** — Create a manifest with old `"version": "1.0.0"` key (no `templateVersion`) → trigger update → extension treats it as v1.0.0 and proceeds correctly
- [ ] **9. GitHub sync** — After a full sync, verify `versions.json` and `CHANGELOG.md` exist under `globalStorageUri/learning-kit/`
