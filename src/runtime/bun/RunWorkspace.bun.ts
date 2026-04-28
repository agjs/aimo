/**
 * @file RunWorkspace.bun.ts
 * @layer runtime
 * @description Create `.aimo/runs/<id>/` and write UTF-8 artifacts for a run.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  MANIFEST_JSON_FILENAME,
  PLAN_MD_FILENAME,
  relativeRunDirectoryPath,
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
