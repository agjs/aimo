/**
 * @file AimoConfig.schema.ts
 * @layer core
 * @description Zod schema and safe-parse helper for `aimo` YAML configuration (no file I/O).
 */

import { CONTEXT_SOURCE_VALUES } from '@core/contextSources/ContextSource.constants';
import { REPO_TOOL_NAMES } from '@core/repoTools/RepoToolNames.constants';
import { z } from 'zod';

/**
 * Literal `{plan_path}` token: replaced in delegated `command[]` argv entries, and optional `stdin_file`
 * value (plan bytes piped to stdin — never embedded in argv).
 */
export const PLAN_PATH_TEMPLATE_TOKEN = '{plan_path}' as const;

/** Same as {@link PLAN_PATH_TEMPLATE_TOKEN} (stdin_file literal in YAML). */
export const PLAN_PATH_STDIN_SENTINEL = PLAN_PATH_TEMPLATE_TOKEN;

const llmStageSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  base_url: z.string().url().optional(),
});

const delegatedExecuteSchema = z.object({
  type: z.literal('delegated'),
  command: z.array(z.string().min(1)).min(1),
  stdin_file: z.literal(PLAN_PATH_TEMPLATE_TOKEN).optional(),
});

const builtinExecuteSchema = z.object({
  type: z.literal('builtin'),
});

const executeStageSchema = z.discriminatedUnion('type', [
  delegatedExecuteSchema,
  builtinExecuteSchema,
]);

const profileSchema = z.object({
  plan: llmStageSchema.optional(),
  execution_llm: llmStageSchema.optional(),
  execute: executeStageSchema.optional(),
  review: llmStageSchema.optional(),
});

/** Cheap-model profile for `pipeline.shrinkers` (OpenAI-compatible HTTP or `fake`). */
export const workerProfileSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  base_url: z.string().url().optional(),
  max_chars_in: z.number().int().positive().max(2_000_000).default(200_000),
  max_chars_out: z.number().int().positive().max(500_000).default(8_000),
});

/** One named worker entry under top-level `workers:`. */
export type TWorkerProfile = z.infer<typeof workerProfileSchema>;

const pipelineSchema = z.object({
  keep_raw: z.boolean().default(true),
  shrinkers: z
    .array(
      z.object({
        source: z.enum(CONTEXT_SOURCE_VALUES),
        worker: z.string().min(1),
      }),
    )
    .default([]),
});

const sessionToolYamlLevelSchema = z.enum(['allow', 'deny', 'ask', 'never', 'session']);

const sessionConfigSchema = z.object({
  tools: z.record(z.string(), sessionToolYamlLevelSchema).optional(),
  tool_parse_worker: z.string().min(1).optional(),
  tool_result_aggregate_worker: z.string().min(1).optional(),
  /** Triggers a cheap “compress for the main model” pass on tool *output* when this length is met. */
  tool_result_aggregate_min_chars: z.number().int().positive().max(2_000_000).optional(),
});

/**
 * Root schema for merged user + project YAML.
 * @see {@link mergeConfigRecordLayers} for precedence.
 */
export const aimoConfigSchema = z
  .object({
    schema_version: z.literal(1).default(1),
    default_profile: z.string().min(1).default('default'),
    profiles: z.record(z.string(), profileSchema).default({}),
    workers: z.record(z.string(), workerProfileSchema).default({}),
    pipeline: pipelineSchema.default({ keep_raw: true, shrinkers: [] }),
    session: sessionConfigSchema.optional(),
  })
  .superRefine((data, ctx) => {
    const assertSessionWorkers = (): void => {
      const s = data.session;

      for (const key of ['tool_parse_worker', 'tool_result_aggregate_worker'] as const) {
        const wn = s?.[key];

        if (wn === undefined) {
          continue;
        }

        if (!Object.hasOwn(data.workers, wn)) {
          ctx.addIssue({
            code: 'custom',
            message: `session.${key} "${wn}" is not defined in workers`,
            path: ['session', key],
          });
        }
      }
    };

    const names = Object.keys(data.profiles);

    if (names.length > 0 && !Object.hasOwn(data.profiles, data.default_profile)) {
      ctx.addIssue({
        code: 'custom',
        message: `default_profile "${data.default_profile}" is not defined in profiles (${names.join(', ')})`,
        path: ['default_profile'],
      });
    }

    for (let i = 0; i < data.pipeline.shrinkers.length; i++) {
      const entry = data.pipeline.shrinkers[i];
      const wname = entry?.worker;

      if (wname === undefined) {
        continue;
      }

      if (!Object.hasOwn(data.workers, wname)) {
        ctx.addIssue({
          code: 'custom',
          message: `pipeline.shrinkers[${String(i)}].worker "${wname}" is not defined in workers`,
          path: ['pipeline', 'shrinkers', i, 'worker'],
        });
      }
    }

    const tools = data.session?.tools;

    if (tools !== undefined) {
      for (const key of Object.keys(tools)) {
        if (!(REPO_TOOL_NAMES as readonly string[]).includes(key)) {
          ctx.addIssue({
            code: 'custom',
            message: `session.tools: unknown tool "${key}" (expected one of: ${REPO_TOOL_NAMES.join(', ')})`,
            path: ['session', 'tools', key],
          });
        }
      }
    }

    assertSessionWorkers();
  });

/** Parsed and validated `aimo` configuration. */
export type TAimoConfig = z.infer<typeof aimoConfigSchema>;

/**
 * Validates merged YAML/JSON-like input.
 * @param raw - Typically output of {@link mergeConfigRecordLayers} after per-file YAML parse.
 * @returns Success with {@link TAimoConfig} or failure with human-readable issues.
 */
export function safeParseAimoConfig(
  raw: unknown,
): { ok: true; data: TAimoConfig } | { ok: false; messages: readonly string[] } {
  const result = aimoConfigSchema.safeParse(raw);

  if (result.success) {
    return { ok: true, data: result.data };
  }

  const messages = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return `${path}${issue.message}`;
  });

  return { ok: false, messages };
}
