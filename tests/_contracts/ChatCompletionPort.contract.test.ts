/**
 * @file ChatCompletionPort.contract.test.ts
 * @description Shared response shape for {@link IChatCompletionPort} implementations used in CI.
 */

import type { IChatCompletionRequest } from '@core/chat/ChatCompletion.types';
import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';
import type { IHttpPort } from '@core/ports/IHttpPort.types';
import { InProcessFakeChatProvider } from '@providers/fake/InProcessFakeChat.provider';
import { OpenAiCompatChatProvider } from '@providers/openaiCompat/OpenAiCompatChat.provider';
import { describe, expect, it } from 'bun:test';

const sampleRequest: IChatCompletionRequest = {
  model: 'contract-model',
  messages: [
    { role: 'system', content: 'sys' },
    { role: 'user', content: 'user-turn' },
  ],
};

async function assertChatContract(port: IChatCompletionPort): Promise<void> {
  const res = await port.complete(sampleRequest);
  expect(typeof res.id).toBe('string');
  expect(res.id.length).toBeGreaterThan(0);
  expect(res.model).toBe('contract-model');
  expect(res.choices.length).toBeGreaterThan(0);
  const first = res.choices[0];

  if (first === undefined) {
    throw new Error('expected first choice');
  }

  expect(first.message.role).toBe('assistant');
  expect(typeof first.message.content).toBe('string');
  expect(typeof first.finish_reason).toBe('string');
  expect(res.usage).toBeDefined();
  if (res.usage === undefined) {
    return;
  }

  expect(res.usage.prompt_tokens).toBeGreaterThanOrEqual(0);
  expect(res.usage.completion_tokens).toBeGreaterThanOrEqual(0);
  expect(res.usage.total_tokens).toBeGreaterThanOrEqual(0);
}

describe('IChatCompletionPort contract', () => {
  it('InProcessFakeChatProvider conforms', async () => {
    await assertChatContract(new InProcessFakeChatProvider());
  });

  it('OpenAiCompatChatProvider conforms with fake HTTP', async () => {
    const http: IHttpPort = {
      postJson() {
        return Promise.resolve({
          status: 200,
          json: {
            id: 'http-1',
            model: 'contract-model',
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: 'x' },
                finish_reason: 'stop',
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          },
        });
      },
    };
    await assertChatContract(
      new OpenAiCompatChatProvider({ http, baseUrl: 'https://x.test/v1', apiKey: 'k' }),
    );
  });
});
