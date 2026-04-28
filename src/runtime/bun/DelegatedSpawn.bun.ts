/**
 * @file DelegatedSpawn.bun.ts
 * @layer runtime
 * @description Spawn delegated execute argv with `shell: false` (trusted third-party tools).
 */

/**
 * Outcome of a finished delegated child process.
 */
export type TDelegatedSpawnResult = {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
};

/**
 * Spawns `argv` with no shell. Optionally pipes a file's bytes to stdin (plan on stdin).
 * @param params - Spawn request.
 * @param params.cwd - Working directory for the child process.
 * @param params.argv - Full argv including executable at index 0.
 * @param params.stdinPlanFilePath - When set, stream this file to stdin (typically `plan.md`).
 * @returns Captured stdout/stderr and process exit code.
 */
export async function runDelegatedArgv(params: {
  readonly cwd: string;
  readonly argv: readonly string[];
  readonly stdinPlanFilePath?: string;
}): Promise<TDelegatedSpawnResult> {
  if (params.argv.length === 0) {
    return { exitCode: 1, stdout: '', stderr: 'delegated argv is empty' };
  }

  const proc = Bun.spawn([...params.argv], {
    cwd: params.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: params.stdinPlanFilePath !== undefined ? Bun.file(params.stdinPlanFilePath) : undefined,
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { exitCode, stdout, stderr };
}
