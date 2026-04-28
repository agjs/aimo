/**
 * @file resolveRunIdForPipelineSlice.app.ts
 * @layer app
 * @description Choose or validate `.aimo/runs/<id>/` id for `aimo run` stage slices.
 */

import { randomUUID } from 'node:crypto';

import { EXIT_CONFIG_ERROR, EXIT_OPERATIONAL_ERROR } from '@core/contracts/ExitCodes.constants';
import { isSafeRunDirectoryName } from '@core/execute/isSafeRunDirectoryName.behavior';

/**
 * Resolves the run directory id for a pipeline slice.
 * @param startsAtPlan - True when the slice begins at the plan stage.
 * @param explicitRunId - Optional `--run` from the CLI (may be empty string).
 * @returns Exit code on failure, or the resolved id.
 */
export function resolveRunIdForPipelineSlice(
  startsAtPlan: boolean,
  explicitRunId: string | undefined,
): { ok: true; readonly runId: string } | { ok: false; readonly exitCode: number } {
  if (startsAtPlan) {
    const explicit = explicitRunId?.trim();

    if (explicit !== undefined && explicit.length > 0) {
      if (!isSafeRunDirectoryName(explicit)) {
        process.stderr.write('run: invalid --run id (use a UUID with no path separators)\n');
        return { ok: false, exitCode: EXIT_OPERATIONAL_ERROR };
      }

      return { ok: true, runId: explicit };
    }

    const runId = randomUUID();

    if (!isSafeRunDirectoryName(runId)) {
      process.stderr.write('run: internal error — generated run id was rejected\n');
      return { ok: false, exitCode: EXIT_OPERATIONAL_ERROR };
    }

    return { ok: true, runId };
  }

  const rid = explicitRunId?.trim() ?? '';

  if (!isSafeRunDirectoryName(rid)) {
    process.stderr.write(
      'run: --run <id> is required when --from is execute or review (use the run id under .aimo/runs/)\n',
    );
    return { ok: false, exitCode: EXIT_CONFIG_ERROR };
  }

  return { ok: true, runId: rid };
}
