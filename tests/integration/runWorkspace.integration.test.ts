/**
 * @file runWorkspace.integration.test.ts
 */

import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { relativeManifestJsonPath, relativePlanMdPath } from '@core/runs/AimoRunPaths.constants';
import { prepareRunArtifactPaths, writePlanArtifacts } from '@runtime/bun/RunWorkspace.bun';
import { describe, expect, it } from 'bun:test';

describe('RunWorkspace (integration)', () => {
  it('creates run dir and writes manifest then plan', async () => {
    const root = await mkdtemp(join(tmpdir(), 'aimo-rw-'));
    const runId = '00000000-0000-0000-0000-00000000abcd';
    const paths = await prepareRunArtifactPaths(root, runId);
    expect(paths.planPath).toBe(join(root, relativePlanMdPath(runId)));
    expect(paths.manifestPath).toBe(join(root, relativeManifestJsonPath(runId)));
    await writePlanArtifacts(paths, {
      manifestJson: `{"run_id":"${runId}"}\n`,
      planMarkdown: '# Plan\n',
    });
    const m = await readFile(paths.manifestPath, 'utf8');
    const p = await readFile(paths.planPath, 'utf8');
    expect(m).toContain(runId);
    expect(p).toBe('# Plan\n');
  });
});
