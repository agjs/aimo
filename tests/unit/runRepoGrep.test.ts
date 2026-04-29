/**
 * @file runRepoGrep.test.ts
 * @description Unit tests for bounded repo `grep` (including `context_lines`).
 */

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runRepoGrep } from '@runtime/bun/runRepoGrep.bun';
import { describe, expect, it } from 'bun:test';

describe('runRepoGrep', () => {
  it('returns matching lines without context by default', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aimo-grep-'));
    await writeFile(join(root, 'a.txt'), 'alpha\nbeta\n', 'utf8');

    const r = await runRepoGrep(root, { pattern: 'beta' });
    expect(r.truncated_matches).toBe(false);
    expect(r.matches).toEqual([{ path: 'a.txt', line: 2, text: 'beta' }]);
  });

  it('adds context rows before and after each hit', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aimo-grep-ctx-'));
    await writeFile(join(root, 'f.txt'), 'before\nTARGET\nafter\n', 'utf8');

    const r = await runRepoGrep(root, { pattern: '^TARGET$', context_lines: 1 });
    expect(r.matches.map((m) => ({ ...m }))).toEqual([
      { path: 'f.txt', line: 1, text: 'before', is_context_line: true },
      { path: 'f.txt', line: 2, text: 'TARGET' },
      { path: 'f.txt', line: 3, text: 'after', is_context_line: true },
    ]);
  });

  it('dedupes overlapping context from nearby hits', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aimo-grep-dedupe-'));
    await writeFile(join(root, 'g.txt'), 'a\nH1\nH2\nb\n', 'utf8');

    const r = await runRepoGrep(root, { pattern: '^H[12]$', context_lines: 1 });
    expect(r.matches.map((m) => m.line)).toEqual([1, 2, 3, 4]);
    const hits = r.matches.filter((m) => m.is_context_line !== true);
    expect(hits.map((m) => m.line)).toEqual([2, 3]);
  });

  it('caps pattern hits at max_matches while context is extra rows', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aimo-grep-cap-'));
    await writeFile(join(root, 'many.txt'), 'x\nhit\nx\nhit\nx\nhit\n', 'utf8');

    const r = await runRepoGrep(root, {
      pattern: '^hit$',
      context_lines: 1,
      max_matches: 2,
    });
    const hitRows = r.matches.filter((m) => m.is_context_line !== true);
    expect(hitRows).toHaveLength(2);
    expect(r.truncated_matches).toBe(true);
  });

  it('clamps context_lines at the per-side cap', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aimo-grep-clamp-'));
    const lines = Array.from({ length: 50 }, (_, i) => `L${String(i)}`).join('\n');
    await mkdir(join(root, 'sub'), { recursive: true });
    await writeFile(join(root, 'sub', 'deep.txt'), `${lines}\n`, 'utf8');

    const r = await runRepoGrep(root, {
      pattern: '^L25$',
      context_lines: 100,
      glob: '**/*.txt',
    });
    const ctx = r.matches.filter((m) => m.is_context_line === true);
    expect(ctx.length).toBe(40);
    const hit = r.matches.find((m) => m.is_context_line !== true);
    expect(hit?.line).toBe(26);
  });
});
