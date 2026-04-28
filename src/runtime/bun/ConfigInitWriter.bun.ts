/**
 * @file ConfigInitWriter.bun.ts
 * @layer runtime
 * @description Create starter YAML files for `aimo init` (mkdir + conditional write).
 */

import { mkdir } from 'node:fs/promises';

import {
  getProjectAimoYamlPath,
  getUserGlobalConfigDir,
  getUserGlobalConfigYamlPath,
} from './ConfigLoader.bun';

/** Outcome for a single target file. */
export type TInitFileStatus = 'created' | 'skipped_exists' | 'overwritten';

/**
 * Result of attempting one init write (path + created / skipped / overwritten).
 */
export type TInitWriteResult = {
  readonly path: string;
  readonly status: TInitFileStatus;
};

/**
 * Writes starter contents if {@link force} is true or the file is missing.
 * @param path - Absolute file path.
 * @param contents - UTF-8 YAML body.
 * @param force - When true, overwrite an existing file.
 * @returns Result or an error message on I/O failure.
 */
async function writeStarterFile(
  path: string,
  contents: string,
  force: boolean,
): Promise<TInitWriteResult | { readonly error: string }> {
  try {
    const exists = await Bun.file(path).exists();
    if (exists && !force) {
      return { path, status: 'skipped_exists' };
    }
    const status: TInitFileStatus = exists && force ? 'overwritten' : 'created';
    await Bun.write(path, contents);
    return { path, status };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    return { error: `${path}: ${detail}` };
  }
}

export type TInitMode = 'both' | 'global' | 'local';

/**
 * Builds the return object without setting optional keys to `undefined` (exactOptionalPropertyTypes).
 * @param errors - Collected fatal error strings (may be empty on success).
 * @param opts - Optional successful write results.
 * @param [opts.user] - User-global write result when that target ran successfully.
 * @param [opts.project] - Project-local write result when that target ran successfully.
 * @returns Normalized outcome object for {@link runInitWrites}.
 */
function packInitWriteOutcome(
  errors: readonly string[],
  opts?: { readonly user?: TInitWriteResult; readonly project?: TInitWriteResult },
): {
  readonly user?: TInitWriteResult;
  readonly project?: TInitWriteResult;
  readonly errors: readonly string[];
} {
  const out: {
    errors: readonly string[];
    user?: TInitWriteResult;
    project?: TInitWriteResult;
  } = { errors };
  if (opts?.user !== undefined) {
    out.user = opts.user;
  }
  if (opts?.project !== undefined) {
    out.project = opts.project;
  }
  return out;
}

/**
 * Creates the user config directory (when writing global) and starter YAML per mode.
 * @param input - Write request bundle.
 * @param input.cwd - Project root used to resolve `./aimo.yaml`.
 * @param input.globalYaml - UTF-8 YAML body for the user-global file.
 * @param input.localYaml - UTF-8 YAML body for `./aimo.yaml`.
 * @param input.mode - Which file(s) to touch (`both`, `global`, or `local`).
 * @param input.force - When true, overwrite existing files instead of skipping.
 * @returns Per-target write results; non-empty `errors` means a fatal I/O failure.
 */
export async function runInitWrites(input: {
  readonly cwd: string;
  readonly globalYaml: string;
  readonly localYaml: string;
  readonly mode: TInitMode;
  readonly force: boolean;
}): Promise<{
  readonly user?: TInitWriteResult;
  readonly project?: TInitWriteResult;
  readonly errors: readonly string[];
}> {
  const errors: string[] = [];
  let user: TInitWriteResult | undefined;
  let project: TInitWriteResult | undefined;

  if (input.mode === 'both' || input.mode === 'global') {
    try {
      await mkdir(getUserGlobalConfigDir(), { recursive: true });
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      errors.push(`${getUserGlobalConfigDir()}: ${detail}`);
      return packInitWriteOutcome(errors);
    }
    const userPath = getUserGlobalConfigYamlPath();
    const res = await writeStarterFile(userPath, input.globalYaml, input.force);
    if ('error' in res) {
      errors.push(res.error);
      return packInitWriteOutcome(errors);
    }
    user = res;
  }

  if (input.mode === 'both' || input.mode === 'local') {
    const projectPath = getProjectAimoYamlPath(input.cwd);
    const res = await writeStarterFile(projectPath, input.localYaml, input.force);
    if ('error' in res) {
      errors.push(res.error);
      return user !== undefined
        ? packInitWriteOutcome(errors, { user })
        : packInitWriteOutcome(errors);
    }
    project = res;
  }

  return packInitWriteOutcome(errors, {
    ...(user !== undefined ? { user } : {}),
    ...(project !== undefined ? { project } : {}),
  });
}
