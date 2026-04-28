/**
 * @file AimoConfig.schema.ts
 * @layer core
 * @description Zod schema and safe-parse helper for `aimo` YAML configuration (no file I/O).
 */

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
  execute: executeStageSchema.optional(),
  review: llmStageSchema.optional(),
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
  })
  .superRefine((data, ctx) => {
    const names = Object.keys(data.profiles);

    if (names.length > 0 && !Object.hasOwn(data.profiles, data.default_profile)) {
      ctx.addIssue({
        code: 'custom',
        message: `default_profile "${data.default_profile}" is not defined in profiles (${names.join(', ')})`,
        path: ['default_profile'],
      });
    }
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
