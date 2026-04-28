/**
 * @file WorkersSidecarJson.bun.ts
 * @layer runtime
 * @description Write `.aimo/runs/<id>/workers.json` (UTF-8).
 */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { WORKERS_JSON_BASENAME } from '@core/runs/AimoRunPaths.constants';

/**
 * Persists the workers ledger JSON under a run directory.
 * @param runDir - Absolute `.aimo/runs/<id>/`.
 * @param jsonUtf8 - Pretty JSON (include trailing newline from serializer).
 */
export async function writeWorkersSidecarJson(runDir: string, jsonUtf8: string): Promise<void> {
  await writeFile(join(runDir, WORKERS_JSON_BASENAME), jsonUtf8, 'utf8');
}
