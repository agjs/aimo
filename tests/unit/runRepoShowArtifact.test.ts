/**
 * @file runRepoShowArtifact.test.ts
 * @description Unit tests for bounded run-artifact reads.
 */

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { relativeRunDirectoryPath } from '@core/runs/AimoRunPaths.constants';
import { runRepoShowArtifact } from '@runtime/bun/runRepoShowArtifact.bun';
import { describe, expect, it } from 'bun:test';

describe('runRepoShowArtifact', () => {
  it('reads a file under .aimo/runs/<id>/', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aimo-show-art-'));
    const runId = 'e2e-run-show-artifact';
    const runDir = join(root, relativeRunDirectoryPath(runId));
    await mkdir(runDir, { recursive: true });
    await writeFile(join(runDir, 'note.txt'), 'hello artifact', 'utf8');

    const r = await runRepoShowArtifact(root, { run_id: runId, path: 'note.txt' });
    expect(r.content).toContain('hello artifact');
    expect(r.truncated).toBe(false);
    expect(r.total_lines).toBe(1);
  });

  it('rejects paths that escape the run directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aimo-show-art-escape-'));
    const runId = 'run-a';
    const runDir = join(root, relativeRunDirectoryPath(runId));
    await mkdir(runDir, { recursive: true });
    await writeFile(join(root, 'secret.txt'), 'nope\n', 'utf8');

    let caught: unknown;

    try {
      await runRepoShowArtifact(root, { run_id: runId, path: '../../../secret.txt' });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeDefined();
    expect(caught instanceof Error ? caught.message : String(caught)).toMatch(
      /outside run directory/,
    );
  });
});
