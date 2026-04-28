/**
 * @file EnvPrecedence.test.ts
 * @description Unit tests for {@link mergeEnvLayers}.
 */

import { mergeEnvLayers } from '@core/config/EnvPrecedence.behavior';
import { describe, expect, it } from 'bun:test';

describe('mergeEnvLayers', () => {
  it('lets earlier (higher-precedence) maps win on conflicts', () => {
    const merged = mergeEnvLayers([{ A: 'from_first' }, { A: 'from_second', B: 'only_second' }]);
    expect(merged).toEqual({ A: 'from_first', B: 'only_second' });
  });

  it('skips empty string values', () => {
    const merged = mergeEnvLayers([{ X: '' }, { Z: 'ok' }]);
    expect(merged).toEqual({ Z: 'ok' });
  });

  it('merges three layers left-to-right precedence', () => {
    const merged = mergeEnvLayers([
      { P: 'process' },
      { P: 'project', Q: 'project' },
      { P: 'user', Q: 'user', R: 'user' },
    ]);
    expect(merged).toEqual({ P: 'process', Q: 'project', R: 'user' });
  });
});
