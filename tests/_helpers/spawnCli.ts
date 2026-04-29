/**
 * @file spawnCli.ts
 * @description Spawn the `aimo` CLI as a subprocess for black-box tests.
 */

import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

/** Repository root (`ai-orchestrator/`), derived from this file location (`tests/_helpers/`). */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Absolute entry script so `cwd` can point at isolated fixture dirs. */
const CLI_ENTRY = join(REPO_ROOT, 'src', 'app', 'cli.ts');

/** Delay before feeding stdin so the child readline interface is ready (Bun spawn race). */
const STDIN_FEED_DELAY_MS = 150;

/**
 * Options for {@link spawnCli}.
 */
export interface ISpawnCliOptions {
  /** Working directory for the child process (defaults to repository root). */
  readonly cwd?: string;
  /** Extra environment variables merged over `process.env`. */
  readonly env?: Readonly<Record<string, string>>;
  /** When set, written to the child stdin as UTF-8 (stream closed after write). */
  readonly stdinText?: string;
}

/**
 * Runs `bun <repo>/src/app/cli.ts` with the given arguments and captures stdio.
 * @param args - Arguments after the script path (e.g. `['--version']`).
 * @param options - Optional cwd/env overrides.
 * @returns Exit code and captured stdout/stderr.
 */
export async function spawnCli(
  args: readonly string[],
  options: ISpawnCliOptions = {},
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const cwd = options.cwd ?? REPO_ROOT;
  const useStdinPipe = options.stdinText !== undefined;

  const proc = Bun.spawn(['bun', CLI_ENTRY, ...args], {
    cwd,
    env: { ...process.env, ...options.env },
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: useStdinPipe ? 'pipe' : 'ignore',
  });

  if (useStdinPipe && options.stdinText !== undefined) {
    await delay(STDIN_FEED_DELAY_MS);
    const stdin = proc.stdin as { write: (chunk: string) => void; end: () => void } | undefined;

    if (!stdin) {
      throw new Error('spawnCli: stdin pipe missing');
    }

    stdin.write(options.stdinText);
    stdin.end();
  }

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return { exitCode, stdout, stderr };
}
