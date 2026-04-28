/**
 * @file InProcessFakeChat.provider.ts
 * @layer providers
 * @description Deterministic in-process chat backend for CI and local dry runs (no network).
 */

import type {
  IChatCompletionRequest,
  IChatCompletionResponse,
} from '@core/chat/ChatCompletion.types';
import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';

/**
 * Echoes the latest user message with a `[fake:<model>]` prefix and placeholder usage.
 */
export class InProcessFakeChatProvider implements IChatCompletionPort {
  private seq = 0;

  /**
   * @param request - Chat request (uses the last `user` message when present).
   * @returns OpenAI-shaped response with a single assistant choice.
   */
  complete(request: IChatCompletionRequest): Promise<IChatCompletionResponse> {
    const lastUser = [...request.messages].reverse().find((m) => m.role === 'user');
    const echoed = lastUser?.content ?? '';
    this.seq += 1;
    const id = `fake-${String(this.seq)}`;
    return Promise.resolve({
      id,
      model: request.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: `[fake:${request.model}] ${echoed}`,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 1,
        completion_tokens: 1,
        total_tokens: 2,
      },
    });
  }
}
