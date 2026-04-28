/**
 * @file formatGitDiffHeadError.app.ts
 * @layer app
 * @description Merge optional `git diff HEAD` failures into one nullable string.
 */

type TGitDiffCapture = { ok: true; text: string } | { ok: false; reason: string };

/**
 * Combines optional `git diff HEAD` failures into one nullable error string.
 * @param before - Capture before delegated spawn.
 * @param after - Capture after delegated spawn.
 * @returns Human-readable combined error, or `null` when both succeeded.
 */
export function formatGitDiffHeadError(
  before: TGitDiffCapture,
  after: TGitDiffCapture,
): string | null {
  if (before.ok && after.ok) {
    return null;
  }

  if (before.ok === false && after.ok === false) {
    return `before: ${before.reason}; after: ${after.reason}`;
  }

  if (before.ok === false) {
    return `before: ${before.reason}`;
  }

  if (after.ok === false) {
    return `after: ${after.reason}`;
  }

  return null;
}
