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
