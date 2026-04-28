/**
 * @file cliUnknownFlag.e2e.test.ts
 * @description Commander exits with code 1 on unknown flags; CLI maps that to EXIT_OPERATIONAL_ERROR.
 */

import { EXIT_OPERATIONAL_ERROR } from '@core/contracts/ExitCodes.constants';
import { describe, expect, it } from 'bun:test';

import { spawnCli } from '../_helpers/spawnCli';

describe('cli (e2e) failure path', () => {
  it('exits with EXIT_OPERATIONAL_ERROR on unknown long flag', async () => {
    const { exitCode, stderr } = await spawnCli(['--definitely-not-a-flag']);
    expect(exitCode).toBe(EXIT_OPERATIONAL_ERROR);
    expect(stderr.length).toBeGreaterThan(0);
  });
});
