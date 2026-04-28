/**
 * @file substitutePlanPathInArgv.behavior.ts
 * @layer core
 * @description Replace `{plan_path}` in delegated argv entries with the resolved absolute plan path.
 */

import { PLAN_PATH_TEMPLATE_TOKEN } from '@core/config/AimoConfig.schema';

/**
 * Substitutes every occurrence of `{plan_path}` in each argv element with the given absolute path.
 * @param argv - Delegated command argv (no shell).
 * @param planPathAbsolute - Resolved absolute path to `plan.md` (must already be validated).
 * @returns New argv array (never mutates `argv`).
 */
export function substitutePlanPathInArgv(
  argv: readonly string[],
  planPathAbsolute: string,
): readonly string[] {
  return argv.map((arg) =>
    arg.includes(PLAN_PATH_TEMPLATE_TOKEN)
      ? arg.split(PLAN_PATH_TEMPLATE_TOKEN).join(planPathAbsolute)
      : arg,
  );
}
