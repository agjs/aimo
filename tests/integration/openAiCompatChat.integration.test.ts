/**
 * @file openAiCompatChat.integration.test.ts
 * @description OpenAI-compat chat provider against a fake {@link IHttpPort}.
 */

import type { IHttpPort } from '@core/ports/IHttpPort.types';
import { OpenAiCompatChatProvider } from '@providers/openaiCompat/OpenAiCompatChat.provider';
import { describe, expect, it } from 'bun:test';

describe('OpenAiCompatChatProvider (integration)', () => {
  it('POSTs JSON and maps the first choice', async () => {
    const http: IHttpPort = {
      postJson(url: string, _headers: Readonly<Record<string, string>>, jsonBody: unknown) {
        expect(url).toBe('https://example.test/v1/chat/completions');

        if (typeof jsonBody !== 'object' || jsonBody === null) {
          throw new Error('expected object body');
        }

        const body = jsonBody as Record<string, unknown>;
        expect(body.model).toBe('stub');
        expect(Array.isArray(body.messages)).toBe(true);
        return Promise.resolve({
          status: 200,
          json: {
            id: 'id-1',
            model: 'stub',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'shrunk-summary' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14 },
          },
        });
      },
    };
    const chat = new OpenAiCompatChatProvider({
      http,
      baseUrl: 'https://example.test/v1',
      apiKey: 'sk-test',
    });
    const res = await chat.complete({
      model: 'stub',
      messages: [{ role: 'user', content: 'hello' }],
    });
    const first = res.choices[0];

    if (first === undefined) {
      throw new Error('expected first choice');
    }

    expect(first.message.content).toBe('shrunk-summary');
    expect(res.usage?.total_tokens).toBe(14);
  });
});
