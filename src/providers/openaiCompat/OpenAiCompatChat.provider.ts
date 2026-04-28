/**
 * @file OpenAiCompatChat.provider.ts
 * @layer providers
 * @description OpenAI-compatible chat completions via {@link IHttpPort} (OpenRouter, OpenAI, …).
 */

import type {
  IChatCompletionRequest,
  IChatCompletionResponse,
} from '@core/chat/ChatCompletion.types';
import { buildOpenAiChatCompletionsBody } from '@core/openaiCompat/BuildOpenAiChatPayload.behavior';
import { parseOpenAiChatCompletionJson } from '@core/openaiCompat/ParseOpenAiChatResponse.behavior';
import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';
import type { IHttpPort } from '@core/ports/IHttpPort.types';

/**
 * Dependencies for {@link OpenAiCompatChatProvider}.
 */
export type TOpenAiCompatChatProviderDeps = {
  /** JSON POST client (typically Bun fetch). */
  readonly http: IHttpPort;
  /** API base without trailing slash (e.g. `https://openrouter.ai/api/v1`). */
  readonly baseUrl: string;
  /** Bearer token (never logged by this class). */
  readonly apiKey: string;
};

/**
 * POSTs to `{baseUrl}/chat/completions` with OpenAI-shaped JSON.
 */
export class OpenAiCompatChatProvider implements IChatCompletionPort {
  private readonly http: IHttpPort;
  private readonly completionsUrl: string;
  private readonly apiKey: string;

  /**
   * @param deps - HTTP port, base URL, and API key.
   */
  constructor(deps: TOpenAiCompatChatProviderDeps) {
    this.http = deps.http;
    this.apiKey = deps.apiKey;
    const trimmed = deps.baseUrl.replace(/\/+$/, '');
    this.completionsUrl = `${trimmed}/chat/completions`;
  }

  /**
   * @param request - Chat request for one completion.
   * @returns Parsed assistant message + usage when HTTP body matches the contract.
   */
  async complete(request: IChatCompletionRequest): Promise<IChatCompletionResponse> {
    const body = buildOpenAiChatCompletionsBody(request);
    const { status, json } = await this.http.postJson(
      this.completionsUrl,
      {
        authorization: `Bearer ${this.apiKey}`,
      },
      body,
    );
    const parsed = parseOpenAiChatCompletionJson(status, json);

    if (!parsed.ok) {
      throw new Error(parsed.message);
    }

    return parsed.data;
  }
}
