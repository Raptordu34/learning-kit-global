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
