import { PLAN_PATH_STDIN_SENTINEL, safeParseAimoConfig } from '@core/config/AimoConfig.schema';
import { describe, expect, it } from 'bun:test';

describe('safeParseAimoConfig', () => {
  it('accepts minimal empty mapping with defaults', () => {
    const r = safeParseAimoConfig({});
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }

    expect(r.data.schema_version).toBe(1);
    expect(r.data.default_profile).toBe('default');
    expect(r.data.profiles).toEqual({});
  });

  it('accepts delegated execute with optional stdin_file sentinel', () => {
    const r = safeParseAimoConfig({
      profiles: {
        default: {
          execute: {
            type: 'delegated',
            command: ['tool', 'run'],
            stdin_file: PLAN_PATH_STDIN_SENTINEL,
          },
        },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('rejects invalid stdin_file string', () => {
    const r = safeParseAimoConfig({
      profiles: {
        default: {
          execute: {
            type: 'delegated',
            command: ['x'],
            stdin_file: '{plan_inline}',
          },
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects default_profile missing from profiles when profiles non-empty', () => {
    const r = safeParseAimoConfig({
      default_profile: 'missing',
      profiles: { other: { plan: { provider: 'p', model: 'm' } } },
    });
    expect(r.ok).toBe(false);
    if (r.ok) {
      return;
    }

    expect(r.messages.join('\n')).toContain('default_profile');
  });

  it('rejects command as a single string', () => {
    const r = safeParseAimoConfig({
      profiles: {
        default: {
          execute: {
            type: 'delegated',
            command: 'aider',
          },
        },
      },
    });
    expect(r.ok).toBe(false);
  });

  it('rejects shrinker worker not listed in workers', () => {
    const r = safeParseAimoConfig({
      workers: { a: { provider: 'fake', model: 'stub' } },
      pipeline: { shrinkers: [{ source: 'execute.stdout', worker: 'missing' }] },
    });
    expect(r.ok).toBe(false);
  });

  it('accepts workers and pipeline shrinkers', () => {
    const r = safeParseAimoConfig({
      workers: { w: { provider: 'fake', model: 'stub', max_chars_in: 1000, max_chars_out: 500 } },
      pipeline: {
        keep_raw: true,
        shrinkers: [
          { source: 'execute.stdout', worker: 'w' },
          { source: 'execute.git_diff_after', worker: 'w' },
        ],
      },
    });
    expect(r.ok).toBe(true);
  });
});
