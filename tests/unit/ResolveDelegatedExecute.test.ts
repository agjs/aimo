/**
 * @file ResolveDelegatedExecute.test.ts
 */

import { PLAN_PATH_STDIN_SENTINEL, safeParseAimoConfig } from '@core/config/AimoConfig.schema';
import { resolveDelegatedExecuteForProfile } from '@core/execute/ResolveDelegatedExecute.behavior';
import { describe, expect, it } from 'bun:test';

describe('resolveDelegatedExecuteForProfile', () => {
  it('errors when execute is missing', () => {
    const cfg = safeParseAimoConfig({
      schema_version: 1,
      default_profile: 'default',
      profiles: { default: { plan: { provider: 'fake', model: 'stub' } } },
    });
    expect(cfg.ok).toBe(true);
    if (!cfg.ok) {
      return;
    }
    const r = resolveDelegatedExecuteForProfile(cfg.data, 'default');
    expect(r.ok).toBe(false);
  });

  it('errors when execute is builtin', () => {
    const cfg = safeParseAimoConfig({
      schema_version: 1,
      default_profile: 'default',
      profiles: { default: { execute: { type: 'builtin' } } },
    });
    expect(cfg.ok).toBe(true);
    if (!cfg.ok) {
      return;
    }
    const r = resolveDelegatedExecuteForProfile(cfg.data, 'default');
    expect(r.ok).toBe(false);
    if (r.ok) {
      return;
    }
    expect(r.message).toContain('delegated');
  });

  it('returns command and stdin flag for delegated', () => {
    const cfg = safeParseAimoConfig({
      schema_version: 1,
      default_profile: 'default',
      profiles: {
        default: {
          execute: {
            type: 'delegated',
            command: ['wc', '-c'],
            stdin_file: PLAN_PATH_STDIN_SENTINEL,
          },
        },
      },
    });
    expect(cfg.ok).toBe(true);
    if (!cfg.ok) {
      return;
    }
    const r = resolveDelegatedExecuteForProfile(cfg.data, 'default');
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.execute.command).toEqual(['wc', '-c']);
    expect(r.execute.pipePlanToStdin).toBe(true);
  });
});
