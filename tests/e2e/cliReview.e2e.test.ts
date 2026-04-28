/**
 * @file cliReview.e2e.test.ts
 * @description Subprocess tests for `aimo review` after plan + execute (isolated HOME + git).
 */

import { readFile } from 'node:fs/promises';
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

describe('cli review (e2e)', () => {
  it('writes review.md and exits 0 with fake provider', async () => {
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
    execute:
      type: delegated
      command: ['cat', '{plan_path}']
`,
    );

    const plan = await spawnCli(['plan', 'hello', '--json'], { cwd, env: { HOME: home } });
    expect(plan.exitCode).toBe(EXIT_SUCCESS);
    const runId = (JSON.parse(plan.stdout) as { run_id: string }).run_id;

    const ex = await spawnCli(['execute', '--run', runId, '--json'], { cwd, env: { HOME: home } });
    expect(ex.exitCode).toBe(EXIT_SUCCESS);

    const rev = await spawnCli(['review', '--run', runId, '--json'], { cwd, env: { HOME: home } });
    expect(rev.exitCode).toBe(EXIT_SUCCESS);
    const body = JSON.parse(rev.stdout) as { verdict: string; review_path: string };
    expect(body.verdict).toBe('pass');
    const text = await readFile(body.review_path, 'utf8');
    expect(text).toContain('VERDICT: pass');
  });
});
