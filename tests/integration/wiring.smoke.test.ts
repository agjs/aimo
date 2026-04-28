/**
 * @file wiring.smoke.test.ts
 * @description Ensures composition placeholders stay importable across layers (guards dep wiring until Milestone A).
 */

import { createDefaultClockPort } from '@app/wireDefaults';
import { getPipelinePlaceholderExitCode } from '@features/runPipeline.feature';
import { describe, expect, it } from 'bun:test';

describe('wiring smoke', () => {
  it('resolves app → runtime clock and features → core', () => {
    expect(Number.isFinite(createDefaultClockPort().nowMs())).toBe(true);
    expect(getPipelinePlaceholderExitCode()).toBe(0);
  });
});
