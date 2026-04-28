/**
 * @file ResolveReviewStage.test.ts
 */

import { safeParseAimoConfig } from '@core/config/AimoConfig.schema';
import { resolveReviewStageForProfile } from '@core/review/ResolveReviewStage.behavior';
import { describe, expect, it } from 'bun:test';

describe('resolveReviewStageForProfile', () => {
  it('errors when review is missing', () => {
    const cfg = safeParseAimoConfig({
      schema_version: 1,
      default_profile: 'default',
      profiles: { default: { plan: { provider: 'fake', model: 'stub' } } },
    });
    expect(cfg.ok).toBe(true);
    if (!cfg.ok) {
      return;
    }

    const r = resolveReviewStageForProfile(cfg.data, 'default');
    expect(r.ok).toBe(false);
  });

  it('returns provider and model', () => {
    const cfg = safeParseAimoConfig({
      schema_version: 1,
      default_profile: 'default',
      profiles: { default: { review: { provider: 'fake', model: 'stub' } } },
    });
    expect(cfg.ok).toBe(true);
    if (!cfg.ok) {
      return;
    }

    const r = resolveReviewStageForProfile(cfg.data, 'default');
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }

    expect(r.review.provider).toBe('fake');
    expect(r.review.model).toBe('stub');
  });
});
