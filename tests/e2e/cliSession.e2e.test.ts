/**
 * @file cliSession.e2e.test.ts
 * @description Subprocess tests for `aimo session` and `aimo session resume`.
 */

import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { EXIT_SUCCESS } from '@core/contracts/ExitCodes.constants';
import { describe, expect, it } from 'bun:test';

import { spawnCli } from '../_helpers/spawnCli';
import { createIsolatedHomeAndProject } from './_helpers/isolatedHomeProject';

describe('cli session (e2e)', () => {
  it('runs /status then /exit with fake plan profile', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    const init = await spawnCli(['init', '--json'], { cwd, env: { HOME: home } });
    expect(init.exitCode).toBe(EXIT_SUCCESS);

    const stdinText = '/status\n/exit\n';
    const r = await spawnCli(['session'], { cwd, env: { HOME: home }, stdinText });
    expect(r.exitCode).toBe(EXIT_SUCCESS);
    expect(r.stderr).toContain('session:');
    expect(r.stderr).toContain('mode:');

    const sessionsDir = join(cwd, '.aimo', 'sessions');
    const ids = await readdir(sessionsDir);
    expect(ids.length).toBe(1);
    const sessionId = ids[0] ?? '';

    const r2 = await spawnCli(['session', 'resume', sessionId], {
      cwd,
      env: { HOME: home },
      stdinText: '/resume\n/exit\n',
    });
    expect(r2.exitCode).toBe(EXIT_SUCCESS);
    expect(r2.stderr).toContain('replayed');
  });

  it('reads a repo file via /read when session.tools allows read_file', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    const init = await spawnCli(['init', '--json'], { cwd, env: { HOME: home } });
    expect(init.exitCode).toBe(EXIT_SUCCESS);

    await writeFile(
      join(cwd, 'aimo.yaml'),
      `schema_version: 1
default_profile: default
profiles:
  default:
    plan:
      provider: fake
      model: stub
    execute:
      type: builtin
    review:
      provider: fake
      model: stub
session:
  tools:
    read_file: allow
`,
      'utf8',
    );
    await writeFile(join(cwd, 'note.txt'), 'hello from e2e\n', 'utf8');

    const r = await spawnCli(['session'], {
      cwd,
      env: { HOME: home },
      stdinText: '/read note.txt\n/exit\n',
    });
    expect(r.exitCode).toBe(EXIT_SUCCESS);
    expect(r.stderr).toContain('hello from e2e');
  });

  it('finds text via /grep when session.tools allows grep', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    const init = await spawnCli(['init', '--json'], { cwd, env: { HOME: home } });
    expect(init.exitCode).toBe(EXIT_SUCCESS);

    await writeFile(
      join(cwd, 'aimo.yaml'),
      `schema_version: 1
default_profile: default
profiles:
  default:
    plan:
      provider: fake
      model: stub
    execute:
      type: builtin
    review:
      provider: fake
      model: stub
session:
  tools:
    grep: allow
`,
      'utf8',
    );
    await writeFile(join(cwd, 'needle.txt'), 'AIMO_E2E_GREP_MARKER\n', 'utf8');

    const r = await spawnCli(['session'], {
      cwd,
      env: { HOME: home },
      stdinText: '/grep AIMO_E2E_GREP_MARKER\n/exit\n',
    });
    expect(r.exitCode).toBe(EXIT_SUCCESS);
    expect(r.stderr).toContain('needle.txt');
    expect(r.stderr).toContain('AIMO_E2E_GREP_MARKER');
  });

  it('lists repo paths via /tree when session.tools allows list_tree', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    const init = await spawnCli(['init', '--json'], { cwd, env: { HOME: home } });
    expect(init.exitCode).toBe(EXIT_SUCCESS);

    await writeFile(
      join(cwd, 'aimo.yaml'),
      `schema_version: 1
default_profile: default
profiles:
  default:
    plan:
      provider: fake
      model: stub
    execute:
      type: builtin
    review:
      provider: fake
      model: stub
session:
  tools:
    list_tree: allow
`,
      'utf8',
    );
    await mkdir(join(cwd, 'e2e_pkg'), { recursive: true });
    await writeFile(join(cwd, 'e2e_pkg', 'leaf.txt'), 'x\n', 'utf8');

    const r = await spawnCli(['session'], {
      cwd,
      env: { HOME: home },
      stdinText: '/tree\n/exit\n',
    });
    expect(r.exitCode).toBe(EXIT_SUCCESS);
    expect(r.stderr).toContain('e2e_pkg/');
    expect(r.stderr).toContain('e2e_pkg/leaf.txt');
  });

  it('prints git status via /git-status when session.tools allows git_status', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    const init = await spawnCli(['init', '--json'], { cwd, env: { HOME: home } });
    expect(init.exitCode).toBe(EXIT_SUCCESS);

    const gi = Bun.spawn(['git', 'init'], { cwd, stdout: 'ignore', stderr: 'pipe' });
    expect(await gi.exited).toBe(0);

    await writeFile(
      join(cwd, 'aimo.yaml'),
      `schema_version: 1
default_profile: default
profiles:
  default:
    plan:
      provider: fake
      model: stub
    execute:
      type: builtin
    review:
      provider: fake
      model: stub
session:
  tools:
    git_status: allow
`,
      'utf8',
    );
    await writeFile(join(cwd, 'dirty.txt'), 'e2e-git\n', 'utf8');

    const r = await spawnCli(['session'], {
      cwd,
      env: { HOME: home },
      stdinText: '/git-status\n/exit\n',
    });
    expect(r.exitCode).toBe(EXIT_SUCCESS);
    expect(r.stderr).toContain('git status');
    expect(r.stderr).toContain('dirty.txt');
  });

  it('prints git diff via /git-diff when session.tools allows git_diff', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    const init = await spawnCli(['init', '--json'], { cwd, env: { HOME: home } });
    expect(init.exitCode).toBe(EXIT_SUCCESS);

    expect(await Bun.spawn(['git', 'init'], { cwd, stdout: 'ignore', stderr: 'pipe' }).exited).toBe(
      0,
    );
    expect(
      await Bun.spawn(['git', 'config', 'user.email', 'e2e-diff@test'], {
        cwd,
        stdout: 'ignore',
        stderr: 'pipe',
      }).exited,
    ).toBe(0);
    expect(
      await Bun.spawn(['git', 'config', 'user.name', 'e2e'], {
        cwd,
        stdout: 'ignore',
        stderr: 'pipe',
      }).exited,
    ).toBe(0);

    await writeFile(join(cwd, 'tracked.md'), 'line1\n', 'utf8');
    expect(
      await Bun.spawn(['git', 'add', 'tracked.md'], { cwd, stdout: 'ignore', stderr: 'pipe' })
        .exited,
    ).toBe(0);
    expect(
      await Bun.spawn(
        ['git', '-c', 'commit.gpgsign=false', 'commit', '--no-gpg-sign', '-m', 'init'],
        { cwd, stdout: 'ignore', stderr: 'pipe' },
      ).exited,
    ).toBe(0);

    await writeFile(join(cwd, 'tracked.md'), 'line1\nline2\n', 'utf8');

    await writeFile(
      join(cwd, 'aimo.yaml'),
      `schema_version: 1
default_profile: default
profiles:
  default:
    plan:
      provider: fake
      model: stub
    execute:
      type: builtin
    review:
      provider: fake
      model: stub
session:
  tools:
    git_diff: allow
`,
      'utf8',
    );

    const r = await spawnCli(['session'], {
      cwd,
      env: { HOME: home },
      stdinText: '/git-diff\n/exit\n',
    });
    expect(r.exitCode).toBe(EXIT_SUCCESS);
    expect(r.stderr).toContain('git diff');
    expect(r.stderr).toContain('tracked.md');
  });

  it('reads a run artifact via /show when session.tools allows show_artifact', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    const init = await spawnCli(['init', '--json'], { cwd, env: { HOME: home } });
    expect(init.exitCode).toBe(EXIT_SUCCESS);

    const runId = '550e8400-e29b-41d4-a716-446655440000';
    const runDir = join(cwd, '.aimo', 'runs', runId);
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'artifact.txt'), 'AIMO_E2E_SHOW_MARKER\n', 'utf8');

    await writeFile(
      join(cwd, 'aimo.yaml'),
      `schema_version: 1
default_profile: default
profiles:
  default:
    plan:
      provider: fake
      model: stub
    execute:
      type: builtin
    review:
      provider: fake
      model: stub
session:
  tools:
    show_artifact: allow
`,
      'utf8',
    );

    const bind = await spawnCli(['session'], {
      cwd,
      env: { HOME: home },
      stdinText: `/use ${runId}\n/exit\n`,
    });
    expect(bind.exitCode).toBe(EXIT_SUCCESS);

    const sessionIds = await readdir(join(cwd, '.aimo', 'sessions'));
    expect(sessionIds.length).toBe(1);
    const sessionId = sessionIds[0] ?? '';

    const r = await spawnCli(['session', 'resume', sessionId], {
      cwd,
      env: { HOME: home },
      stdinText: '/show artifact.txt\n/exit\n',
    });
    expect(r.exitCode).toBe(EXIT_SUCCESS);
    expect(r.stderr).toContain('AIMO_E2E_SHOW_MARKER');
  });

  it('expands @plan into a CONTEXT block and echoes via fake provider', async () => {
    const { home, cwd } = await createIsolatedHomeAndProject();
    const init = await spawnCli(['init', '--json'], { cwd, env: { HOME: home } });
    expect(init.exitCode).toBe(EXIT_SUCCESS);

    const runId = 'mention-e2e-run-1';
    const runDir = join(cwd, '.aimo', 'runs', runId);
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'plan.md'), 'AIMO_E2E_PLAN_MARKER\n', 'utf8');

    await writeFile(
      join(cwd, 'aimo.yaml'),
      `schema_version: 1
default_profile: default
profiles:
  default:
    plan:
      provider: fake
      model: stub
    execute:
      type: builtin
    review:
      provider: fake
      model: stub
session:
  tools:
    show_artifact: allow
`,
      'utf8',
    );

    const r = await spawnCli(['session'], {
      cwd,
      env: { HOME: home },
      stdinText: `/use ${runId}\n@plan summarize\n/exit\n`,
    });
    expect(r.exitCode).toBe(EXIT_SUCCESS);
    expect(r.stderr).toContain('<CONTEXT name="@plan">');
    expect(r.stderr).toContain('AIMO_E2E_PLAN_MARKER');

    const sessionIds = await readdir(join(cwd, '.aimo', 'sessions'));
    expect(sessionIds.length).toBe(1);
    const sessionId = sessionIds[0] ?? '';
    const events = await Bun.file(join(cwd, '.aimo', 'sessions', sessionId, 'events.jsonl')).text();
    expect(events).toContain('"tool":"show_artifact"');
    expect(events).toContain(`"run_id":"${runId}"`);
    expect(events).toContain('"path":"plan.md"');
  });
});
