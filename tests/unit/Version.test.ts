/**
 * @file Version.test.ts
 * @description Smoke test that the test runner and path aliases work.
 */

import { PACKAGE_VERSION } from '@shared/constants/Version.constants';
import { describe, expect, it } from 'bun:test';

describe('Version.constants', () => {
  it('exports a semver-shaped string', () => {
    expect(PACKAGE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
