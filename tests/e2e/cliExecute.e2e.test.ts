/**
 * @file cliExecute.e2e.test.ts
 * @description Subprocess tests for `aimo execute` after `init` + `plan` with delegated profile.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { EXIT_SUCCESS } from '@core/contracts/ExitCodes.constants';
import { PROJECT_AIMO_YAML_BASENAME } from '@runtime/bun/ConfigLoader.bun';
import { describe, expect, it } from 'bun:test';

import { spawnCli } from '../_helpers/spawnCli';
import { createIsolatedHomeAndProject } from './_helpers/isolatedHomeProject';

async function initGitWithEmptyCommit(cwd: string): Promise<void> {
  const steps: readonly (readonly string[])[] = [
    ['git', 'init'],
    ['git', 'config', 'user.email', 'aimo@test'],
    ['git', 'config', 'user.name', 'aimo'],
    ['git', 'commit', '--allow-empty', '-m', 'base'],
  ];
  for (const argv of steps) {
    const p = Bun.spawn([...argv], { cwd, stdout: 'pipe', stderr: 'pipe' });
    expect(await p.exited).toBe(0);
  }
}

describe('cli execute (e2e)', () => {
  it('runs delegated argv and writes diff + execute.result.json', async () => {
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
    const planBody = JSON.parse(plan.stdout) as { run_id: string };
    const runId = planBody.run_id;

    const ex = await spawnCli(['execute', '--run', runId, '--json'], { cwd, env: { HOME: home } });
    expect(ex.exitCode).toBe(EXIT_SUCCESS);
    const body = JSON.parse(ex.stdout) as {
      ok: boolean;
      exit_code: number;
      artifacts: { git_diff_before: string; execute_result: string };
    };
    expect(body.ok).toBe(true);
    expect(body.exit_code).toBe(0);
    const before = await readFile(body.artifacts.git_diff_before, 'utf8');
    expect(typeof before).toBe('string');
    const result = JSON.parse(await readFile(body.artifacts.execute_result, 'utf8')) as {
      stage: string;
      exit_code: number;
    };
    expect(result.stage).toBe('execute');
    expect(result.exit_code).toBe(0);
  });
});
