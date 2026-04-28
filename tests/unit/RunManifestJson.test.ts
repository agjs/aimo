/**
 * @file RunManifestJson.test.ts
 */

import { CURRENT_SCHEMA_VERSION } from '@core/contracts/SchemaVersion.constants';
import { serializePlanManifestJson } from '@core/runs/RunManifestJson.behavior';
import { describe, expect, it } from 'bun:test';

describe('serializePlanManifestJson', () => {
  it('pretty-prints JSON with trailing newline', () => {
    const text = serializePlanManifestJson({
      schema_version: CURRENT_SCHEMA_VERSION,
      run_id: 'rid',
      stage: 'plan',
      created_at_ms: 42,
      profile: 'default',
      provider: 'fake',
      model: 'stub',
    });
    expect(text.endsWith('\n')).toBe(true);
    const parsed = JSON.parse(text) as Record<string, unknown>;
    expect(parsed.schema_version).toBe(CURRENT_SCHEMA_VERSION);
    expect(parsed.run_id).toBe('rid');
    expect(parsed.stage).toBe('plan');
    expect(parsed.created_at_ms).toBe(42);
  });
});
