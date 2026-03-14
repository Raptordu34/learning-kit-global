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
