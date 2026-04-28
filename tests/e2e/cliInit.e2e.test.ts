/**
 * @file cliInit.e2e.test.ts
 * @description Subprocess tests for `aimo init` (starter files + `--json`).
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { EXIT_CONFIG_ERROR, EXIT_SUCCESS } from '@core/contracts/ExitCodes.constants';
import { PROJECT_AIMO_YAML_BASENAME } from '@runtime/bun/ConfigLoader.bun';
import { describe, expect, it } from 'bun:test';

import { spawnCli } from '../_helpers/spawnCli';
import { createIsolatedHomeAndProject } from './_helpers/isolatedHomeProject';

describe('cli init (e2e)', () => {
  it('creates user and project starters when missing (--json)', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    const first = await spawnCli(['init', '--json'], { cwd, env: { HOME: home } });
    expect(first.exitCode).toBe(EXIT_SUCCESS);
    const body = JSON.parse(first.stdout) as {
      ok: boolean;
      user: { status: string; path: string } | null;
      project: { status: string; path: string } | null;
    };
    expect(body.ok).toBe(true);
    expect(body.user?.status).toBe('created');
    expect(body.project?.status).toBe('created');

    const userText = await readFile(body.user!.path, 'utf8');
    expect(userText).toContain('provider: fake');
    const projText = await readFile(join(cwd, PROJECT_AIMO_YAML_BASENAME), 'utf8');
    expect(projText).toContain('profiles: {}');

    const doctor = await spawnCli(['doctor', '--json'], { cwd, env: { HOME: home } });
    expect(doctor.exitCode).toBe(EXIT_SUCCESS);
    expect((JSON.parse(doctor.stdout) as { ok: boolean }).ok).toBe(true);

    const second = await spawnCli(['init', '--json'], { cwd, env: { HOME: home } });
    expect(second.exitCode).toBe(EXIT_SUCCESS);
    const again = JSON.parse(second.stdout) as {
      user: { status: string } | null;
      project: { status: string } | null;
    };
    expect(again.user?.status).toBe('skipped_exists');
    expect(again.project?.status).toBe('skipped_exists');
  });

  it('respects --local-only', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    const r = await spawnCli(['init', '--local-only', '--json'], { cwd, env: { HOME: home } });
    expect(r.exitCode).toBe(EXIT_SUCCESS);
    const body = JSON.parse(r.stdout) as {
      ok: boolean;
      user: unknown;
      project: { status: string } | null;
    };
    expect(body.ok).toBe(true);
    expect(body.user).toBeNull();
    expect(body.project?.status).toBe('created');
  });

  it('rejects --global-only together with --local-only', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    const r = await spawnCli(['init', '--global-only', '--local-only', '--json'], {
      cwd,
      env: { HOME: home },
    });
    expect(r.exitCode).toBe(EXIT_CONFIG_ERROR);
    const body = JSON.parse(r.stdout) as { ok: boolean; error?: string };
    expect(body.ok).toBe(false);
    expect(body.error).toBe('mutually_exclusive_flags');
  });

  it('overwrites with --force', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    await spawnCli(['init', '--json'], { cwd, env: { HOME: home } });
    const projectPath = join(cwd, PROJECT_AIMO_YAML_BASENAME);
    await readFile(projectPath, 'utf8');
    await spawnCli(['init', '--local-only', '--json'], { cwd, env: { HOME: home } });
    const forced = await spawnCli(['init', '--local-only', '--force', '--json'], {
      cwd,
      env: { HOME: home },
    });
    expect(forced.exitCode).toBe(EXIT_SUCCESS);
    const body = JSON.parse(forced.stdout) as { project: { status: string } | null };
    expect(body.project?.status).toBe('overwritten');
  });
});
