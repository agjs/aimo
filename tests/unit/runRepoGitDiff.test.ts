/**
 * @file runRepoGitDiff.test.ts
 * @description Unit tests for bounded `git diff` in a repo root.
 */

import { appendFile, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runRepoGitDiff } from '@runtime/bun/runRepoGitDiff.bun';
import { describe, expect, it } from 'bun:test';

async function git(repo: string, args: string[]): Promise<number> {
  const p = Bun.spawn(['git', '-c', 'commit.gpgsign=false', ...args], {
    cwd: repo,
    stdout: 'ignore',
    stderr: 'pipe',
  });
  return p.exited;
}

describe('runRepoGitDiff', () => {
  it('returns unified diff for working tree vs HEAD after a commit', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aimo-git-diff-'));
    expect(await git(root, ['init'])).toBe(0);
    expect(await git(root, ['config', 'user.email', 'diff@test.local'])).toBe(0);
    expect(await git(root, ['config', 'user.name', 'aimo test'])).toBe(0);

    await writeFile(join(root, 'README.md'), 'v1\n', 'utf8');
    expect(await git(root, ['add', 'README.md'])).toBe(0);
    expect(await git(root, ['commit', '-m', 'init'])).toBe(0);

    await appendFile(join(root, 'README.md'), 'v2\n', 'utf8');

    const r = await runRepoGitDiff(root, {});
    expect(r.exit_code).toBe(0);
    expect(r.output).toContain('README.md');
    expect(r.truncated).toBe(false);
  });

  it('returns staged diff when staged is true', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aimo-git-diff-staged-'));
    expect(await git(root, ['init'])).toBe(0);
    expect(await git(root, ['config', 'user.email', 'diff@test.local'])).toBe(0);
    expect(await git(root, ['config', 'user.name', 'aimo test'])).toBe(0);

    await writeFile(join(root, 'a.txt'), 'one\n', 'utf8');
    expect(await git(root, ['add', 'a.txt'])).toBe(0);
    expect(await git(root, ['commit', '-m', 'c1'])).toBe(0);

    await appendFile(join(root, 'a.txt'), 'two\n', 'utf8');
    expect(await git(root, ['add', 'a.txt'])).toBe(0);

    const r = await runRepoGitDiff(root, { staged: true });
    expect(r.exit_code).toBe(0);
    expect(r.output).toContain('a.txt');
  });

  it('returns non-zero exit when cwd is not a git repository', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aimo-not-git-diff-'));
    const r = await runRepoGitDiff(root, {});
    expect(r.exit_code).not.toBe(0);
    expect(r.output.length).toBeGreaterThan(0);
  });
});
