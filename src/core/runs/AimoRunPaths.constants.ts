/**
 * @file AimoRunPaths.constants.ts
 * @layer core
 * @description POSIX-style relative paths under the repo root for `.aimo` run artifacts (no `path` module).
 */

/** Hidden workspace directory at the repository root. */
export const AIMO_RELATIVE_DIR = '.aimo' as const;

/** Runs live under `.aimo/runs/<run_id>/`. */
export const RUNS_RELATIVE_DIR = 'runs' as const;

/** Planner output filename inside a run directory. */
export const PLAN_MD_FILENAME = 'plan.md' as const;

/** Per-run metadata JSON. */
export const MANIFEST_JSON_FILENAME = 'manifest.json' as const;

/**
 * Relative directory for one run (POSIX slashes).
 * @param runId - Opaque run identifier (e.g. UUID).
 * @returns Path like `.aimo/runs/<runId>`.
 */
export function relativeRunDirectoryPath(runId: string): string {
  return `${AIMO_RELATIVE_DIR}/${RUNS_RELATIVE_DIR}/${runId}`;
}

/**
 * Relative path to `plan.md` for a run.
 * @param runId - Run identifier.
 * @returns Path like `.aimo/runs/<runId>/plan.md`.
 */
export function relativePlanMdPath(runId: string): string {
  return `${relativeRunDirectoryPath(runId)}/${PLAN_MD_FILENAME}`;
}

/**
 * Relative path to `manifest.json` for a run.
 * @param runId - Run identifier.
 * @returns Path like `.aimo/runs/<runId>/manifest.json`.
 */
export function relativeManifestJsonPath(runId: string): string {
  return `${relativeRunDirectoryPath(runId)}/${MANIFEST_JSON_FILENAME}`;
}
