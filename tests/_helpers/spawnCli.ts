/**
 * @file spawnCli.ts
 * @description Spawn the `aimo` CLI as a subprocess for black-box tests.
 */

/**
 * Options for {@link spawnCli}.
 */
export interface ISpawnCliOptions {
  /** Working directory for the child process (defaults to `process.cwd()`). */
  readonly cwd?: string;
  /** Extra environment variables merged over `process.env`. */
  readonly env?: Readonly<Record<string, string>>;
}

/**
 * Runs `bun src/app/cli.ts` with the given arguments and captures stdio.
 * @param args - Arguments after the script path (e.g. `['--version']`).
 * @param options - Optional cwd/env overrides.
 * @returns Exit code and captured stdout/stderr.
 */
export async function spawnCli(
  args: readonly string[],
  options: ISpawnCliOptions = {},
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const cwd = options.cwd ?? process.cwd();
  const proc = Bun.spawn(['bun', 'src/app/cli.ts', ...args], {
    cwd,
    env: { ...process.env, ...options.env },
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  return { exitCode, stdout, stderr };
}
