/**
 * @file isolatedHomeProject.ts
 * @description Create a fake `$HOME` + project cwd for e2e (avoids touching the developer's real config).
 */

import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { USER_CONFIG_DIR } from '@runtime/bun/EnvLoader.bun';

/**
 * Creates `home/.config/<USER_CONFIG_DIR>/` and an empty sibling `project/` directory.
 * @returns Absolute `HOME` value to pass to the child and `cwd` for `spawnCli`.
 */
export async function createIsolatedHomeAndProject(): Promise<{
  readonly home: string;
  readonly cwd: string;
}> {
  const root = await mkdtemp(join(tmpdir(), 'aimo-e2e-'));
  const home = join(root, 'home');
  const cwd = join(root, 'project');
  await mkdir(join(home, '.config', USER_CONFIG_DIR), { recursive: true });
  await mkdir(cwd, { recursive: true });
  return { home, cwd };
}
