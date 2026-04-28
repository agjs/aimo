/**
 * @file doctor.command.ts
 * @layer app
 * @description Registers `aimo doctor` — validates merged YAML and prints paths (bootstrap for full A3).
 */

import { EXIT_CONFIG_ERROR, EXIT_SUCCESS } from '@core/contracts/ExitCodes.constants';
import type { TLoadAimoConfigResult } from '@runtime/bun/ConfigLoader.bun';
import type { Command } from 'commander';

import { loadResolvedAimoConfig } from '../wireDefaults';

/**
 * Builds the `--json` payload (stable enough for subprocess assertions).
 * @param result - Outcome of {@link loadResolvedAimoConfig}.
 * @returns Serializable object written as one JSON line.
 */
function buildDoctorJsonPayload(result: TLoadAimoConfigResult): Record<string, unknown> {
  if (result.ok) {
    const def = result.config.default_profile;
    const plan = result.config.profiles[def]?.plan;
    return {
      ok: true,
      schema_version: result.config.schema_version,
      default_profile: result.config.default_profile,
      profile_names: Object.keys(result.config.profiles).sort(),
      default_profile_plan_provider: plan?.provider ?? null,
      default_profile_plan_model: plan?.model ?? null,
      paths: result.paths,
    };
  }
  return {
    ok: false,
    messages: [...result.messages],
    paths: result.paths,
  };
}

/**
 * Registers `doctor` on the root commander program.
 * @param program - Root `commander` program (`aimo`).
 */
export function registerDoctorCommand(program: Command): void {
  program
    .command('doctor')
    .description('validate merged YAML config and print resolved paths')
    .option('--json', 'print machine-readable JSON to stdout')
    .action(async (options: { json?: boolean }) => {
      const result = await loadResolvedAimoConfig(process.cwd());

      if (options.json) {
        process.stdout.write(`${JSON.stringify(buildDoctorJsonPayload(result))}\n`);
        process.exit(result.ok ? EXIT_SUCCESS : EXIT_CONFIG_ERROR);
      }

      if (!result.ok) {
        process.stderr.write('Configuration invalid.\n');
        for (const line of result.messages) {
          process.stderr.write(`${line}\n`);
        }
        process.stderr.write(`user: ${result.paths.userYamlPath}\n`);
        process.stderr.write(`project: ${result.paths.projectYamlPath}\n`);
        process.exit(EXIT_CONFIG_ERROR);
      }

      process.stdout.write('Configuration valid.\n');
      process.stdout.write(`schema_version: ${String(result.config.schema_version)}\n`);
      process.stdout.write(`default_profile: ${result.config.default_profile}\n`);
      const names = Object.keys(result.config.profiles);
      process.stdout.write(
        names.length > 0 ? `profiles: ${names.sort().join(', ')}\n` : 'profiles: (none)\n',
      );
      process.stdout.write(
        `user config: ${result.paths.userYamlPath} (${result.paths.userYamlPresent ? 'present' : 'absent'})\n`,
      );
      process.stdout.write(
        `project config: ${result.paths.projectYamlPath} (${result.paths.projectYamlPresent ? 'present' : 'absent'})\n`,
      );
      process.exit(EXIT_SUCCESS);
    });
}
