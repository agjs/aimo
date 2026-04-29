/**
 * @file runRepoGitStatus.test.ts
 * @description Unit tests for bounded `git status` in a repo root.
 */

import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runRepoGitStatus } from '@runtime/bun/runRepoGitStatus.bun';
import { describe, expect, it } from 'bun:test';

describe('runRepoGitStatus', () => {
  it('returns short status with exit 0 in a git work tree', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aimo-git-status-'));
    const init = Bun.spawn(['git', 'init'], { cwd: root, stdout: 'ignore', stderr: 'pipe' });
    expect(await init.exited).toBe(0);

    await writeFile(join(root, 'tracked.txt'), 'x\n', 'utf8');

    const r = await runRepoGitStatus(root, {});
    expect(r.exit_code).toBe(0);
    expect(r.output).toContain('tracked.txt');
    expect(r.truncated).toBe(false);
  });

  it('returns non-zero exit when cwd is not a git repository', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aimo-not-git-'));
    const r = await runRepoGitStatus(root, {});
    expect(r.exit_code).not.toBe(0);
    expect(r.output.length).toBeGreaterThan(0);
  });
});
