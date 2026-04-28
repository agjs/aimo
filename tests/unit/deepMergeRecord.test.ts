import { mergeConfigRecordLayers } from '@core/config/deepMergeRecord.behavior';
import { describe, expect, it } from 'bun:test';

describe('mergeConfigRecordLayers', () => {
  it('returns empty object for no layers', () => {
    expect(mergeConfigRecordLayers([])).toEqual({});
  });

  it('returns a shallow copy of a single layer', () => {
    const a = { x: 1 };
    const out = mergeConfigRecordLayers([a]);
    expect(out).toEqual({ x: 1 });
    out.x = 2;
    expect(a.x).toBe(1);
  });

  it('lets later layers override scalars', () => {
    expect(mergeConfigRecordLayers([{ a: 1 }, { a: 2 }])).toEqual({ a: 2 });
  });

  it('deep-merges nested objects', () => {
    expect(
      mergeConfigRecordLayers([
        { profiles: { default: { plan: { provider: 'p', model: 'm' } } } },
        { profiles: { default: { review: { provider: 'r', model: 'x' } } } },
      ]),
    ).toEqual({
      profiles: {
        default: {
          plan: { provider: 'p', model: 'm' },
          review: { provider: 'r', model: 'x' },
        },
      },
    });
  });

  it('replaces arrays instead of merging element-wise', () => {
    expect(mergeConfigRecordLayers([{ x: [1, 2] }, { x: [3] }])).toEqual({ x: [3] });
  });
});
