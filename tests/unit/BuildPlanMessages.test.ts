/**
 * @file BuildPlanMessages.test.ts
 */

import { buildPlanMessages } from '@core/plan/BuildPlanMessages.behavior';
import { describe, expect, it } from 'bun:test';

describe('buildPlanMessages', () => {
  it('returns system then user with the task', () => {
    const msgs = buildPlanMessages('ship feature X');
    expect(msgs).toHaveLength(2);
    expect(msgs[0]?.role).toBe('system');
    expect(msgs[0]?.content).toContain('markdown plan');
    expect(msgs[1]?.role).toBe('user');
    expect(msgs[1]?.content).toBe('ship feature X');
  });
});
