/**
 * @file init.command.ts
 * @layer app
 * @description Registers `aimo init` — writes starter user and/or project YAML.
 */

import {
  getGlobalStarterConfigYaml,
  getLocalStarterAimoYaml,
} from '@core/config/AimoInitTemplates.behavior';
import {
  EXIT_CONFIG_ERROR,
  EXIT_OPERATIONAL_ERROR,
  EXIT_SUCCESS,
} from '@core/contracts/ExitCodes.constants';
import type { TInitMode, TInitWriteResult } from '@runtime/bun/ConfigInitWriter.bun';
import { runInitWrites } from '@runtime/bun/ConfigInitWriter.bun';
import type { Command } from 'commander';

/**
 * Serializes init results for `aimo init --json`.
 * @param user - User-global write outcome, if that target ran.
 * @param project - Project-local write outcome, if that target ran.
 * @returns Plain object merged into the top-level `--json` response.
 */
function buildInitJsonPayload(
  user: TInitWriteResult | undefined,
  project: TInitWriteResult | undefined,
): Record<string, unknown> {
  return {
    user: user ?? null,
    project: project ?? null,
  };
}

/**
 * Prints one human-readable line per write result.
 * @param label - Short label ("user" / "project").
 * @param result - Write outcome.
 */
function printHumanLine(label: string, result: TInitWriteResult): void {
  const verb =
    result.status === 'created'
      ? 'created'
      : result.status === 'overwritten'
        ? 'overwritten'
        : 'skipped (already exists; use --force to overwrite)';
  process.stdout.write(`${label}: ${verb}\n`);
  process.stdout.write(`  ${result.path}\n`);
}

/**
 * Registers `init` on the root commander program.
 * @param program - Root `commander` program (`aimo`).
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('write starter ~/.config/.../config.yaml and/or ./aimo.yaml if missing')
    .option('--global-only', 'write only the user-global config file')
    .option('--local-only', 'write only ./aimo.yaml in the current directory')
    .option('--force', 'overwrite existing starter files')
    .option('--json', 'print machine-readable JSON summary on stdout')
    .action(
      async (options: {
        globalOnly?: boolean;
        localOnly?: boolean;
        force?: boolean;
        json?: boolean;
      }) => {
        if (options.globalOnly && options.localOnly) {
          const msg = 'choose at most one of --global-only and --local-only\n';
          if (options.json) {
            process.stdout.write(
              `${JSON.stringify({ ok: false, error: 'mutually_exclusive_flags' })}\n`,
            );
          } else {
            process.stderr.write(msg);
          }
          process.exit(EXIT_CONFIG_ERROR);
          return;
        }

        const mode: TInitMode = options.localOnly
          ? 'local'
          : options.globalOnly
            ? 'global'
            : 'both';
        const globalYaml = getGlobalStarterConfigYaml();
        const localYaml = getLocalStarterAimoYaml();
        const { user, project, errors } = await runInitWrites({
          cwd: process.cwd(),
          globalYaml,
          localYaml,
          mode,
          force: Boolean(options.force),
        });

        if (errors.length > 0) {
          for (const line of errors) {
            process.stderr.write(`${line}\n`);
          }
          if (options.json) {
            process.stdout.write(`${JSON.stringify({ ok: false, errors })}\n`);
          }
          process.exit(EXIT_OPERATIONAL_ERROR);
          return;
        }

        if (options.json) {
          process.stdout.write(
            `${JSON.stringify({ ok: true, ...buildInitJsonPayload(user, project) })}\n`,
          );
          process.exit(EXIT_SUCCESS);
          return;
        }

        if (user) {
          printHumanLine('user config', user);
        }
        if (project) {
          printHumanLine('project config', project);
        }
        process.exit(EXIT_SUCCESS);
      },
    );
}
