/**
 * @file runPipelineWritePlanStep.app.ts
 * @layer app
 * @description Persist planner output (`plan.md` + `manifest.json`) for `aimo run`.
 */

import { CURRENT_SCHEMA_VERSION } from '@core/contracts/SchemaVersion.constants';
import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';
import { serializePlanManifestJson } from '@core/runs/RunManifestJson.behavior';
import { runPlanChat } from '@features/planStage.feature';
import { writePlanArtifacts } from '@runtime/bun/RunWorkspace.bun';

import { createDefaultClockPort } from '../wireDefaults';

/**
 * Runs planner chat and writes plan artifacts.
 * @param input - Paths, ids, and resolved plan routing.
 * @param input.planPath - Absolute `plan.md` path.
 * @param input.manifestPath - Absolute `manifest.json` path.
 * @param input.runId - Run directory id.
 * @param input.task - Planner task text.
 * @param input.profileName - Active profile key.
 * @param input.planProvider - YAML plan provider id.
 * @param input.planModel - YAML plan model id.
 * @param input.planChat - Chat port for the plan stage.
 * @returns Assistant markdown before the trailing newline is appended for the file body.
 */
export async function writeRunPipelinePlanStep(input: {
  readonly planPath: string;
  readonly manifestPath: string;
  readonly runId: string;
  readonly task: string;
  readonly profileName: string;
  readonly planProvider: string;
  readonly planModel: string;
  readonly planChat: IChatCompletionPort;
}): Promise<{ readonly markdown: string }> {
  const { markdown } = await runPlanChat({
    task: input.task,
    model: input.planModel,
    chat: input.planChat,
  });
  const clock = createDefaultClockPort();
  const manifest = {
    schema_version: CURRENT_SCHEMA_VERSION,
    run_id: input.runId,
    stage: 'plan' as const,
    created_at_ms: clock.nowMs(),
    profile: input.profileName,
    provider: input.planProvider,
    model: input.planModel,
  };
  await writePlanArtifacts(
    { planPath: input.planPath, manifestPath: input.manifestPath },
    { manifestJson: serializePlanManifestJson(manifest), planMarkdown: `${markdown}\n` },
  );
  return { markdown };
}
