/**
 * @file session.command.ts
 * @layer app
 * @description Registers `aimo session` and `aimo session resume <id>`.
 */

import { randomUUID } from 'node:crypto';

import type { TAimoConfig } from '@core/config/AimoConfig.schema';
import {
  EXIT_CONFIG_ERROR,
  EXIT_OPERATIONAL_ERROR,
  EXIT_SUCCESS,
} from '@core/contracts/ExitCodes.constants';
import { isSafeRunDirectoryName } from '@core/execute/isSafeRunDirectoryName.behavior';
import { resolvePlanStageForProfile } from '@core/plan/ResolvePlanStage.behavior';
import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';
import type {
  TSessionExecutionLlmSource,
  TSessionExecutionLlmStage,
} from '@core/session/resolveSessionExecutionLlm.behavior';
import { resolveSessionExecutionLlmForProfile } from '@core/session/resolveSessionExecutionLlm.behavior';
import { BunSessionEventLog } from '@runtime/bun/SessionEventLog.bun';
import type { Command } from 'commander';

import {
  selectChatPortForYamlLlmStage,
  selectWorkerChatPortForRun,
} from '../runPipeline/shared/runPipelineChats.app';
import { runAimoSessionReplApp } from '../session/sessionRepl.app';
import { loadResolvedAimoConfig } from '../wireDefaults';

/**
 * Binds a named `workers` entry to a chat port, or exits on misconfiguration.
 * @param cfg - Merged aimo config.
 * @param wname - Optional session YAML key value.
 * @param purpose - Label for error messages.
 * @returns Port and model, or `null` when `wname` is undefined.
 */
function wireSessionWorkerOrExit(
  cfg: TAimoConfig,
  wname: string | undefined,
  purpose: string,
): {
  readonly port: NonNullable<ReturnType<typeof selectWorkerChatPortForRun>>;
  readonly model: string;
  readonly maxCharsIn: number;
} | null {
  if (wname === undefined) {
    return null;
  }

  const w = cfg.workers[wname];

  if (w === undefined) {
    process.stderr.write(`session: worker "${wname}" is not defined in workers\n`);
    process.exit(EXIT_CONFIG_ERROR);
  }

  const port = selectWorkerChatPortForRun(w);

  if (port === null) {
    process.stderr.write(
      `session: ${purpose} worker "${wname}" provider "${w.provider}" is not supported or HTTP credentials are missing\n`,
    );
    process.exit(EXIT_CONFIG_ERROR);
  }

  return { port, model: w.model, maxCharsIn: w.max_chars_in };
}

type TSessionChatsWired = {
  readonly sessionLlm: {
    readonly stage: TSessionExecutionLlmStage;
    readonly source: TSessionExecutionLlmSource;
  };
  readonly executionChat: IChatCompletionPort;
  readonly toolParseChat: IChatCompletionPort | null;
  readonly toolParseModel: string | null;
  readonly toolResultAggregateChat: IChatCompletionPort | null;
  readonly toolResultAggregateModel: string | null;
  readonly toolResultAggregateMinTriggerChars: number;
  readonly toolResultAggregateMaxInputChars: number;
};

/**
 * Resolves the execution LLM, main chat port, and optional session workers, or exits.
 * @param cfg - Merged aimo config.
 * @param profileName - Active profile.
 * @returns Wires for `runAimoSessionReplApp`.
 */
function wireSessionChatsOrExit(cfg: TAimoConfig, profileName: string): TSessionChatsWired {
  const planProbe = resolvePlanStageForProfile(cfg, profileName);

  if (!planProbe.ok) {
    process.stderr.write(`${planProbe.message}\n`);
    process.exit(EXIT_CONFIG_ERROR);
  }

  const sessionLlmR = resolveSessionExecutionLlmForProfile(cfg, profileName);

  if (!sessionLlmR.ok) {
    process.stderr.write(`${sessionLlmR.message}\n`);
    process.exit(EXIT_CONFIG_ERROR);
  }

  const sessionLlm = { stage: sessionLlmR.stage, source: sessionLlmR.source };
  const executionChat = selectChatPortForYamlLlmStage(sessionLlm.stage);

  if (executionChat === null) {
    process.stderr.write(
      `session: provider "${sessionLlm.stage.provider}" is not supported or HTTP credentials are missing (use fake, or openrouter / openai-compat with API keys)\n`,
    );
    process.exit(EXIT_CONFIG_ERROR);
  }

  const toolParseW = wireSessionWorkerOrExit(cfg, cfg.session?.tool_parse_worker, 'tool_parse');
  const toolParseChat = toolParseW !== null ? toolParseW.port : null;
  const toolParseModel = toolParseW !== null ? toolParseW.model : null;

  const aggW = wireSessionWorkerOrExit(
    cfg,
    cfg.session?.tool_result_aggregate_worker,
    'tool_result_aggregate',
  );
  const toolResultAggregateChat = aggW !== null ? aggW.port : null;
  const toolResultAggregateModel = aggW !== null ? aggW.model : null;
  const toolResultAggregateMinTriggerChars =
    aggW !== null ? (cfg.session?.tool_result_aggregate_min_chars ?? 12_000) : 12_000;
  const toolResultAggregateMaxInputChars = aggW !== null ? aggW.maxCharsIn : 200_000;

  return {
    sessionLlm,
    executionChat,
    toolParseChat,
    toolParseModel,
    toolResultAggregateChat,
    toolResultAggregateModel,
    toolResultAggregateMinTriggerChars,
    toolResultAggregateMaxInputChars,
  };
}

async function runSessionWithConfig(
  cwd: string,
  sessionId: string,
  cfg: TAimoConfig,
  profileName: string,
): Promise<void> {
  const w = wireSessionChatsOrExit(cfg, profileName);
  const { sessionLlm, executionChat } = w;

  const prov =
    sessionLlm.source === 'execution_llm'
      ? 'execution_llm'
      : sessionLlm.source === 'delegated_argv'
        ? 'execute --model'
        : 'plan';
  process.stderr.write(`session: model ${sessionLlm.stage.model} (from ${prov})\n`);

  const log = new BunSessionEventLog(cwd, sessionId);

  try {
    await log.acquireLock();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(EXIT_OPERATIONAL_ERROR);
  }

  try {
    await runAimoSessionReplApp({
      cwd,
      sessionId,
      profileName,
      executionModel: sessionLlm.stage.model,
      executionChat,
      toolParseChat: w.toolParseChat,
      toolParseModel: w.toolParseModel,
      toolResultAggregateChat: w.toolResultAggregateChat,
      toolResultAggregateModel: w.toolResultAggregateModel,
      toolResultAggregateMinTriggerChars: w.toolResultAggregateMinTriggerChars,
      toolResultAggregateMaxInputChars: w.toolResultAggregateMaxInputChars,
      log,
      aimoConfig: cfg,
    });
  } finally {
    await log.releaseLock();
  }

  process.exit(EXIT_SUCCESS);
}

/**
 * Registers `session` and `session resume` on the root commander program.
 * @param program - Root `commander` program (`aimo`).
 */
export function registerSessionCommand(program: Command): void {
  const session = program
    .command('session')
    .description('interactive session (append-only event log under .aimo/sessions/)');

  session
    .option('--profile <name>', 'profile name (defaults to config default_profile)')
    .action(async (options: { profile?: string }) => {
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
      const sessionId = randomUUID();
      await runSessionWithConfig(cwd, sessionId, cfg, profileName);
    });

  session
    .command('resume')
    .description('resume an existing session by id (requires exclusive lock)')
    .argument('<id>', 'session id (directory name under .aimo/sessions/)')
    .option('--profile <name>', 'profile name for chat model (defaults to config default_profile)')
    .action(async (sessionId: string, options: { profile?: string }) => {
      const cwd = process.cwd();

      if (!isSafeRunDirectoryName(sessionId)) {
        process.stderr.write('session resume: invalid session id\n');
        process.exit(EXIT_CONFIG_ERROR);
      }

      const loaded = await loadResolvedAimoConfig(cwd);

      if (!loaded.ok) {
        for (const m of loaded.messages) {
          process.stderr.write(`${m}\n`);
        }

        process.exit(EXIT_CONFIG_ERROR);
      }

      const cfg = loaded.config;
      const profileName = options.profile ?? cfg.default_profile;
      await runSessionWithConfig(cwd, sessionId, cfg, profileName);
    });
}
