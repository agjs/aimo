/**
 * @file plan.command.ts
 * @layer app
 * @description Registers `aimo plan` — planner chat, `.aimo/runs/<id>/plan.md`, and `manifest.json`.
 */

import { randomUUID } from 'node:crypto';

import { EXIT_CONFIG_ERROR, EXIT_SUCCESS } from '@core/contracts/ExitCodes.constants';
import { CURRENT_SCHEMA_VERSION } from '@core/contracts/SchemaVersion.constants';
import { resolvePlanStageForProfile } from '@core/plan/ResolvePlanStage.behavior';
import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';
import { serializePlanManifestJson } from '@core/runs/RunManifestJson.behavior';
import { runPlanChat } from '@features/planStage.feature';
import { prepareRunArtifactPaths, writePlanArtifacts } from '@runtime/bun/RunWorkspace.bun';
import type { Command } from 'commander';

import {
  createDefaultClockPort,
  createInProcessFakeChatPort,
  loadResolvedAimoConfig,
} from '../wireDefaults';

/**
 * Selects a chat backend for the plan stage (extend when HTTP providers land).
 * @param provider - Value from YAML `profiles.*.plan.provider`.
 * @returns Port instance or `null` when unsupported.
 */
function selectPlanChatPort(provider: string): IChatCompletionPort | null {
  if (provider === 'fake') {
    return createInProcessFakeChatPort();
  }
  return null;
}

/**
 * Registers `plan` on the root commander program.
 * @param program - Root `commander` program (`aimo`).
 */
export function registerPlanCommand(program: Command): void {
  program
    .command('plan')
    .description('run planner stage: write .aimo/runs/<id>/plan.md and manifest.json')
    .argument('<task>', 'planner task (quote for long text)')
    .option('--task <text>', 'override positional <task> when needed')
    .option('--profile <name>', 'profile name (defaults to config default_profile)')
    .option('--json', 'print machine-readable summary on stdout')
    .action(
      async (
        taskArg: string,
        options: { task?: string; profile?: string; json?: boolean },
      ): Promise<void> => {
        const cwd = process.cwd();
        const loaded = await loadResolvedAimoConfig(cwd);
        if (!loaded.ok) {
          for (const m of loaded.messages) {
            process.stderr.write(`${m}\n`);
          }
          process.exit(EXIT_CONFIG_ERROR);
        }
        const cfg = loaded.config;
        const profileName = options.profile ?? cfg.default_profile;
        const resolved = resolvePlanStageForProfile(cfg, profileName);
        if (!resolved.ok) {
          process.stderr.write(`${resolved.message}\n`);
          process.exit(EXIT_CONFIG_ERROR);
        }
        const { provider, model } = resolved.plan;
        const chat = selectPlanChatPort(provider);
        if (!chat) {
          process.stderr.write(
            `plan stage: provider "${provider}" is not supported yet (use provider: fake for now)\n`,
          );
          process.exit(EXIT_CONFIG_ERROR);
        }
        const task = (options.task ?? taskArg).trim();
        if (task.length === 0) {
          process.stderr.write('plan: task text is empty\n');
          process.exit(EXIT_CONFIG_ERROR);
        }
        const runId = randomUUID();
        const paths = await prepareRunArtifactPaths(cwd, runId);
        const { markdown } = await runPlanChat({ task, model, chat });
        const clock = createDefaultClockPort();
        const manifest = {
          schema_version: CURRENT_SCHEMA_VERSION,
          run_id: runId,
          stage: 'plan' as const,
          created_at_ms: clock.nowMs(),
          profile: profileName,
          provider,
          model,
        };
        await writePlanArtifacts(
          { planPath: paths.planPath, manifestPath: paths.manifestPath },
          { manifestJson: serializePlanManifestJson(manifest), planMarkdown: `${markdown}\n` },
        );
        if (options.json) {
          process.stdout.write(
            `${JSON.stringify({
              ok: true,
              run_id: runId,
              plan_path: paths.planPath,
              manifest_path: paths.manifestPath,
              markdown,
            })}\n`,
          );
        } else {
          process.stdout.write(`${markdown}\n`);
        }
        process.exit(EXIT_SUCCESS);
      },
    );
}
