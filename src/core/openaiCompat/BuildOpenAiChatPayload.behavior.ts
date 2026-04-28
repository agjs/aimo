/**
 * @file BuildOpenAiChatPayload.behavior.ts
 * @layer core
 * @description Pure OpenAI-compatible `POST /v1/chat/completions` JSON body builder.
 */

import type { IChatCompletionRequest } from '@core/chat/ChatCompletion.types';

/**
 * Serializable body for a non-streaming chat completion request.
 */
export type TOpenAiChatCompletionsBody = {
  readonly model: string;
  readonly messages: ReadonlyArray<{ readonly role: string; readonly content: string }>;
  readonly temperature?: number;
};

/**
 * Builds the JSON body for `POST .../chat/completions`.
 * @param request - Normalized chat request from our ports layer.
 * @returns Plain object suitable for JSON.stringify / HTTP POST.
 */
export function buildOpenAiChatCompletionsBody(
  request: IChatCompletionRequest,
): TOpenAiChatCompletionsBody {
  const messages = request.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  if (request.temperature === undefined) {
    return { model: request.model, messages };
  }

  return { model: request.model, messages, temperature: request.temperature };
}
