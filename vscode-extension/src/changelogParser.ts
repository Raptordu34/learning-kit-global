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
