/**
 * @file assertPlanPathAnchoredInRepoRoot.test.ts
 */

import { join } from 'node:path';

import { assertPlanPathAnchoredInRepoRoot } from '@core/execute/assertPlanPathAnchoredInRepoRoot.behavior';
import { describe, expect, it } from 'bun:test';

describe('assertPlanPathAnchoredInRepoRoot', () => {
  it('accepts a plan file under repo root', () => {
    const root = join('projects', 'app');
    const r = assertPlanPathAnchoredInRepoRoot({
      repoRoot: root,
      planPath: join(root, '.aimo', 'runs', 'u', 'plan.md'),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.planPathResolved).toContain('plan.md');
  });

  it('rejects escape outside repo root', () => {
    const r = assertPlanPathAnchoredInRepoRoot({
      repoRoot: join('projects', 'app'),
      planPath: join('projects', 'other', 'plan.md'),
    });
    expect(r.ok).toBe(false);
  });
});
