/**
 * @file substitutePlanPathInArgv.test.ts
 */

import { substitutePlanPathInArgv } from '@core/execute/substitutePlanPathInArgv.behavior';
import { describe, expect, it } from 'bun:test';

describe('substitutePlanPathInArgv', () => {
  it('replaces every token occurrence in each argv element', () => {
    const out = substitutePlanPathInArgv(['cat', '{plan_path}', 'x{plan_path}y'], '/abs/plan.md');
    expect(out).toEqual(['cat', '/abs/plan.md', 'x/abs/plan.mdy']);
  });
});
