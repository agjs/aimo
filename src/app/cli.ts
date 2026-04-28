#!/usr/bin/env bun
/**
 * @file cli.ts
 * @layer app
 * @description CLI entrypoint for `aimo` / `ai-model-orchestrator` (commander).
 */
import { getPipelinePlaceholderExitCode } from '@features/runPipeline.feature';
import { PACKAGE_VERSION } from '@shared/constants/Version.constants';
import { Command } from 'commander';

import {
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

  const [, , ...rest] = argv;
  if (rest.length === 0) {
    program.outputHelp();
    return;
  }

  await program.parseAsync(argv);
}

if (import.meta.main) {
  await main();
}
