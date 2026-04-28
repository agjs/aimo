/**
 * @file assertPlanPathAnchoredInRepoRoot.behavior.ts
 * @layer core
 * @description Ensure the plan file path resolves inside the repository root (path traversal guard).
 */

import { relative, resolve } from 'node:path';

/**
 * Resolves paths and verifies the plan file lives under the repo root.
 * @param params - Raw `cwd` and plan path (absolute or relative).
 * @param params.repoRoot - Repository root path (typically `process.cwd()`).
 * @param params.planPath - Candidate plan file path.
 * @returns Resolved paths on success, or a human-readable error.
 */
export function assertPlanPathAnchoredInRepoRoot(params: {
  readonly repoRoot: string;
  readonly planPath: string;
}):
  | { ok: true; readonly repoRootResolved: string; readonly planPathResolved: string }
  | { ok: false; readonly message: string } {
  const repoRootResolved = resolve(params.repoRoot);
  const planPathResolved = resolve(params.planPath);
  const rel = relative(repoRootResolved, planPathResolved);
  if (rel === '') {
    return {
      ok: false,
      message: 'plan path resolves to repository root (expected a file under it)',
    };
  }
  if (rel.startsWith('..')) {
    return { ok: false, message: 'plan file resolves outside repository root' };
  }
  return { ok: true, repoRootResolved, planPathResolved };
}
