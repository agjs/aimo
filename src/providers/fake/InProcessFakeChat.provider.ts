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
 * When `tools` is non-empty and the latest user text starts with `tool:`, returns one synthetic
 * `tool_calls` entry (for integration tests). After a `role: 'tool'` message is in the thread,
 * echoes again without tool_calls (end of tool loop).
 */
export class InProcessFakeChatProvider implements IChatCompletionPort {
  private seq = 0;

  /**
   * @param request - Chat request (uses the last `user` message when present).
   * @returns OpenAI-shaped response with a single assistant choice.
   */
  complete(request: IChatCompletionRequest): Promise<IChatCompletionResponse> {
    this.seq += 1;
    const id = `fake-${String(this.seq)}`;
    const hasToolResult = request.messages.some((m) => m.role === 'tool');
    const lastUser = [...request.messages].reverse().find((m) => m.role === 'user');
    const tools = request.tools;

    if (
      tools &&
      tools.length > 0 &&
      !hasToolResult &&
      lastUser?.content?.trimStart().startsWith('tool:')
    ) {
      const first = tools[0];

      if (first === undefined) {
        return this.echoResponse(id, request.model, lastUser);
      }

      const a =
        first.function.name === 'read_file'
          ? JSON.stringify({ path: 'note.txt' })
          : first.function.name === 'grep'
            ? JSON.stringify({ pattern: 'x' })
            : '{}';
      return Promise.resolve({
        id,
        model: request.model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'fake-call-1',
                  type: 'function' as const,
                  function: { name: first.function.name, arguments: a },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      });
    }

    return this.echoResponse(id, request.model, lastUser);
  }

  private echoResponse(
    id: string,
    model: string,
    lastUser: { content: string } | undefined,
  ): Promise<IChatCompletionResponse> {
    const echoed = lastUser?.content ?? '';
    return Promise.resolve({
      id,
      model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content: `[fake:${model}] ${echoed}` },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });
  }
}
