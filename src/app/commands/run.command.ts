/**
 * @file run.command.ts
 * @layer app
 * @description Registers `aimo run` — plan → delegated execute → review in one invocation.
 */

import type { Command } from 'commander';

import { runAimoRunPipeline } from '../orchestrateRunPipeline.app';

/**
 * Registers `run` on the root commander program.
 * @param program - Root `commander` program (`aimo`).
 */
export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description('run plan → execute → review for one task (single run id under .aimo/runs/)')
    .argument('<task>', 'planner task (quote for long text)')
    .option('--task <text>', 'override positional <task> when needed')
    .option('--profile <name>', 'profile name (defaults to config default_profile)')
    .option('--json', 'print machine-readable summary on stdout')
    .option(
      '--dry-run',
      'validate config and stages without writing artifacts or calling providers',
    )
    .action(
      async (
        taskArg: string,
        options: { task?: string; profile?: string; json?: boolean; dryRun?: boolean },
      ): Promise<void> => {
        const cwd = process.cwd();
        const task = (options.task ?? taskArg).trim();
        const exitCode = await runAimoRunPipeline({
          cwd,
          task,
          ...(options.profile !== undefined ? { profile: options.profile } : {}),
          json: options.json === true,
          dryRun: options.dryRun === true,
        });
        process.exit(exitCode);
      },
    );
}
