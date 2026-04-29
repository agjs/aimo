/**
 * @file simpleGlobPredicate.behavior.ts
 * @layer core
 * @description Minimal glob matching for session `grep` path filters (no external glob engine).
 */

/**
 * Whether `relPath` should be searched given an optional glob (POSIX-style `/` separators).
 * Supports extension wildcards, optional directory-prefix wildcards, or a plain suffix.
 * @param relPath - Path relative to repository root (no leading `./`).
 * @param glob - User glob; `undefined` or empty matches every path.
 * @returns True when the path passes the filter.
 */
export function matchPathAgainstSimpleGlob(relPath: string, glob: string | undefined): boolean {
  if (glob === undefined || glob.trim() === '') {
    return true;
  }

  const g = glob.trim().replaceAll('\\', '/');

  if (g === '*' || g === '**/*') {
    return true;
  }

  if (g.startsWith('**/')) {
    const tail = g.slice(3);

    if (tail.startsWith('*.')) {
      return relPath.endsWith(tail.slice(1));
    }

    return relPath.endsWith(`/${tail}`) || relPath === tail;
  }

  if (g.startsWith('*.')) {
    return relPath.endsWith(g.slice(1));
  }

  if (g.startsWith('.') && !g.includes('*') && !g.includes('?')) {
    return relPath.endsWith(g);
  }

  if (!g.includes('*') && !g.includes('?')) {
    return relPath === g || relPath.endsWith(`/${g}`);
  }

  return false;
}
