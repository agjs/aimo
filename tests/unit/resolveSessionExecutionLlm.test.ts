import { safeParseAimoConfig } from '@core/config/AimoConfig.schema';
import { resolveSessionExecutionLlmForProfile } from '@core/session/resolveSessionExecutionLlm.behavior';
import { describe, expect, it } from 'bun:test';

describe('resolveSessionExecutionLlmForProfile', () => {
  it('uses execution_llm when set', () => {
    const c = safeParseAimoConfig({
      profiles: {
        default: {
          plan: { provider: 'openrouter', model: 'plan-m' },
          execution_llm: { provider: 'openrouter', model: 'exec-m' },
        },
      },
    });
    expect(c.ok).toBe(true);
    if (!c.ok) {
      return;
    }

    const r = resolveSessionExecutionLlmForProfile(c.data, 'default');
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }

    expect(r.source).toBe('execution_llm');
    expect(r.stage.model).toBe('exec-m');
  });

  it('uses delegated --model and plan provider', () => {
    const c = safeParseAimoConfig({
      profiles: {
        default: {
          plan: { provider: 'openrouter', model: 'plan-m' },
          execute: {
            type: 'delegated',
            command: ['aider', '--model', 'from-delegated', '-x', 'y'],
          },
        },
      },
    });
    expect(c.ok).toBe(true);
    if (!c.ok) {
      return;
    }

    const r = resolveSessionExecutionLlmForProfile(c.data, 'default');
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }

    expect(r.source).toBe('delegated_argv');
    expect(r.stage.model).toBe('from-delegated');
    expect(r.stage.provider).toBe('openrouter');
  });

  it('falls back to plan when no execution_llm and no --model in delegated', () => {
    const c = safeParseAimoConfig({
      profiles: {
        default: {
          plan: { provider: 'fake', model: 'pm' },
          execute: { type: 'delegated', command: ['aider'] },
        },
      },
    });
    expect(c.ok).toBe(true);
    if (!c.ok) {
      return;
    }

    const r = resolveSessionExecutionLlmForProfile(c.data, 'default');
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }

    expect(r.source).toBe('plan');
    expect(r.stage.model).toBe('pm');
  });
});
