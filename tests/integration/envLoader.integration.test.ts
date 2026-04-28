/**
 * @file envLoader.integration.test.ts
 * @description Exercises {@link loadResolvedEnv} against a temporary project `.env` file.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadResolvedEnv } from '@app/wireDefaults';
import { describe, expect, it } from 'bun:test';

describe('loadResolvedEnv', () => {
  it('reads a unique key from a project .env under cwd', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aimo-env-'));

    try {
      const key = `AIMO_ITEST_${process.pid}_${Date.now()}`;
      await writeFile(join(dir, '.env'), `${key}=from_project\n`, 'utf8');
      const merged = await loadResolvedEnv(dir);
      expect(merged[key]).toBe('from_project');
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
