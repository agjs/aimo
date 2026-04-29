import { safeParseAimoConfig } from '@core/config/AimoConfig.schema';
import { mergeSessionToolsFromConfig } from '@core/session/mergeSessionToolsFromConfig.behavior';
import { describe, expect, it } from 'bun:test';

describe('mergeSessionToolsFromConfig', () => {
  it('defaults every tool to deny', () => {
    const cfg = safeParseAimoConfig({ schema_version: 1, profiles: {} });
    expect(cfg.ok).toBe(true);
    if (!cfg.ok) {
      return;
    }

    const m = mergeSessionToolsFromConfig(cfg.data);

    expect(m.read_file).toBe('deny');
    expect(m.apply_patch).toBe('deny');
  });

  it('overlays session.tools entries', () => {
    const cfg = safeParseAimoConfig({
      schema_version: 1,
      profiles: {},
      session: {
        tools: {
          read_file: 'allow',
          grep: 'ask',
          run_shell: 'never',
        },
      },
    });
    expect(cfg.ok).toBe(true);
    if (!cfg.ok) {
      return;
    }

    const m = mergeSessionToolsFromConfig(cfg.data);

    expect(m.read_file).toBe('allow');
    expect(m.grep).toBe('ask');
    expect(m.run_shell).toBe('never');
    expect(m.list_tree).toBe('deny');
  });
});
