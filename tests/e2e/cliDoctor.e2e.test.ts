/**
 * @file cliDoctor.e2e.test.ts
 * @description Subprocess tests for `aimo doctor` (merged YAML + exit codes).
 */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { EXIT_CONFIG_ERROR, EXIT_SUCCESS } from '@core/contracts/ExitCodes.constants';
import { PROJECT_AIMO_YAML_BASENAME } from '@runtime/bun/ConfigLoader.bun';
import { describe, expect, it } from 'bun:test';

import { spawnCli } from '../_helpers/spawnCli';
import { createIsolatedHomeAndProject } from './_helpers/isolatedHomeProject';

describe('cli doctor (e2e)', () => {
  it('exits 0 with --json when no yaml files exist (defaults)', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    const { exitCode, stdout, stderr } = await spawnCli(['doctor', '--json'], {
      cwd,
      env: { HOME: home },
    });
    expect(exitCode).toBe(EXIT_SUCCESS);
    expect(stderr).toBe('');
    const payload = JSON.parse(stdout) as {
      ok: boolean;
      schema_version?: number;
      profile_names?: string[];
    };
    expect(payload.ok).toBe(true);
    expect(payload.schema_version).toBe(1);
    expect(payload.profile_names).toEqual([]);
  });

  it('exits 0 with --json when project aimo.yaml is valid', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    await writeFile(
      join(cwd, PROJECT_AIMO_YAML_BASENAME),
      `profiles:
  default:
    plan:
      provider: fake
      model: stub
`,
      'utf8',
    );
    const { exitCode, stdout, stderr } = await spawnCli(['doctor', '--json'], {
      cwd,
      env: { HOME: home },
    });
    expect(exitCode).toBe(EXIT_SUCCESS);
    expect(stderr).toBe('');
    const payload = JSON.parse(stdout) as {
      ok: boolean;
      default_profile?: string;
      profile_names?: string[];
    };
    expect(payload.ok).toBe(true);
    expect(payload.default_profile).toBe('default');
    expect(payload.profile_names).toEqual(['default']);
  });

  it('exits CONFIG_ERROR with --json when project yaml is invalid for schema', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    await writeFile(
      join(cwd, PROJECT_AIMO_YAML_BASENAME),
      `profiles:
  default:
    execute:
      type: delegated
      command: "not-an-array"
`,
      'utf8',
    );
    const { exitCode, stdout, stderr } = await spawnCli(['doctor', '--json'], {
      cwd,
      env: { HOME: home },
    });
    expect(exitCode).toBe(EXIT_CONFIG_ERROR);
    expect(stderr).toBe('');
    const payload = JSON.parse(stdout) as { ok: boolean; messages?: string[] };
    expect(payload.ok).toBe(false);
    expect(payload.messages?.join('\n')).toMatch(/command/i);
  });

  it('merges user global yaml under isolated HOME; project wins on conflict', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    const userYaml = join(home, '.config', 'ai-model-orchestrator', 'config.yaml');
    await writeFile(
      userYaml,
      `profiles:
  default:
    plan:
      provider: user-layer
      model: old
`,
      'utf8',
    );
    await writeFile(
      join(cwd, PROJECT_AIMO_YAML_BASENAME),
      `profiles:
  default:
    plan:
      provider: project-layer
      model: new
`,
      'utf8',
    );
    const { exitCode, stdout } = await spawnCli(['doctor', '--json'], {
      cwd,
      env: { HOME: home },
    });
    expect(exitCode).toBe(EXIT_SUCCESS);
    const payload = JSON.parse(stdout) as {
      ok: boolean;
      paths?: { userYamlPresent?: boolean; projectYamlPresent?: boolean };
      default_profile_plan_provider?: string | null;
      default_profile_plan_model?: string | null;
    };
    expect(payload.ok).toBe(true);
    expect(payload.paths?.userYamlPresent).toBe(true);
    expect(payload.paths?.projectYamlPresent).toBe(true);
    expect(payload.default_profile_plan_provider).toBe('project-layer');
    expect(payload.default_profile_plan_model).toBe('new');

    const human = await spawnCli(['doctor'], { cwd, env: { HOME: home } });
    expect(human.exitCode).toBe(EXIT_SUCCESS);
    expect(human.stdout).toContain('Configuration valid.');
    expect(human.stdout).toContain('profiles: default');
  });

  it('prints errors to stderr in human mode when config is invalid', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    await writeFile(
      join(cwd, PROJECT_AIMO_YAML_BASENAME),
      `default_profile: ghost
profiles:
  only_other:
    plan: { provider: x, model: y }
`,
      'utf8',
    );
    const { exitCode, stdout, stderr } = await spawnCli(['doctor'], {
      cwd,
      env: { HOME: home },
    });
    expect(exitCode).toBe(EXIT_CONFIG_ERROR);
    expect(stdout).toBe('');
    expect(stderr).toContain('Configuration invalid.');
    expect(stderr).toContain('default_profile');
  });
});
