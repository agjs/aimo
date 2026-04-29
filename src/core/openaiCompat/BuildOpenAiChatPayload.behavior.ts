/**
 * @file BuildOpenAiChatPayload.behavior.ts
 * @layer core
 * @description Pure OpenAI-compatible `POST /v1/chat/completions` JSON body builder.
 */

import type {
  IChatCompletionRequest,
  IChatTool,
  IChatToolCall,
} from '@core/chat/ChatCompletion.types';

/** Serializable message variant (matches OpenAI's wire shape). */
export interface TOpenAiChatMessageWire {
  readonly role: string;
  readonly content: string;
  readonly tool_calls?: readonly IChatToolCall[];
  readonly tool_call_id?: string;
  readonly name?: string;
}

/** Serializable body for a non-streaming chat completion request. */
export type TOpenAiChatCompletionsBody = {
  readonly model: string;
  readonly messages: readonly TOpenAiChatMessageWire[];
  readonly temperature?: number;
  readonly tools?: readonly IChatTool[];
  readonly tool_choice?: IChatCompletionRequest['tool_choice'];
};

/**
 * Builds the JSON body for `POST .../chat/completions`.
 * Includes `tool_calls` / `tool_call_id` / `name` on messages and `tools` + `tool_choice`
 * at the top level when present (Phase 6 model tool-calling).
 * @param request - Normalized chat request from our ports layer.
 * @returns Plain object suitable for JSON.stringify / HTTP POST.
 */
export function buildOpenAiChatCompletionsBody(
  request: IChatCompletionRequest,
): TOpenAiChatCompletionsBody {
  const messages: TOpenAiChatMessageWire[] = request.messages.map((m) => {
    const wire: {
      role: string;
      content: string;
      tool_calls?: readonly IChatToolCall[];
      tool_call_id?: string;
      name?: string;
    } = { role: m.role, content: m.content };

    if (m.tool_calls !== undefined && m.tool_calls.length > 0) {
      wire.tool_calls = m.tool_calls;
    }

    if (m.tool_call_id !== undefined) {
      wire.tool_call_id = m.tool_call_id;
    }

    if (m.name !== undefined) {
      wire.name = m.name;
    }

    return wire;
  });

  const out: {
    model: string;
    messages: readonly TOpenAiChatMessageWire[];
    temperature?: number;
    tools?: readonly IChatTool[];
    tool_choice?: IChatCompletionRequest['tool_choice'];
  } = { model: request.model, messages };

  if (request.temperature !== undefined) {
    out.temperature = request.temperature;
  }

  if (request.tools !== undefined && request.tools.length > 0) {
    out.tools = request.tools;
  }

  if (request.tool_choice !== undefined) {
    out.tool_choice = request.tool_choice;
  }

  return out;
}
