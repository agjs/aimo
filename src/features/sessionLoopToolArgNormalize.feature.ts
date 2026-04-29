/**
 * @file sessionLoopToolArgNormalize.feature.ts
 * @layer features
 * @description Cheap model pass on **tool call arguments** (main model’s JSON) before I/O. Pairs with
 * `sessionLoopToolResultAggregate.feature` (tool *output*) so the expensive execution model can work
 * on smaller, pre-shaped content at each step.
 */

import type { IChatMessage } from '@core/chat/ChatCompletion.types';
import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';
import type { TToolName } from '@core/repoTools/RepoToolNames.constants';

const HINT: Readonly<Record<TToolName, string>> = {
  read_file: 'object: { path: string, max_bytes?: number }',
  grep: 'object: { pattern: string, glob?: string, max_matches?: number, context_lines?: number, ... }',
  list_tree:
    'object: { root?: string, max_depth?: number, max_entries?: number, max_output_bytes?: number }',
  git_status: 'object: { max_output_bytes?: number }',
  git_diff: 'object: { staged?: boolean, max_output_bytes?: number }',
  show_artifact: 'object: { run_id: string, path: string, max_bytes?: number }',
  apply_patch: 'object (not session-dispatchable in v1)',
  run_shell: 'object (deny in v1)',
  web_search: 'object (deny in v1)',
};

/**
 * Tries to extract a single JSON object from assistant text (fences or extra prose allowed).
 * @param text - Raw assistant content.
 * @returns Parsed object, or null.
 */
export function parseJsonObjectFromAssistantText(text: string): Record<string, unknown> | null {
  const trimOuter = (s: string): string => {
    let t = s.trim();

    if (t.startsWith('```')) {
      t = t
        .replace(/^```[a-zA-Z0-9]*\n?/m, '')
        .replace(/```\s*$/m, '')
        .trim();
    }

    return t;
  };

  const tryOne = (s: string): Record<string, unknown> | null => {
    try {
      const v: unknown = JSON.parse(s);

      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        return v as Record<string, unknown>;
      }
    } catch {
      // fall through
    }

    return null;
  };

  const direct = tryOne(trimOuter(text));

  if (direct) {
    return direct;
  }

  const t = text.trim();
  const start = t.indexOf('{');

  if (start < 0) {
    return null;
  }

  for (let end = t.length; end > start; end -= 1) {
    if (t.charAt(end - 1) !== '}') {
      continue;
    }

    const slice = t.slice(start, end);
    const o = tryOne(slice);

    if (o) {
      return o;
    }
  }

  return null;
}

/**
 * One cheap completion to coerce tool args into valid JSON for the given tool.
 * @param toolParseChat - Worker chat port.
 * @param toolParseModel - Worker model id from YAML.
 * @param toolName - Dispatchable repo tool name.
 * @param rawArguments - Raw JSON string from the main model.
 * @param writeStderr - User-facing stderr for parse failures.
 * @returns Normalized object, or null to fall back to direct JSON parse of the main model.
 */
export async function normalizeToolCallArgumentsWithWorker(
  toolParseChat: IChatCompletionPort,
  toolParseModel: string,
  toolName: TToolName,
  rawArguments: string,
  writeStderr: (text: string) => void,
): Promise<Record<string, unknown> | null> {
  const sys = `You are a strict JSON normalizer for repository tool calls. The next user message names a tool and gives raw arguments. Reply with a single JSON object only — no markdown, no commentary. If the input is already valid, echo the same keys/values. Shape hint: ${HINT[toolName]}.`;

  const user = `Tool: ${toolName}\nRaw arguments (may be invalid or wrapped in extra text):\n${rawArguments}`;

  const messages: IChatMessage[] = [
    { role: 'system', content: sys },
    { role: 'user', content: user },
  ];

  try {
    const r = await toolParseChat.complete({ model: toolParseModel, messages });
    const text = r.choices[0]?.message?.content ?? '';
    return parseJsonObjectFromAssistantText(text);
  } catch (e: unknown) {
    const m = e instanceof Error ? e.message : String(e);
    writeStderr(`session: tool-arg normalizer failed (${m}); using direct parse\n`);
    return null;
  }
}
