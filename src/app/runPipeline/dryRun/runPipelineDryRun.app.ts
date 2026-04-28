/**
 * @file runPipelineDryRun.app.ts
 * @layer app
 * @description Config-only validation for `aimo run --dry-run`.
 */

import { EXIT_CONFIG_ERROR, EXIT_SUCCESS } from '@core/contracts/ExitCodes.constants';
import { writeRunStyledMessage } from '@runtime/bun/RunProgressStderrStyle.bun';

import { loadResolvedAimoConfig } from '../../wireDefaults';
import type { TRunPipelineOptions } from '../runPipelineTypes.app';
import {
  resolvePipelineSliceForRun,
  validateBindingsForSlice,
  validateRunIdRequiredUnlessPlanStart,
  validateTaskRequiredForPlan,
} from './dryRunValidateBindings.app';
import { formatStageSliceForHumans } from '../shared/formatStageSliceForHumans.app';

/**
 * Validates merged config for the stages that would run (dry run).
 * @param options - CLI-mapped options including `fromStage` / `toStage`.
 * @returns Exit code (`EXIT_SUCCESS` or `EXIT_CONFIG_ERROR`).
 */
export async function runDryRunPipeline(options: TRunPipelineOptions): Promise<number> {
  const sliceRes = resolvePipelineSliceForRun(options.fromStage, options.toStage);

  if (!sliceRes.ok) {
    writeRunStyledMessage(`${sliceRes.message}\n`, 'warn');
    return EXIT_CONFIG_ERROR;
  }

  const { slice } = sliceRes;

  const taskCheck = validateTaskRequiredForPlan(slice.needPlan, options.task);

  if (!taskCheck.ok) {
    writeRunStyledMessage(taskCheck.message, 'warn');
    return EXIT_CONFIG_ERROR;
  }

  const runIdCheck = validateRunIdRequiredUnlessPlanStart(slice.startsAtPlan, options.runId);

  if (!runIdCheck.ok) {
    writeRunStyledMessage(runIdCheck.message, 'warn');
    return EXIT_CONFIG_ERROR;
  }

  const loaded = await loadResolvedAimoConfig(options.cwd);

  if (!loaded.ok) {
    for (const m of loaded.messages) {
      writeRunStyledMessage(`${m}\n`, 'warn');
    }

    return EXIT_CONFIG_ERROR;
  }

  const cfg = loaded.config;
  const profileName = options.profile ?? cfg.default_profile;

  const bindings = validateBindingsForSlice(cfg, profileName, slice);

  if (!bindings.ok) {
    writeRunStyledMessage(bindings.message, 'warn');
    return EXIT_CONFIG_ERROR;
  }

  const task = options.task.trim();
  const stageLabels = slice.stages.map((name) => ({ name }));

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify({
        dry_run: true,
        ok: true,
        profile: profileName,
        from: options.fromStage,
        to: options.toStage,
        ...(slice.needPlan ? { task } : {}),
        stages: stageLabels,
      })}\n`,
    );
  } else {
    process.stderr.write(
      `Dry run OK — would run ${formatStageSliceForHumans(slice.stages)} for profile "${profileName}"${
        slice.needPlan ? ` (task length ${task.length} chars)` : ''
      }.\n`,
    );
  }

  return EXIT_SUCCESS;
}
