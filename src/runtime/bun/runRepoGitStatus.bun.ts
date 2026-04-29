/**
 * @file runRepoGitStatus.bun.ts
 * @layer runtime
 * @description Bounded `git status` in a repository working tree (session `/git-status`).
 */

import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { IGitStatusParams, IGitStatusResult } from '@core/ports/IRepoToolsPort.types';

const DEFAULT_MAX_OUTPUT_BYTES = 65_536;

/**
 * Runs `git status --short -b` under `repoRoot` (after `realpath`) with a UTF-8 output byte cap.
 * @param repoRoot - Working tree directory passed to `git` as `cwd`.
 * @param params - Optional output cap.
 * @returns Combined status text, truncation flag, and `git` exit code (non-zero when not a repo, etc.).
 */
export async function runRepoGitStatus(
  repoRoot: string,
  params: IGitStatusParams = {},
): Promise<IGitStatusResult> {
  const maxOut = params.max_output_bytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const cwd = await realpath(resolve(repoRoot));

  const proc = Bun.spawn(
    ['git', '-c', 'core.quotepath=false', '-c', 'safe.directory=*', 'status', '--short', '-b'],
    { cwd, stdout: 'pipe', stderr: 'pipe' },
  );

  const stderr = await new Response(proc.stderr).text();
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  let raw =
    exitCode === 0 ? stdout : [stderr.trim(), stdout.trim()].filter((s) => s.length > 0).join('\n');

  if (raw.length === 0) {
    raw =
      stderr.trim().length > 0 ? stderr.trim() : `git status exited with code ${String(exitCode)}`;
  }

  const buf = Buffer.from(raw, 'utf8');
  const truncated = buf.length > maxOut;
  const slice = truncated ? buf.subarray(0, maxOut) : buf;
  const output = slice.toString('utf8');

  return { output, truncated, exit_code: exitCode };
}
