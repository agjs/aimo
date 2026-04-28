import { buildOpenAiChatCompletionsBody } from '@core/openaiCompat/BuildOpenAiChatPayload.behavior';
import { describe, expect, it } from 'bun:test';

describe('buildOpenAiChatCompletionsBody', () => {
  it('maps messages and omits temperature when unset', () => {
    const body = buildOpenAiChatCompletionsBody({
      model: 'm',
      messages: [
        { role: 'system', content: 's' },
        { role: 'user', content: 'u' },
      ],
    });
    expect(body).toEqual({
      model: 'm',
      messages: [
        { role: 'system', content: 's' },
        { role: 'user', content: 'u' },
      ],
    });
  });

  it('includes temperature when provided', () => {
    const body = buildOpenAiChatCompletionsBody({
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      temperature: 0.2,
    });
    expect(body.temperature).toBe(0.2);
  });
});
