/**
 * @file ChatCompletion.types.ts
 * @layer core
 * @description OpenAI-style chat completion shapes shared by providers and the fake adapter.
 */

/** Role string for a single chat turn. */
export type TChatRole = 'system' | 'user' | 'assistant';

/**
 * One message in a chat completion request or response choice.
 * role - Speaker role.
 * content - UTF-8 message body (non-streaming v1).
 */
export interface IChatMessage {
  readonly role: TChatRole;
  readonly content: string;
}

/**
 * Non-streaming chat completion request (subset of OpenAI-compatible APIs).
 * model - Logical model id from config (e.g. `stub`, `gpt-4o`).
 * messages - Prior turns plus the latest user message.
 * temperature - Optional sampling temperature when the backend supports it.
 */
export interface IChatCompletionRequest {
  readonly model: string;
  readonly messages: readonly IChatMessage[];
  readonly temperature?: number;
}

/**
 * Non-streaming chat completion response (minimal fields for plan/review stages).
 * id - Provider-issued id (fake uses deterministic `fake-<n>`).
 * model - Echo of the requested model where applicable.
 * choices - Always at least one choice in v1 fake + happy-path HTTP adapters.
 * usage - Token counts when available (fake fills small placeholders).
 */
export interface IChatCompletionResponse {
  readonly id: string;
  readonly model: string;
  readonly choices: readonly IChatCompletionChoice[];
  readonly usage?: IChatCompletionUsage;
}

/**
 * One completion alternative.
 * index - Choice index (OpenAI-compatible; usually `0`).
 * message - Assistant message content.
 * finish_reason - Provider stop reason string.
 */
export interface IChatCompletionChoice {
  readonly index: number;
  readonly message: IChatMessage;
  readonly finish_reason: string;
}

/**
 * Token accounting (optional on some backends).
 * prompt_tokens - Tokens charged for the prompt.
 * completion_tokens - Tokens charged for the completion.
 * total_tokens - Sum when known.
 */
export interface IChatCompletionUsage {
  readonly prompt_tokens: number;
  readonly completion_tokens: number;
  readonly total_tokens: number;
}
