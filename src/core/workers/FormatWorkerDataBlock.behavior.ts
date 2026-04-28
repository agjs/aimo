/**
 * @file FormatWorkerDataBlock.behavior.ts
 * @layer core
 * @description Delimit untrusted executor / tool text for cheap-model prompts (DATA block).
 */

/**
 * Wraps raw text so worker prompts treat it as **untrusted** pipeline output.
 * @param input - Block fields.
 * @param input.source - Context source id (e.g. `execute.stdout`).
 * @param input.body - UTF-8 body (already capped by caller).
 * @returns Single user-message friendly block (no outer markdown fence required).
 */
export function formatWorkerDataBlock(input: {
  readonly source: string;
  readonly body: string;
}): string {
  return `<<<DATA untrusted source="${input.source}" >>>\n${input.body}\n<<<END DATA>>>`;
}
