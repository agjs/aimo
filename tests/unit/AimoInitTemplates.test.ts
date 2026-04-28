import { safeParseAimoConfig } from '@core/config/AimoConfig.schema';
import {
  getGlobalStarterConfigYaml,
  getLocalStarterAimoYaml,
} from '@core/config/AimoInitTemplates.behavior';
import { describe, expect, it } from 'bun:test';
import { parse as parseYaml } from 'yaml';

describe('Aimo init templates', () => {
  it('parses global starter through the same schema as merged config', () => {
    const raw: unknown = parseYaml(getGlobalStarterConfigYaml());
    const r = safeParseAimoConfig(raw);
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }
    expect(r.data.profiles.default?.plan?.provider).toBe('fake');
    expect(r.data.profiles.default?.execute?.type).toBe('builtin');
  });

  it('parses local starter through the schema', () => {
    const raw: unknown = parseYaml(getLocalStarterAimoYaml());
    const r = safeParseAimoConfig(raw);
    expect(r.ok).toBe(true);
  });
});
