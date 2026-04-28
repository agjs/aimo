import { parseOpenAiChatCompletionJson } from '@core/openaiCompat/ParseOpenAiChatResponse.behavior';
import { describe, expect, it } from 'bun:test';

const happyJson = {
  id: 'chat-1',
  model: 'echo',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'ok' },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
};

describe('parseOpenAiChatCompletionJson', () => {
  it('parses 200 + OpenAI-shaped body', () => {
    const r = parseOpenAiChatCompletionJson(200, happyJson);
    expect(r.ok).toBe(true);
    if (!r.ok) {
      return;
    }

    expect(r.data.id).toBe('chat-1');
    const first = r.data.choices[0];

    if (first === undefined) {
      throw new Error('expected first choice');
    }

    expect(first.message.content).toBe('ok');
    expect(r.data.usage?.total_tokens).toBe(5);
  });

  it('errors on non-2xx', () => {
    const r = parseOpenAiChatCompletionJson(401, { error: { message: 'bad' } });
    expect(r.ok).toBe(false);
    if (r.ok) {
      return;
    }

    expect(r.message).toContain('401');
    expect(r.message).toContain('bad');
  });

  it('errors when choices empty', () => {
    const r = parseOpenAiChatCompletionJson(200, { id: 'x', model: 'm', choices: [] });
    expect(r.ok).toBe(false);
  });
});
