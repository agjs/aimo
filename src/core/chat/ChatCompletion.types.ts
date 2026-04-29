/**
 * @file ChatCompletion.types.ts
 * @layer core
 * @description OpenAI-style chat completion shapes shared by providers and the fake adapter.
 */

/** Role string for a single chat turn (`'tool'` carries a tool result; see {@link IChatMessage}). */
export type TChatRole = 'system' | 'user' | 'assistant' | 'tool';

/** OpenAI-shape function-call descriptor a model may emit on an assistant message. */
export interface IChatToolCall {
  /** Provider-issued call id; round-tripped on the matching `role: 'tool'` message. */
  readonly id: string;
  /** Always `'function'` in v1. */
  readonly type: 'function';
  readonly function: {
    /** Tool name (must match an entry in {@link IChatCompletionRequest.tools}). */
    readonly name: string;
    /** Raw JSON string of the function arguments (provider serializes; we parse). */
    readonly arguments: string;
  };
}

/**
 * One message in a chat completion request or response choice.
 * `role: 'tool'` carries a tool result and **must** include `tool_call_id`.
 * Assistant messages may include `tool_calls` (the model is requesting tool runs);
 * on `role: 'tool'`, `tool_call_id` matches the `id` of the originating call and `name` is optional.
 */
export interface IChatMessage {
  readonly role: TChatRole;
  readonly content: string;
  readonly tool_calls?: readonly IChatToolCall[] | undefined;
  readonly tool_call_id?: string | undefined;
  readonly name?: string | undefined;
}

/** OpenAI-shape function tool descriptor passed in `tools` on a request. */
export interface IChatTool {
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly description: string;
    /** JSON Schema for arguments (object shape). */
    readonly parameters: Readonly<Record<string, unknown>>;
  };
}

/**
 * Non-streaming chat completion request (subset of OpenAI-compatible APIs):
 * `model` id, prior `messages`, optional `temperature`, and optional `tools` / `tool_choice` for function calling.
 */
export interface IChatCompletionRequest {
  readonly model: string;
  readonly messages: readonly IChatMessage[];
  readonly temperature?: number;
  readonly tools?: readonly IChatTool[];
  readonly tool_choice?:
    | 'auto'
    | 'none'
    | { readonly type: 'function'; readonly function: { readonly name: string } };
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
 * message - Assistant message content (may include `tool_calls`).
 * finish_reason - Provider stop reason string (e.g. `'stop'`, `'tool_calls'`).
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
