/**
 * @file ExecuteResultJson.behavior.ts
 * @layer core
 * @description Serialize execute-stage summary JSON for `execute.result.json`.
 */

import type { TSchemaVersion } from '@core/contracts/SchemaVersion.constants';

/**
 * Minimal execute summary persisted next to git diff snapshots (`git_diff_head_error` when not a repo).
 */
export interface IExecuteResultRecord {
  readonly schema_version: TSchemaVersion;
  readonly run_id: string;
  readonly stage: 'execute';
  readonly exit_code: number;
  readonly git_diff_head_error: string | null;
}

/**
 * Pretty-prints execute result metadata.
 * @param record - Structured fields.
 * @returns UTF-8 JSON with trailing newline.
 */
export function serializeExecuteResultJson(record: IExecuteResultRecord): string {
  return `${JSON.stringify(record, null, 2)}\n`;
}
