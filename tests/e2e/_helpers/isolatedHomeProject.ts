/**
 * @file isolatedHomeProject.ts
 * @description Create a fake `$HOME` + project cwd for e2e (avoids touching the developer's real config).
 */

import { mkdir, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';

import { USER_CONFIG_DIR } from '@runtime/bun/EnvLoader.bun';

/** Ephemeral fixtures live here (gitignored) instead of many `.aimo-e2e-*` dirs at repo root. */
const E2E_WORK_ROOT = join(import.meta.dir, '..', '..', '..', '.aimo-test-work');

/**
 * Creates `home/.config/<USER_CONFIG_DIR>/` and an empty sibling `project/` directory.
 * Uses a unique directory under `.aimo-test-work/` (still inside the repo so `git init` works under tight sandboxes).
 * @returns Absolute `HOME` value to pass to the child and `cwd` for `spawnCli`.
 */
export async function createIsolatedHomeAndProject(): Promise<{
  readonly home: string;
  readonly cwd: string;
}> {
  await mkdir(E2E_WORK_ROOT, { recursive: true });
  const root = await mkdtemp(join(E2E_WORK_ROOT, 'e2e-'));
  const home = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(join(home, '.config', USER_CONFIG_DIR), { recursive: true });
  await mkdir(cwd, { recursive: true });
  return { home, cwd };
}
