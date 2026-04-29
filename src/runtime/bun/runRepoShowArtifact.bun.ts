/**
 * @file runRepoShowArtifact.bun.ts
 * @layer runtime
 * @description Bounded read of a file under `.aimo/runs/<run_id>/` (session `/show`).
 */

import { open, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

import { isSafeRunDirectoryName } from '@core/execute/isSafeRunDirectoryName.behavior';
import type { IReadFileResult, IShowArtifactParams } from '@core/ports/IRepoToolsPort.types';
import { relativeRunDirectoryPath } from '@core/runs/AimoRunPaths.constants';
import { isPathInsideRoot } from '@core/runs/isPathInsideRoot.behavior';

const DEFAULT_MAX_BYTES = 65_536;

/**
 * Reads a regular file under `repoRoot/.aimo/runs/<run_id>/` after containment checks.
 * @param repoRoot - Repository root (typically CLI cwd).
 * @param params - Run id and path relative to that run directory.
 * @returns File bytes and truncation metadata (same shape as `read_file`).
 */
export async function runRepoShowArtifact(
  repoRoot: string,
  params: IShowArtifactParams,
): Promise<IReadFileResult> {
  const maxBytes = params.max_bytes ?? DEFAULT_MAX_BYTES;
  const runId = params.run_id.trim();
  const raw = params.path.trim();

  if (runId.length === 0) {
    throw new Error('show_artifact: empty run_id');
  }

  if (!isSafeRunDirectoryName(runId)) {
    throw new Error('show_artifact: invalid run_id');
  }

  if (raw.length === 0) {
    throw new Error('show_artifact: empty path');
  }

  if (isAbsolute(raw)) {
    throw new Error('show_artifact: path must be relative to the run directory');
  }

  const rootReal = await realpath(resolve(repoRoot));
  const runDirCandidate = resolve(join(rootReal, relativeRunDirectoryPath(runId)));
  let runDirReal: string;

  try {
    runDirReal = await realpath(runDirCandidate);
  } catch {
    throw new Error(`show_artifact: run directory not found for id "${runId}"`);
  }

  if (!isPathInsideRoot(rootReal, runDirReal)) {
    throw new Error('show_artifact: run directory resolves outside repository root');
  }

  const runStat = await stat(runDirReal);

  if (!runStat.isDirectory()) {
    throw new Error(`show_artifact: not a directory: ${runId}`);
  }

  const fileCandidate = resolve(join(runDirReal, raw));
  let fileReal: string;

  try {
    fileReal = await realpath(fileCandidate);
  } catch {
    throw new Error(`show_artifact: path not found: ${raw}`);
  }

  if (!isPathInsideRoot(runDirReal, fileReal)) {
    throw new Error('show_artifact: path resolves outside run directory');
  }

  const st = await stat(fileReal);

  if (!st.isFile()) {
    throw new Error(`show_artifact: not a regular file: ${raw}`);
  }

  const cap = maxBytes + 1;
  const fh = await open(fileReal, 'r');

  try {
    const buf = Buffer.alloc(cap);
    const { bytesRead } = await fh.read(buf, 0, cap, 0);
    const truncated = bytesRead > maxBytes;
    const sliceLen = Math.min(bytesRead, maxBytes);
    const content = buf.subarray(0, sliceLen).toString('utf8');
    const total_lines = truncated ? null : countLines(content);

    return { content, truncated, total_lines };
  } finally {
    await fh.close();
  }
}

function countLines(text: string): number {
  if (text.length === 0) {
    return 0;
  }

  let n = 1;

  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) {
      n += 1;
    }
  }

  return n;
}
