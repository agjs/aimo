/**
 * @file IChatCompletionPort.types.ts
 * @layer core
 * @description Port for a single non-streaming chat completion (real HTTP adapters implement via {@link IHttpPort}).
 */

import type {
  IChatCompletionRequest,
  IChatCompletionResponse,
} from '@core/chat/ChatCompletion.types';

/**
 * Pluggable chat completion backend (in-process fake, OpenAI-compatible HTTP, Anthropic, …).
 */
export interface IChatCompletionPort {
  /**
   * Runs one completion request (no streaming in v1).
   * @param request - Model id and message list.
   * @returns Assistant message plus metadata.
   */
  complete(request: IChatCompletionRequest): Promise<IChatCompletionResponse>;
}
