/**
 * @file isSafeRunDirectoryName.behavior.ts
 * @layer core
 * @description Reject path-like run ids so `.aimo/runs/<id>/` cannot escape the workspace.
 */

/**
 * @param runId - Opaque run identifier (e.g. UUID).
 * @returns False when `runId` contains path segments or traversal.
 */
export function isSafeRunDirectoryName(runId: string): boolean {
  if (runId.length === 0 || runId.length > 256) {
    return false;
  }
  if (runId.includes('/') || runId.includes('\\') || runId.includes('..')) {
    return false;
  }
  return true;
}
