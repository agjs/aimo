/**
 * @file SerializeWorkersSidecar.behavior.ts
 * @layer core
 * @description Pure JSON serializer for `.aimo/runs/<id>/workers.json` (schema v1).
 */

/**
 * One shrinker HTTP/fake completion row.
 */
export type TWorkersSidecarCallV1 = {
  readonly source: string;
  readonly worker: string;
  readonly provider: string;
  readonly model: string;
  readonly chars_in: number;
  readonly chars_out: number;
  readonly prompt_tokens?: number;
  readonly completion_tokens?: number;
  readonly total_tokens?: number;
  readonly truncated_in: boolean;
};

/**
 * On-disk shape for `workers.json`.
 */
export type TWorkersSidecarV1 = {
  readonly schema_version: 1;
  readonly run_id: string;
  readonly calls: readonly TWorkersSidecarCallV1[];
};

/**
 * Pretty-prints workers sidecar JSON with trailing newline.
 * @param payload - Sidecar object.
 * @returns UTF-8 text for `writeFile`.
 */
export function serializeWorkersSidecarJson(payload: TWorkersSidecarV1): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}
