/**
 * @file RunWorkspace.bun.ts
 * @layer runtime
 * @description Create `.aimo/runs/<id>/` and write UTF-8 artifacts for a run.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  EXECUTE_RESULT_JSON_BASENAME,
  EXECUTE_STDERR_TXT_BASENAME,
  EXECUTE_STDOUT_TXT_BASENAME,
  GIT_DIFF_AFTER_BASENAME,
  GIT_DIFF_BEFORE_BASENAME,
  MANIFEST_JSON_FILENAME,
  PLAN_MD_FILENAME,
  relativeRunDirectoryPath,
  REVIEW_MD_FILENAME,
} from '@core/runs/AimoRunPaths.constants';

/**
 * Ensures the run directory exists and returns absolute paths to standard artifacts.
 * @param cwd - Repository root (typically `process.cwd()`).
 * @param runId - Unique run identifier (UUID from the app layer).
 * @returns Absolute `runDir`, `planPath`, and `manifestPath`.
 */
export async function prepareRunArtifactPaths(
  cwd: string,
  runId: string,
): Promise<{
  readonly runDir: string;
  readonly planPath: string;
  readonly manifestPath: string;
}> {
  const rel = relativeRunDirectoryPath(runId);
  const segments = rel.split('/');
  const runDir = join(cwd, ...segments);
  await mkdir(runDir, { recursive: true });
  return {
    runDir,
    planPath: join(runDir, PLAN_MD_FILENAME),
    manifestPath: join(runDir, MANIFEST_JSON_FILENAME),
  };
}

/**
 * Writes `manifest.json` then `plan.md` (manifest first so partial runs list metadata even if plan write fails later).
 * @param paths - Absolute paths from {@link prepareRunArtifactPaths}.
 * @param paths.planPath - Absolute `plan.md` path.
 * @param paths.manifestPath - Absolute `manifest.json` path.
 * @param bodies - UTF-8 bodies to persist.
 * @param bodies.manifestJson - Pretty JSON text (include trailing newline if desired).
 * @param bodies.planMarkdown - Markdown body for `plan.md`.
 */
export async function writePlanArtifacts(
  paths: {
    readonly planPath: string;
    readonly manifestPath: string;
  },
  bodies: { readonly manifestJson: string; readonly planMarkdown: string },
): Promise<void> {
  await writeFile(paths.manifestPath, bodies.manifestJson, 'utf8');
  await writeFile(paths.planPath, bodies.planMarkdown, 'utf8');
}

/**
 * Writes execute-stage artifacts under an existing run directory.
 * @param runDir - Absolute `.aimo/runs/<id>/` path.
 * @param bodies - UTF-8 bodies for diff snapshots and result JSON.
 * @param bodies.gitDiffBefore - `git diff HEAD` text captured before spawn.
 * @param bodies.gitDiffAfter - `git diff HEAD` text captured after spawn.
 * @param bodies.executeResultJson - Pretty JSON for {@link EXECUTE_RESULT_JSON_BASENAME}.
 * @param bodies.executeStdout - Delegated process stdout (written to `execute.stdout.txt`).
 * @param bodies.executeStderr - Delegated process stderr (written to `execute.stderr.txt`).
 */
export async function writeExecuteStageArtifacts(
  runDir: string,
  bodies: {
    readonly gitDiffBefore: string;
    readonly gitDiffAfter: string;
    readonly executeResultJson: string;
    readonly executeStdout: string;
    readonly executeStderr: string;
  },
): Promise<void> {
  await writeFile(join(runDir, GIT_DIFF_BEFORE_BASENAME), bodies.gitDiffBefore, 'utf8');
  await writeFile(join(runDir, GIT_DIFF_AFTER_BASENAME), bodies.gitDiffAfter, 'utf8');
  await writeFile(join(runDir, EXECUTE_RESULT_JSON_BASENAME), bodies.executeResultJson, 'utf8');
  await writeFile(join(runDir, EXECUTE_STDOUT_TXT_BASENAME), bodies.executeStdout, 'utf8');
  await writeFile(join(runDir, EXECUTE_STDERR_TXT_BASENAME), bodies.executeStderr, 'utf8');
}

/**
 * Writes `review.md` under an existing run directory.
 * @param runDir - Absolute `.aimo/runs/<id>/` path.
 * @param reviewMarkdown - UTF-8 markdown (must include trailing `VERDICT:` line).
 */
export async function writeReviewMarkdown(runDir: string, reviewMarkdown: string): Promise<void> {
  await writeFile(join(runDir, REVIEW_MD_FILENAME), reviewMarkdown, 'utf8');
}
