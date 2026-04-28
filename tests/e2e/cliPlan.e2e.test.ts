/**
 * @file cliPlan.e2e.test.ts
 * @description Subprocess tests for `aimo plan` after `aimo init`.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { EXIT_CONFIG_ERROR, EXIT_SUCCESS } from '@core/contracts/ExitCodes.constants';
import { PROJECT_AIMO_YAML_BASENAME } from '@runtime/bun/ConfigLoader.bun';
import { describe, expect, it } from 'bun:test';

import { spawnCli } from '../_helpers/spawnCli';
import { createIsolatedHomeAndProject } from './_helpers/isolatedHomeProject';

describe('cli plan (e2e)', () => {
  it('writes plan.md and manifest, prints markdown or --json', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    const init = await spawnCli(['init', '--json'], { cwd, env: { HOME: home } });
    expect(init.exitCode).toBe(EXIT_SUCCESS);

    const r = await spawnCli(['plan', 'hello task', '--json'], { cwd, env: { HOME: home } });
    expect(r.exitCode).toBe(EXIT_SUCCESS);
    const body = JSON.parse(r.stdout) as {
      ok: boolean;
      run_id: string;
      plan_path: string;
      manifest_path: string;
      markdown: string;
    };
    expect(body.ok).toBe(true);
    expect(body.markdown).toContain('[fake:stub]');
    expect(body.markdown).toContain('hello task');
    expect(body.plan_path).toContain('.aimo/runs/');
    expect(body.manifest_path).toContain('manifest.json');

    const planText = await readFile(body.plan_path, 'utf8');
    expect(planText.trim()).toBe(body.markdown.trim());

    const mani = JSON.parse(await readFile(body.manifest_path, 'utf8')) as {
      stage: string;
      run_id: string;
      provider: string;
      model: string;
    };
    expect(mani.stage).toBe('plan');
    expect(mani.run_id).toBe(body.run_id);
    expect(mani.provider).toBe('fake');
    expect(mani.model).toBe('stub');

    const plain = await spawnCli(['plan', 'second'], { cwd, env: { HOME: home } });
    expect(plain.exitCode).toBe(EXIT_SUCCESS);
    expect(plain.stdout).toContain('[fake:stub]');
    expect(plain.stdout).toContain('second');
  });

  it('rejects unsupported plan provider', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    await spawnCli(['init', '--json'], { cwd, env: { HOME: home } });
    await Bun.write(
      join(cwd, PROJECT_AIMO_YAML_BASENAME),
      `schema_version: 1
default_profile: default
profiles:
  default:
    plan:
      provider: openai-compatible
      model: gpt-4
      base_url: https://api.openai.com/v1
`,
    );
    const r = await spawnCli(['plan', 'x', '--json'], { cwd, env: { HOME: home } });
    expect(r.exitCode).toBe(EXIT_CONFIG_ERROR);
    expect(r.stderr).toContain('not supported');
  });
});
