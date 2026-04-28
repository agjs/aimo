/**
 * @file delegatedExecute.integration.test.ts
 */

import { mkdir, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';

import { substitutePlanPathInArgv } from '@core/execute/substitutePlanPathInArgv.behavior';
import { PLAN_MD_FILENAME, relativeRunDirectoryPath } from '@core/runs/AimoRunPaths.constants';
import { runDelegatedArgv } from '@runtime/bun/DelegatedSpawn.bun';
import { readGitDiffHeadText } from '@runtime/bun/GitDiffHead.bun';
import { writeExecuteStageArtifacts } from '@runtime/bun/RunWorkspace.bun';
import { describe, expect, it } from 'bun:test';

const INTEGRATION_WORK_ROOT = join(import.meta.dir, '..', '..', '.aimo-test-work');

async function initGitWithEmptyCommit(cwd: string): Promise<void> {
  const init = Bun.spawn(['git', 'init'], { cwd, stdout: 'pipe', stderr: 'pipe' });
  expect(await init.exited).toBe(0);
  const commit = Bun.spawn(
    [
      'git',
      '-c',
      'user.email=aimo@test',
      '-c',
      'user.name=aimo',
      'commit',
      '--allow-empty',
      '--no-gpg-sign',
      '-m',
      'base',
    ],
    { cwd, stdout: 'pipe', stderr: 'pipe' },
  );
  expect(await commit.exited).toBe(0);
}

describe('delegated execute (integration)', () => {
  it('runs argv with substituted plan path and captures git diff HEAD', async () => {
    await mkdir(INTEGRATION_WORK_ROOT, { recursive: true });
    const root = await mkdtemp(join(INTEGRATION_WORK_ROOT, 'int-ex-'));
    await initGitWithEmptyCommit(root);
    const runId = 'run-int-1';
    const runDir = join(root, ...relativeRunDirectoryPath(runId).split('/'));
    await mkdir(runDir, { recursive: true });
    await Bun.write(join(runDir, PLAN_MD_FILENAME), '# plan\n');
    const planAbs = join(runDir, PLAN_MD_FILENAME);
    const argv = substitutePlanPathInArgv(['cat', '{plan_path}'], planAbs);
    const before = await readGitDiffHeadText(root);
    expect(before.ok).toBe(true);
    const spawned = await runDelegatedArgv({ cwd: root, argv: [...argv] });
    expect(spawned.exitCode).toBe(0);
    expect(spawned.stdout).toContain('# plan');
    const after = await readGitDiffHeadText(root);
    expect(after.ok).toBe(true);
    await writeExecuteStageArtifacts(runDir, {
      gitDiffBefore: before.ok ? before.text : '',
      gitDiffAfter: after.ok ? after.text : '',
      executeResultJson: '{}\n',
      executeStdout: spawned.stdout,
      executeStderr: spawned.stderr,
    });
  });
});
