/**
 * @file cliPing.e2e.test.ts
 * @description Subprocess smoke for `aimo ping` (in-process fake chat port).
 */

import { EXIT_SUCCESS } from '@core/contracts/ExitCodes.constants';
import { describe, expect, it } from 'bun:test';

import { spawnCli } from '../_helpers/spawnCli';

describe('cli ping (e2e)', () => {
  it('returns fake reply as json', async () => {
    const { exitCode, stdout, stderr } = await spawnCli(['ping', '--json']);
    expect(exitCode).toBe(EXIT_SUCCESS);
    expect(stderr).toBe('');
    const body = JSON.parse(stdout) as { ok: boolean; reply: string; id: string };
    expect(body.ok).toBe(true);
    expect(body.reply).toBe('[fake:stub] ping');
    expect(body.id).toMatch(/^fake-\d+$/);
  });
});
