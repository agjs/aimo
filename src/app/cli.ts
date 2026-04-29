#!/usr/bin/env bun
/**
 * @file cli.ts
 * @layer app
 * @description CLI entrypoint for `aimo` / `ai-model-orchestrator` (commander).
 */
import { EXIT_OPERATIONAL_ERROR } from '@core/contracts/ExitCodes.constants';
import { getPipelinePlaceholderExitCode } from '@features/runPipeline.feature';
import { PACKAGE_VERSION } from '@shared/constants/Version.constants';
import { Command } from 'commander';

import { registerDoctorCommand } from './commands/doctor.command';
import { registerExecuteCommand } from './commands/execute.command';
import { registerInitCommand } from './commands/init.command';
import { registerPingCommand } from './commands/ping.command';
import { registerPlanCommand } from './commands/plan.command';
import { registerReviewCommand } from './commands/review.command';
import { registerRunCommand } from './commands/run.command';
import { registerSessionCommand } from './commands/session.command';
import {
  assertAimoConfigWiring,
  assertExecuteStageWired,
  assertPlanStageWired,
  assertProviderPortsWired,
  assertReviewStageWired,
  assertRunPipelineWired,
  assertSessionLoopWired,
  createCleanupRegistry,
  createDefaultClockPort,
  getCurrentSchemaVersion,
} from './wireDefaults';

/**
 * Ensures app → runtime and app → features → core graph stays linked (no tree-shake orphans).
 */
function assertCompositionWired(): void {
  void getCurrentSchemaVersion();
  void createCleanupRegistry();
  void createDefaultClockPort().nowMs();
  void getPipelinePlaceholderExitCode();
  assertAimoConfigWiring();
  assertExecuteStageWired();
  assertPlanStageWired();
  assertProviderPortsWired();
  assertReviewStageWired();
  assertRunPipelineWired();
  assertSessionLoopWired();
}

/**
 * Parses argv and runs the root command (placeholder until Milestone A commands land).
 * @param argv - Raw argument list (defaults to `process.argv`).
 * @returns Promise that resolves when the process should exit with code 0.
 */
export async function main(argv: readonly string[] = process.argv): Promise<void> {
  assertCompositionWired();
  const program = new Command();
  program
    .name('aimo')
    .description('AI model orchestrator — plan, execute, review with per-stage routing.')
    .version(PACKAGE_VERSION, '-V, --version', 'output the version string');

  program
    .command('help')
    .description('show this help or subcommand help')
    .action(() => {
      program.outputHelp();
    });

  registerInitCommand(program);
  registerDoctorCommand(program);
  registerPingCommand(program);
  registerPlanCommand(program);
  registerExecuteCommand(program);
  registerReviewCommand(program);
  registerRunCommand(program);
  registerSessionCommand(program);

  const [, , ...rest] = argv;

  if (rest.length === 0) {
    program.outputHelp();
    return;
  }

  await program.parseAsync(argv);
}

if (import.meta.main) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(EXIT_OPERATIONAL_ERROR);
  });
}
