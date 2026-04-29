/**
 * @file RepoToolSchemas.behavior.ts
 * @layer core
 * @description Pure JSON-Schema function descriptors for the repo tools the model may call.
 * One source of truth shared with slash-command dispatch.
 */

import type { IChatTool } from '@core/chat/ChatCompletion.types';

import { type TToolName } from './RepoToolNames.constants';

const READ_FILE: IChatTool = {
  type: 'function',
  function: {
    name: 'read_file',
    description:
      'Read a UTF-8 text file under the repository root. Bounded by max_bytes (default ~64 KB).',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: { type: 'string', description: 'Repo-relative path (no leading slash).' },
        max_bytes: { type: 'integer', minimum: 1, description: 'Optional cap on returned bytes.' },
      },
      required: ['path'],
    },
  },
};

const GREP: IChatTool = {
  type: 'function',
  function: {
    name: 'grep',
    description:
      'Line-oriented JS-regex search under the repository root. Skips dot-dirs, node_modules, .git, .aimo. Bounded outputs.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        pattern: { type: 'string', description: 'JavaScript RegExp source (not wrapped).' },
        glob: { type: 'string', description: 'Optional simple glob filter (e.g. *.ts).' },
        max_matches: { type: 'integer', minimum: 1, description: 'Cap on matches (default 200).' },
        context_lines: {
          type: 'integer',
          minimum: 0,
          description: 'Lines of context before/after each hit.',
        },
      },
      required: ['pattern'],
    },
  },
};

const LIST_TREE: IChatTool = {
  type: 'function',
  function: {
    name: 'list_tree',
    description: 'Depth-bounded file/directory listing under repo root (or an optional subtree).',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        root: { type: 'string', description: 'Optional repo-relative subtree.' },
        max_depth: { type: 'integer', minimum: 1 },
        max_entries: { type: 'integer', minimum: 1 },
      },
    },
  },
};

const GIT_STATUS: IChatTool = {
  type: 'function',
  function: {
    name: 'git_status',
    description: 'Run `git status --short -b` in the repository root and return the output.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {},
    },
  },
};

const GIT_DIFF: IChatTool = {
  type: 'function',
  function: {
    name: 'git_diff',
    description:
      'Run `git diff HEAD` (working tree) or `git diff --cached` (staged) and return the unified diff.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        staged: { type: 'boolean', description: 'When true, show staged diff.' },
      },
    },
  },
};

const SHOW_ARTIFACT: IChatTool = {
  type: 'function',
  function: {
    name: 'show_artifact',
    description:
      'Read a file under .aimo/runs/<run_id>/. Use when the user has bound a run with /use.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        run_id: { type: 'string' },
        path: { type: 'string', description: 'Path relative to the run directory.' },
        max_bytes: { type: 'integer', minimum: 1 },
      },
      required: ['run_id', 'path'],
    },
  },
};

const ALL_DESCRIPTORS: Readonly<Record<TToolName, IChatTool | null>> = {
  read_file: READ_FILE,
  grep: GREP,
  list_tree: LIST_TREE,
  git_status: GIT_STATUS,
  git_diff: GIT_DIFF,
  show_artifact: SHOW_ARTIFACT,
  apply_patch: null,
  run_shell: null,
  web_search: null,
};

/**
 * Returns the IChatTool descriptors for tools whose approval level is reachable
 * (allow / session / ask). `deny` and `never` tools are omitted entirely so the model
 * isn't tempted to call them.
 * @param approvals - Per-tool approval levels from session state.
 * @returns Ordered list (deterministic for repro-friendly tests).
 */
export function buildRepoToolDescriptorsForModel(
  approvals: Readonly<Record<TToolName, 'allow' | 'session' | 'never' | 'deny' | 'ask'>>,
): readonly IChatTool[] {
  const out: IChatTool[] = [];

  for (const name of Object.keys(ALL_DESCRIPTORS) as TToolName[]) {
    const descriptor = ALL_DESCRIPTORS[name];

    if (descriptor === null) {
      continue;
    }

    const level = approvals[name];

    if (level === 'allow' || level === 'session' || level === 'ask') {
      out.push(descriptor);
    }
  }

  return out;
}
