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

  if (typeof json !== 'object' || json === null) {
    return { ok: false, message: 'chat completion: response JSON is not an object' };
  }

  const obj = json as Record<string, unknown>;
  const id = typeof obj.id === 'string' && obj.id.length > 0 ? obj.id : 'unknown';
  const model = typeof obj.model === 'string' && obj.model.length > 0 ? obj.model : '';
  const choicesRaw = obj.choices;

  if (!Array.isArray(choicesRaw) || choicesRaw.length === 0) {
    return { ok: false, message: 'chat completion: missing or empty choices[]' };
  }

  const choices = collectChoicesFromOpenAiArray(choicesRaw);

  if (choices.length === 0) {
    return { ok: false, message: 'chat completion: no valid choices in choices[]' };
  }

  const usage = parseUsage(obj.usage);

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
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const choice = raw as Record<string, unknown>;
  const index = typeof choice.index === 'number' ? choice.index : fallbackIndex;
  const msg = choice.message;

  if (typeof msg !== 'object' || msg === null) {
    return null;
  }

  const m = msg as Record<string, unknown>;
  const role = normalizeChatRole(m.role);
  const content = typeof m.content === 'string' ? m.content : '';
  const finish_reason = typeof choice.finish_reason === 'string' ? choice.finish_reason : 'stop';
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
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }

  const u = raw as Record<string, unknown>;
  const prompt = u.prompt_tokens;
  const completion = u.completion_tokens;
  const total = u.total_tokens;

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
  if (typeof json === 'object' && json !== null) {
    const err = (json as Record<string, unknown>).error;

    if (typeof err === 'object' && err !== null) {
      const msg = (err as Record<string, unknown>).message;

      if (typeof msg === 'string') {
        return msg;
      }
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
