/**
 * @file runRepoListTree.test.ts
 * @description Unit tests for bounded repo tree listing.
 */

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runRepoListTree } from '@runtime/bun/runRepoListTree.bun';
import { describe, expect, it } from 'bun:test';

describe('runRepoListTree', () => {
  it('lists files and dirs with trailing slash on directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aimo-tree-'));
    await writeFile(join(root, 'root.txt'), 'x', 'utf8');
    await mkdir(join(root, 'pkg'));
    await writeFile(join(root, 'pkg', 'mod.ts'), 'export {}\n', 'utf8');

    const r = await runRepoListTree(root, { max_depth: 4, max_entries: 100 });

    expect(r.lines).toContain('root.txt');
    expect(r.lines).toContain('pkg/');
    expect(r.lines).toContain('pkg/mod.ts');
    expect(r.truncated_entries).toBe(false);
    expect(r.dirs_visited).toBeGreaterThanOrEqual(2);
  });

  it('respects max_depth (no nested files under deep dirs)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aimo-tree-depth-'));
    await mkdir(join(root, 'a'));
    await mkdir(join(root, 'a', 'b'));
    await writeFile(join(root, 'a', 'b', 'deep.txt'), 'z', 'utf8');

    const shallow = await runRepoListTree(root, { max_depth: 0, max_entries: 50 });
    expect(shallow.lines).toContain('a/');
    expect(shallow.lines.some((l) => l.includes('deep'))).toBe(false);

    const deeper = await runRepoListTree(root, { max_depth: 3, max_entries: 50 });
    expect(deeper.lines.some((l) => l.endsWith('deep.txt'))).toBe(true);
  });
});
