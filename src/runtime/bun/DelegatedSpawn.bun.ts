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
 * Reads a child stream to a string, optionally copying chunks to this process's stderr (so
 * `aimo run --json` can still use stdout for a single JSON line while the user sees live output).
 * @param stream - Subprocess stdout or stderr stream (may be undefined).
 * @param streamProgressToStderr - When true, copy decoded chunks to `process.stderr`.
 * @returns Full decoded stream text.
 */
async function drainChildStream(
  stream: ReadableStream<Uint8Array> | undefined,
  streamProgressToStderr: boolean,
): Promise<string> {
  if (stream === undefined) {
    return '';
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let accumulated = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      if (value !== undefined && value.byteLength > 0) {
        const text = decoder.decode(value, { stream: true });
        accumulated += text;

        if (streamProgressToStderr) {
          process.stderr.write(text);
        }
      }
    }

    accumulated += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  return accumulated;
}

/**
 * Spawns `argv` with no shell. Optionally pipes a file's bytes to stdin (plan on stdin).
 * @param params - Spawn request.
 * @param params.cwd - Working directory for the child process.
 * @param params.argv - Full argv including executable at index 0.
 * @param params.stdinPlanFilePath - When set, stream this file to stdin (typically `plan.md`).
 * @param params.streamProgressToStderr - When true, copy child stdout and stderr to this
 * process's stderr as chunks arrive (default false for silent tests and scripts).
 * @returns Captured stdout/stderr and process exit code.
 */
export async function runDelegatedArgv(params: {
  readonly cwd: string;
  readonly argv: readonly string[];
  readonly stdinPlanFilePath?: string;
  readonly streamProgressToStderr?: boolean;
}): Promise<TDelegatedSpawnResult> {
  if (params.argv.length === 0) {
    return { exitCode: 1, stdout: '', stderr: 'delegated argv is empty' };
  }

  const streamProgressToStderr = params.streamProgressToStderr === true;

  const proc = Bun.spawn([...params.argv], {
    cwd: params.cwd,
    stdout: 'pipe',
    stderr: 'pipe',
    stdin: params.stdinPlanFilePath !== undefined ? Bun.file(params.stdinPlanFilePath) : undefined,
  });

  const exitPromise = proc.exited;
  const stdoutPromise = drainChildStream(proc.stdout, streamProgressToStderr);
  const stderrPromise = drainChildStream(proc.stderr, streamProgressToStderr);
  const [stdout, stderr, exitCode] = await Promise.all([stdoutPromise, stderrPromise, exitPromise]);

  return { exitCode, stdout, stderr };
}
