/**
 * @file SchemaVersion.test.ts
 * @description Schema version constant is stable for v1 artifacts.
 */

import { CURRENT_SCHEMA_VERSION } from '@core/contracts/SchemaVersion.constants';
import { describe, expect, it } from 'bun:test';

describe('SchemaVersion', () => {
  it('is 1 for initial release line', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
  });
});
