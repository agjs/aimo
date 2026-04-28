/**
 * @file run.command.ts
 * @layer app
 * @description Registers `aimo run` — plan → execute → review with optional `--from` / `--to` slices.
 */

import { EXIT_CONFIG_ERROR } from '@core/contracts/ExitCodes.constants';
import { parsePipelineStageName } from '@core/run/resolvePipelineStageRange.behavior';
import type { Command } from 'commander';

import { runAimoRunPipeline } from '../orchestrateRunPipeline.app';

/**
 * Registers `run` on the root commander program.
 * @param program - Root `commander` program (`aimo`).
 */
export function registerRunCommand(program: Command): void {
  program
    .command('run')
    .description(
      'run plan → execute → review (or a slice via --from / --to) for one task or existing --run id',
    )
    .argument('[task]', 'planner task (required when the slice includes plan)')
    .option('--task <text>', 'override positional [task] when needed')
    .option('--profile <name>', 'profile name (defaults to config default_profile)')
    .option(
      '--from <stage>',
      'first stage to run: plan | execute | review',
      (v: string) => v,
      'plan',
    )
    .option(
      '--to <stage>',
      'last stage to run (inclusive): plan | execute | review',
      (v: string) => v,
      'review',
    )
    .option(
      '--run <id>',
      'run id under .aimo/runs/ (optional when starting at plan to pick id; required when --from is execute or review)',
    )
    .option('--json', 'print machine-readable summary on stdout')
    .option(
      '--dry-run',
      'validate config and stages without writing artifacts or calling providers',
    )
    .action(
      async (
        taskArg: string | undefined,
        options: {
          task?: string;
          profile?: string;
          from?: string;
          to?: string;
          run?: string;
          json?: boolean;
          dryRun?: boolean;
        },
      ): Promise<void> => {
        const cwd = process.cwd();
        const fromParsed = parsePipelineStageName(options.from ?? 'plan');

        if (!fromParsed.ok) {
          process.stderr.write(`${fromParsed.message}\n`);
          process.exit(EXIT_CONFIG_ERROR);
        }

        const toParsed = parsePipelineStageName(options.to ?? 'review');

        if (!toParsed.ok) {
          process.stderr.write(`${toParsed.message}\n`);
          process.exit(EXIT_CONFIG_ERROR);
        }

        const task = (options.task ?? taskArg ?? '').trim();
        const exitCode = await runAimoRunPipeline({
          cwd,
          task,
          fromStage: fromParsed.stage,
          toStage: toParsed.stage,
          ...(options.profile !== undefined ? { profile: options.profile } : {}),
          ...(options.run !== undefined ? { runId: options.run } : {}),
          json: options.json === true,
          dryRun: options.dryRun === true,
        });
        process.exit(exitCode);
      },
    );
}
