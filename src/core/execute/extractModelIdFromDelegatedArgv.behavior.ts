/**
 * @file extractModelIdFromDelegatedArgv.behavior.ts
 * @layer core
 * @description Find the model id after `--model` / `-m` in a delegated execute `command[]` (e.g. aider).
 */

/**
 * @param command - Non-empty argv array from YAML.
 * @returns The token after the first `--model` or `-m` flag, or null if missing.
 */
export function extractModelIdFromDelegatedArgv(command: readonly string[]): string | null {
  for (let i = 0; i < command.length - 1; i += 1) {
    const t = command[i];

    if (t === '--model' || t === '-m') {
      const next = command[i + 1];

      if (next !== undefined && !next.startsWith('-')) {
        return next;
      }

      return null;
    }
  }

  return null;
}
