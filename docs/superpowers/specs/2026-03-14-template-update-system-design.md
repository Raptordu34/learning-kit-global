# Template Update System — Design Spec
_Date: 2026-03-14_

## Context

The VS Code extension (`learning-kit-manager`) allows users to scaffold documents from templates stored on a GitHub repo. Once a document is created, the user works with an AI assistant (Claude, Copilot, etc.) to fill in content. The templates on GitHub evolve over time (style changes, structural improvements), but created documents have no way to be notified of or apply those updates.

This spec defines a system to:
1. Track which template version was used to create each document
2. Notify users when their document's template has a newer version
3. Generate AI-readable instructions describing what changed, so the AI can apply the update

---

## Architecture

### 1. Versioning Strategy

**Per-template semantic versioning** stored in the GitHub repo.

#### `templates/versions.json` (new file in repo)
```json
{
  "compte-rendu": "1.2.0",
  "presentation": "1.1.0",
  "cheat-sheet": "1.0.0"
}
```
Source of truth for the current version of each template. Updated whenever a template changes.

#### `CHANGELOG.md` (new file in repo root)
Organized by template, entries in **descending semver order** (newest first). The extension uses semver comparison (not string sort) to order and filter versions.

```markdown
## compte-rendu

### v1.2.0
- Added `data-section` attribute on each content `<section>`
- Sidebar nav now uses `<nav aria-label="sections">` instead of `<nav>`

### v1.1.0
- Renamed class `.body-content` to `.main-content`
```

**Parsing rules:**
- Template sections are identified by `## templateName` (H2 heading)
- Version entries are identified by `### vX.Y.Z` (H3 heading, semver format)
- The extension filters versions where `semver(entry) > semver(manifest.templateVersion)`
- Filtered entries are sorted ascending (oldest first) for the generated `UPDATE.md`
- If a template has no entry in `CHANGELOG.md`, the update flow skips changelog generation and shows a generic "template updated to vX.Y.Z" message
- The extension aggregates all qualifying entries in chronological order (oldest→newest)

---

### 2. Manifest Evolution

#### `.lkit-manifest.json` (updated schema)
```json
{
  "templateName": "compte-rendu",
  "templateVersion": "1.2.0",
  "createdAt": "2026-03-14T10:00:00Z"
}
```

- The `version` key is **renamed** to `templateVersion` (breaking change to manifest schema — old documents with `version` are treated as `templateVersion: "1.0.0"` for backwards compatibility)
- Value is read from `versions.json` at document creation time — `manifest.generate()` receives the resolved version as a parameter
- This is the anchor for detecting whether an update is available

---

### 3. Update Flow

**Trigger:** User clicks "↑ Mettre à jour" in the sidebar panel.

**Steps:**
1. Extension scans workspace for all `.lkit-manifest.json` files
2. Quick Pick shows each found document: `templateName vX.Y.Z — ./path/relative/to/workspace/root`. In multi-root workspaces, the path is relative to the workspace root that contains the file. If no workspace is open, the absolute path is shown.
3. User selects a document
4. Extension reads `versions.json` from local cache (already synced from GitHub)
5. Compares `manifest.templateVersion` vs `versions[templateName]`
6. **If up to date:** notification "Ce document est déjà à la dernière version (vX.Y.Z)"
7. **If outdated:**
   - **If `UPDATE.md` already exists** in the document folder: show a warning notification "Un UPDATE.md existe déjà dans ce projet. Écrase-t-il ?" with "Écraser" / "Annuler" buttons. Abort if cancelled.
   - Parse `CHANGELOG.md`, extract all entries for `templateName` between `manifest.templateVersion` (exclusive) and latest version (inclusive), using semver comparison
   - Concatenate entries in chronological order (oldest first)
   - Write `UPDATE.md` in the document folder
   - Update `manifest.templateVersion` to the new version in `.lkit-manifest.json`
   - Show notification: "Instructions générées dans UPDATE.md — demande à ton IA de les appliquer"
   - **Note:** `manifest.templateVersion` is updated immediately after writing `UPDATE.md`. If the process crashes between the two writes, the manifest will still show the old version and the update can be safely re-triggered (idempotent — the user confirms overwrite).

#### Generated `UPDATE.md`
```markdown
# Mise à jour requise — compte-rendu v1.0.0 → v1.2.0

Ce document a été créé avec le template `compte-rendu` v1.0.0.
Le template a été mis à jour vers la v1.2.0.

Applique les modifications suivantes à ce projet :

## Changements v1.1.0
- Renamed class `.body-content` to `.main-content`

## Changements v1.2.0
- Added `data-section` attribute on each content `<section>`
- Sidebar nav now uses `<nav aria-label="sections">` instead of `<nav>`

---
Une fois les modifications appliquées, supprime ce fichier UPDATE.md.
```

---

### 4. Sidebar UI

A new **TreeView** registered in the VS Code Activity Bar.

```
┌─────────────────────────────────┐
│ 🎓 LEARNING KIT          [⟳]   │
├─────────────────────────────────┤
│  [+ Nouveau document]           │
│  [↑ Mettre à jour]              │
├─────────────────────────────────┤
│ Templates disponibles           │
│   📄 compte-rendu    v1.2.0     │
│   📄 presentation    v1.1.0     │
│   📄 cheat-sheet     v1.0.0     │
│   ...                           │
│                                 │
│ Dernière sync: il y a 2h        │
└─────────────────────────────────┘
```

- **[+ Nouveau document]** — existing create flow
- **[↑ Mettre à jour]** — new update flow
- **[⟳]** — title bar button to force a manual GitHub sync
- Template list shows name + current version from `versions.json`
- "Dernière sync" reads the `syncedAt` field from `metadata.json` (stored by `updater.ts`)
- All commands also accessible via `Ctrl+Shift+P`

---

## Files to Create / Modify

### GitHub repo (`learning-kit/`)
| File | Action | Purpose |
|---|---|---|
| `templates/versions.json` | Create | Current version per template |
| `CHANGELOG.md` | Create | Change history per template/version |

### VS Code extension (`vscode-extension/src/`)
| File | Action | Purpose |
|---|---|---|
| `src/manifest.ts` | Modify | Rename `version` key to `templateVersion`; update signature to `generate(projectUri, templateName, version: string)` |
| `src/updater.ts` | Modify | No zip extraction change needed — `versions.json` and `CHANGELOG.md` land in cache automatically. Add exported helper to resolve cache paths for these files (used by `updateDocument.ts`) |
| `src/updateDocument.ts` | Create | Update logic: scan manifests → compare versions → parse CHANGELOG → write `UPDATE.md` |
| `src/sidebarProvider.ts` | Create | TreeView provider for sidebar panel |
| `src/extension.ts` | Modify | Register sidebar provider + new `learningKit.updateDocument` command; update call to `manifest.generate()` to resolve and pass version from cached `versions.json` |
| `package.json` | Modify | Declare sidebar view, new command, activity bar icon |

---

## Verification

1. **Document creation** — Create a document via sidebar, verify `.lkit-manifest.json` contains `templateVersion` matching `versions.json` (not static "1.0.0")
2. **Update — already up to date** — Manually set manifest version to match current → trigger update → verify "already up to date" notification
3. **Update — one version behind** — Set manifest to one version behind → trigger update → verify `UPDATE.md` contains only the missing version's entries
4. **Update — multiple versions behind** — Set manifest to 2+ versions behind → trigger update → verify `UPDATE.md` aggregates all entries chronologically (oldest first)
5. **Sidebar** — Verify buttons visible, template list shows versions, sync timestamp displayed
6. **GitHub sync** — Verify `versions.json` and `CHANGELOG.md` are downloaded and cached during sync
7. **Backwards compatibility** — Open a document whose `.lkit-manifest.json` uses the old `version` key (not `templateVersion`) → trigger update → verify the extension treats it as v1.0.0 and generates `UPDATE.md` correctly (assuming template is past v1.0.0)
