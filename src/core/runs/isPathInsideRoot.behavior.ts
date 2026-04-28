/**
 * @file isPathInsideRoot.behavior.ts
 * @layer core
 * @description Pure check — is `candidate` strictly inside `root`? Both must already be resolved/realpathed.
 */

import { relative } from 'node:path';

/**
 * Returns true when `candidate` is strictly inside `root` (not equal to it, not above it).
 * @param root - Already-resolved absolute root path.
 * @param candidate - Already-resolved absolute candidate path.
 * @returns True when `candidate` is a strict descendant of `root`.
 */
export function isPathInsideRoot(root: string, candidate: string): boolean {
  const rel = relative(root, candidate);

  if (rel === '' || rel.startsWith('..')) {
    return false;
  }

  return true;
}
