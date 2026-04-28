/**
 * @file cliRunWorkers.e2e.test.ts
 * @description `aimo run` with `workers` + `pipeline.shrinkers` (fake provider; no network).
 */

import { join } from 'node:path';

import { EXIT_SUCCESS } from '@core/contracts/ExitCodes.constants';
import {
  EXECUTE_STDERR_TXT_BASENAME,
  EXECUTE_STDOUT_TXT_BASENAME,
  GIT_DIFF_AFTER_BASENAME,
  WORKERS_JSON_BASENAME,
} from '@core/runs/AimoRunPaths.constants';
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

const workersYaml = `schema_version: 1
default_profile: default
workers:
  w:
    provider: fake
    model: stub
    max_chars_in: 50000
    max_chars_out: 4000
pipeline:
  shrinkers:
    - { source: execute.stdout, worker: w }
    - { source: execute.stderr, worker: w }
    - { source: execute.git_diff_after, worker: w }
profiles:
  default:
    plan:
      provider: fake
      model: stub
    execute:
      type: delegated
      command: ['sh', '-c', 'echo out1 && echo err1 >&2']
    review:
      provider: fake
      model: stub
`;

describe('cli run workers (e2e)', () => {
  it('writes raw + shrunk + workers.json with three shrinker calls', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    await initGitWithEmptyCommit(cwd);
    const init = await spawnCli(['init', '--json'], { cwd, env: { HOME: home } });
    expect(init.exitCode).toBe(EXIT_SUCCESS);
    await Bun.write(join(cwd, PROJECT_AIMO_YAML_BASENAME), workersYaml);
    const run = await spawnCli(['run', 'task with workers', '--json'], {
      cwd,
      env: { HOME: home },
    });
    expect(run.exitCode).toBe(EXIT_SUCCESS);
    const body = JSON.parse(run.stdout) as { run_id: string };
    const runDir = join(cwd, '.aimo', 'runs', body.run_id);
    expect(await Bun.file(join(runDir, EXECUTE_STDOUT_TXT_BASENAME)).exists()).toBe(true);
    expect(await Bun.file(join(runDir, EXECUTE_STDERR_TXT_BASENAME)).exists()).toBe(true);
    expect(await Bun.file(join(runDir, 'execute.stdout.shrunk.md')).exists()).toBe(true);
    expect(await Bun.file(join(runDir, 'execute.stderr.shrunk.md')).exists()).toBe(true);
    expect(await Bun.file(join(runDir, 'execute.git_diff_after.shrunk.md')).exists()).toBe(true);
    const sidecar = JSON.parse(await Bun.file(join(runDir, WORKERS_JSON_BASENAME)).text()) as {
      calls: readonly unknown[];
    };
    expect(sidecar.calls.length).toBe(3);
    const review = await Bun.file(join(runDir, 'review.md')).text();
    expect(review.includes('<<<DATA') || review.includes('DATA')).toBe(true);
  });

  it('removes raw context files with --no-keep-raw', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    await initGitWithEmptyCommit(cwd);
    const init = await spawnCli(['init', '--json'], { cwd, env: { HOME: home } });
    expect(init.exitCode).toBe(EXIT_SUCCESS);
    await Bun.write(join(cwd, PROJECT_AIMO_YAML_BASENAME), workersYaml);
    const run = await spawnCli(['run', 'task no raw', '--json', '--no-keep-raw'], {
      cwd,
      env: { HOME: home },
    });
    expect(run.exitCode).toBe(EXIT_SUCCESS);
    const body = JSON.parse(run.stdout) as { run_id: string };
    const runDir = join(cwd, '.aimo', 'runs', body.run_id);
    expect(await Bun.file(join(runDir, EXECUTE_STDOUT_TXT_BASENAME)).exists()).toBe(false);
    expect(await Bun.file(join(runDir, EXECUTE_STDERR_TXT_BASENAME)).exists()).toBe(false);
    expect(await Bun.file(join(runDir, GIT_DIFF_AFTER_BASENAME)).exists()).toBe(false);
    expect(await Bun.file(join(runDir, 'execute.stdout.shrunk.md')).exists()).toBe(true);
    const sidecar = JSON.parse(await Bun.file(join(runDir, WORKERS_JSON_BASENAME)).text()) as {
      calls: readonly unknown[];
    };
    expect(sidecar.calls.length).toBe(3);
  });
});
