/**
 * @file CleanupRegistry.test.ts
 * @description LIFO drain order for {@link CleanupRegistry}.
 */

import { CleanupRegistry } from '@core/lifecycle/CleanupRegistry.behavior';
import { describe, expect, it } from 'bun:test';

describe('CleanupRegistry', () => {
  it('runs callbacks in reverse registration order', async () => {
    const log: string[] = [];
    const r = new CleanupRegistry();
    r.register(() => {
      log.push('a');
    });
    r.register(() => {
      log.push('b');
    });
    await r.drain();
    expect(log).toEqual(['b', 'a']);
  });
});
