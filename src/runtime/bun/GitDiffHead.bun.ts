/**
 * @file GitDiffHead.bun.ts
 * @layer runtime
 * @description Capture `git diff HEAD` text for execute-stage before/after snapshots.
 */

/**
 * Runs `git diff HEAD` in `cwd` (unified diff vs `HEAD`, includes staged + unstaged vs tree).
 * @param cwd - Git working tree root.
 * @returns Diff text or a failure reason (non-repo, git missing, etc.).
 */
export async function readGitDiffHeadText(
  cwd: string,
): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  const proc = Bun.spawn(['git', '-c', 'core.quotepath=false', 'diff', 'HEAD'], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stderr = await new Response(proc.stderr).text();
  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const detail = stderr.trim() || `git diff HEAD exited with code ${String(exitCode)}`;
    return { ok: false, reason: detail };
  }

  return { ok: true, text: stdout };
}
