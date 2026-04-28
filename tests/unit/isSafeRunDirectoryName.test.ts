/**
 * @file isSafeRunDirectoryName.test.ts
 */

import { isSafeRunDirectoryName } from '@core/execute/isSafeRunDirectoryName.behavior';
import { describe, expect, it } from 'bun:test';

describe('isSafeRunDirectoryName', () => {
  it('accepts uuid-like ids', () => {
    expect(isSafeRunDirectoryName('00000000-0000-0000-0000-000000000001')).toBe(true);
  });

  it('rejects path segments', () => {
    expect(isSafeRunDirectoryName('../evil')).toBe(false);
    expect(isSafeRunDirectoryName('a/b')).toBe(false);
  });
});
