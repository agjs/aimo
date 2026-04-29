/**
 * @file runRepoGitDiff.bun.ts
 * @layer runtime
 * @description Bounded `git diff` in a repository working tree (session `/git-diff`).
 */

import { realpath } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { IGitDiffParams, IGitDiffResult } from '@core/ports/IRepoToolsPort.types';

const DEFAULT_MAX_OUTPUT_BYTES = 65_536;

/**
 * Runs `git diff HEAD` (working tree + index vs `HEAD`) or `git diff --cached` when `staged` is true.
 * @param repoRoot - Working tree directory passed to `git` as `cwd`.
 * @param params - Optional `staged` and output byte cap.
 * @returns Diff text (possibly empty when clean), truncation flag, and `git` exit code.
 */
export async function runRepoGitDiff(
  repoRoot: string,
  params: IGitDiffParams = {},
): Promise<IGitDiffResult> {
  const maxOut = params.max_output_bytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const staged = params.staged === true;
  const cwd = await realpath(resolve(repoRoot));

  const gitArgs = staged
    ? ['git', '-c', 'core.quotepath=false', '-c', 'safe.directory=*', 'diff', '--cached']
    : ['git', '-c', 'core.quotepath=false', '-c', 'safe.directory=*', 'diff', 'HEAD'];

  const proc = Bun.spawn(gitArgs, { cwd, stdout: 'pipe', stderr: 'pipe' });

  const stderr = await new Response(proc.stderr).text();
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  let raw =
    exitCode === 0 ? stdout : [stderr.trim(), stdout.trim()].filter((s) => s.length > 0).join('\n');

  if (raw.length === 0) {
    raw =
      stderr.trim().length > 0 ? stderr.trim() : `git diff exited with code ${String(exitCode)}`;
  }

  const buf = Buffer.from(raw, 'utf8');
  const truncated = buf.length > maxOut;
  const slice = truncated ? buf.subarray(0, maxOut) : buf;
  const output = slice.toString('utf8');

  return { output, truncated, exit_code: exitCode };
}
