/**
 * @file ResolvePlanStage.test.ts
 */

import { safeParseAimoConfig } from '@core/config/AimoConfig.schema';
import { resolvePlanStageForProfile } from '@core/plan/ResolvePlanStage.behavior';
import { describe, expect, it } from 'bun:test';

describe('resolvePlanStageForProfile', () => {
  it('errors when profile has no plan stage', () => {
    const cfg = safeParseAimoConfig({
      schema_version: 1,
      default_profile: 'default',
      profiles: { default: { execute: { type: 'builtin' } } },
    });
    expect(cfg.ok).toBe(true);
    if (!cfg.ok) {
      return;
    }
    const r = resolvePlanStageForProfile(cfg.data, 'default');
    expect(r.ok).toBe(false);
    if (r.ok) {
      return;
    }
    expect(r.message).toContain('no plan stage');
  });

  it('returns provider, model, and optional base_url', () => {
    const cfg = safeParseAimoConfig({
      schema_version: 1,
      default_profile: 'default',
      profiles: {
        default: {
          plan: { provider: 'fake', model: 'stub' },
        },
      },
    });
    expect(cfg.ok).toBe(true);
    if (!cfg.ok) {
      return;
    }
    const r = resolvePlanStageForProfile(cfg.data, 'default');
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.plan.provider).toBe('fake');
    expect(r.plan.model).toBe('stub');
    expect(r.plan.base_url).toBeUndefined();
  });

  it('includes base_url when set', () => {
    const cfg = safeParseAimoConfig({
      schema_version: 1,
      default_profile: 'default',
      profiles: {
        default: {
          plan: { provider: 'openai-compatible', model: 'x', base_url: 'https://example.com/v1' },
        },
      },
    });
    expect(cfg.ok).toBe(true);
    if (!cfg.ok) {
      return;
    }
    const r = resolvePlanStageForProfile(cfg.data, 'default');
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.plan.base_url).toBe('https://example.com/v1');
  });
});
