/**
 * @file cliRun.e2e.test.ts
 * @description Subprocess tests for `aimo run` (plan → execute → review) and `--dry-run`.
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { EXIT_SUCCESS } from '@core/contracts/ExitCodes.constants';
import { PROJECT_AIMO_YAML_BASENAME } from '@runtime/bun/ConfigLoader.bun';
import { describe, expect, it } from 'bun:test';

import { spawnCli } from '../_helpers/spawnCli';
import { createIsolatedHomeAndProject } from './_helpers/isolatedHomeProject';

async function initGitWithEmptyCommit(cwd: string): Promise<void> {
  const init = Bun.spawn(['git', 'init'], { cwd, stdout: 'pipe', stderr: 'pipe' });
  expect(await init.exited).toBe(0);
  const commit = Bun.spawn(
    [
      'git',
      '-c',
      'user.email=aimo@test',
      '-c',
      'user.name=aimo',
      'commit',
      '--allow-empty',
      '--no-gpg-sign',
      '-m',
      'base',
    ],
    { cwd, stdout: 'pipe', stderr: 'pipe' },
  );
  expect(await commit.exited).toBe(0);
}

describe('cli run (e2e)', () => {
  it('dry-run validates profile without creating a new run directory', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    const init = await spawnCli(['init', '--json'], { cwd, env: { HOME: home } });
    expect(init.exitCode).toBe(EXIT_SUCCESS);
    await Bun.write(
      join(cwd, PROJECT_AIMO_YAML_BASENAME),
      `schema_version: 1
default_profile: default
profiles:
  default:
    plan:
      provider: fake
      model: stub
    execute:
      type: delegated
      command: ['true']
    review:
      provider: fake
      model: stub
`,
    );
    const aimoRoot = join(cwd, '.aimo', 'runs');
    const before = await readdir(aimoRoot).catch(() => [] as string[]);
    const dry = await spawnCli(['run', 'hello', '--dry-run', '--json'], {
      cwd,
      env: { HOME: home },
    });
    expect(dry.exitCode).toBe(EXIT_SUCCESS);
    const body = JSON.parse(dry.stdout) as { dry_run?: boolean; ok?: boolean; stages?: unknown };
    expect(body.dry_run).toBe(true);
    expect(body.ok).toBe(true);
    const after = await readdir(aimoRoot).catch(() => [] as string[]);
    expect(after.length).toBe(before.length);
  });

  it('runs plan → execute → review with delegated profile (--json)', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    await initGitWithEmptyCommit(cwd);
    const init = await spawnCli(['init', '--json'], { cwd, env: { HOME: home } });
    expect(init.exitCode).toBe(EXIT_SUCCESS);
    await Bun.write(
      join(cwd, PROJECT_AIMO_YAML_BASENAME),
      `schema_version: 1
default_profile: default
profiles:
  default:
    plan:
      provider: fake
      model: stub
    execute:
      type: delegated
      command: ['cat', '{plan_path}']
    review:
      provider: fake
      model: stub
`,
    );
    const run = await spawnCli(['run', 'pipeline task', '--json'], { cwd, env: { HOME: home } });
    expect(run.exitCode).toBe(EXIT_SUCCESS);
    const body = JSON.parse(run.stdout) as {
      ok: boolean;
      run_id: string;
      review: { verdict: string; exit_code: number };
    };
    expect(body.ok).toBe(true);
    expect(typeof body.run_id).toBe('string');
    expect(body.review.verdict).toBe('pass');
    expect(body.review.exit_code).toBe(EXIT_SUCCESS);
  });

  it('keeps progress on stderr and one JSON line on stdout under `run --json`', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    await initGitWithEmptyCommit(cwd);
    const init = await spawnCli(['init', '--json'], { cwd, env: { HOME: home } });
    expect(init.exitCode).toBe(EXIT_SUCCESS);
    await Bun.write(
      join(cwd, PROJECT_AIMO_YAML_BASENAME),
      `schema_version: 1
default_profile: default
profiles:
  default:
    plan:
      provider: fake
      model: stub
    execute:
      type: delegated
      command: ['true']
    review:
      provider: fake
      model: stub
`,
    );
    const run = await spawnCli(['run', 'discipline check', '--json'], {
      cwd,
      env: { HOME: home, NO_COLOR: '1' },
    });
    expect(run.exitCode).toBe(EXIT_SUCCESS);
    const stdoutLines = run.stdout.split('\n').filter((l) => l.length > 0);
    expect(stdoutLines.length).toBe(1);
    expect(() => {
      JSON.parse(stdoutLines[0] ?? '') as unknown;
    }).not.toThrow();
    expect(run.stdout).not.toContain('run:');
    expect(run.stderr).toContain('run:');
  });
});
