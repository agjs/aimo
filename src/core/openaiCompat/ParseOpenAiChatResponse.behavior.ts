/**
 * @file ParseOpenAiChatResponse.behavior.ts
 * @layer core
 * @description Parse OpenAI-shaped chat completion JSON into our port response type.
 */

import type {
  IChatCompletionChoice,
  IChatCompletionResponse,
  IChatCompletionUsage,
  TChatRole,
} from '@core/chat/ChatCompletion.types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * @param status - HTTP status from the completions endpoint.
 * @param json - Parsed JSON body (or non-object on parse failure — caller may pass adapter fallback).
 * @returns Parsed response or a human-readable error string.
 */
export function parseOpenAiChatCompletionJson(
  status: number,
  json: unknown,
): { ok: true; data: IChatCompletionResponse } | { ok: false; message: string } {
  if (status < 200 || status >= 300) {
    return {
      ok: false,
      message: `chat completion HTTP ${String(status)}: ${summarizeErrorBody(json)}`,
    };
  }

  if (!isRecord(json)) {
    return { ok: false, message: 'chat completion: response JSON is not an object' };
  }

  const id = typeof json.id === 'string' && json.id.length > 0 ? json.id : 'unknown';
  const model = typeof json.model === 'string' && json.model.length > 0 ? json.model : '';
  const choicesRaw = json.choices;

  if (!Array.isArray(choicesRaw) || choicesRaw.length === 0) {
    return { ok: false, message: 'chat completion: missing or empty choices[]' };
  }

  const choices = collectChoicesFromOpenAiArray(choicesRaw);

  if (choices.length === 0) {
    return { ok: false, message: 'chat completion: no valid choices in choices[]' };
  }

  const usage = parseUsage(json.usage);

  return {
    ok: true,
    data: {
      id,
      model,
      choices,
      ...(usage !== undefined ? { usage } : {}),
    },
  };
}

function collectChoicesFromOpenAiArray(choicesRaw: readonly unknown[]): IChatCompletionChoice[] {
  const choices: IChatCompletionChoice[] = [];

  for (let i = 0; i < choicesRaw.length; i++) {
    const element: unknown = choicesRaw[i];
    const parsed = parseOneOpenAiChoice(element, i);

    if (parsed !== null) {
      choices.push(parsed);
    }
  }

  return choices;
}

function parseOneOpenAiChoice(raw: unknown, fallbackIndex: number): IChatCompletionChoice | null {
  if (!isRecord(raw)) {
    return null;
  }

  const index = typeof raw.index === 'number' ? raw.index : fallbackIndex;
  const msg = raw.message;

  if (!isRecord(msg)) {
    return null;
  }

  const role = normalizeChatRole(msg.role);
  const content = typeof msg.content === 'string' ? msg.content : '';
  const finish_reason = typeof raw.finish_reason === 'string' ? raw.finish_reason : 'stop';
  return {
    index,
    message: { role, content },
    finish_reason,
  };
}

function normalizeChatRole(role: unknown): TChatRole {
  if (role === 'assistant' || role === 'user' || role === 'system') {
    return role;
  }

  return 'assistant';
}

function parseUsage(raw: unknown): IChatCompletionUsage | undefined {
  if (!isRecord(raw)) {
    return undefined;
  }

  const prompt = raw.prompt_tokens;
  const completion = raw.completion_tokens;
  const total = raw.total_tokens;

  if (
    typeof prompt !== 'number' ||
    typeof completion !== 'number' ||
    typeof total !== 'number' ||
    !Number.isFinite(prompt) ||
    !Number.isFinite(completion) ||
    !Number.isFinite(total)
  ) {
    return undefined;
  }

  return {
    prompt_tokens: Math.trunc(prompt),
    completion_tokens: Math.trunc(completion),
    total_tokens: Math.trunc(total),
  };
}

function summarizeErrorBody(json: unknown): string {
  if (isRecord(json)) {
    const err = json.error;

    if (isRecord(err) && typeof err.message === 'string') {
      return err.message;
    }
  }

  if (typeof json === 'string') {
    return json.slice(0, 500);
  }

  try {
    return JSON.stringify(json).slice(0, 500);
  } catch {
    return '(unserializable body)';
  }
}
