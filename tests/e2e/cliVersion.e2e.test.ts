/**
 * @file cliVersion.e2e.test.ts
 * @description Subprocess smoke test for `aimo --version`.
 */

import { describe, expect, it } from 'bun:test';

import { spawnCli } from '../_helpers/spawnCli';

describe('cli (e2e)', () => {
  it('prints semver on --version', async () => {
    const { exitCode, stdout, stderr } = await spawnCli(['--version']);
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
    expect(stderr).toBe('');
  });
});
