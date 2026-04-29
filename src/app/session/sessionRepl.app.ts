/**
 * @file sessionRepl.app.ts
 * @layer app
 * @description Readline REPL wiring for `aimo session` (stderr styling, SIGINT → turn abort).
 */

import { writeSync } from 'node:fs';
import readline from 'node:readline';

import type { TAimoConfig } from '@core/config/AimoConfig.schema';
import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';
import type { ISessionEventLogPort } from '@core/ports/ISessionEventLogPort.types';
import { mergeSessionToolsFromConfig } from '@core/session/mergeSessionToolsFromConfig.behavior';
import { runSessionLoop, SessionTurnAbort } from '@features/sessionLoop.feature';
import { BunClockPort } from '@runtime/bun/ClockPort.bun';
import { BunRepoTools } from '@runtime/bun/RepoTools.bun';
import { writeRunProgressWarnLine } from '@runtime/bun/RunProgressStderrStyle.bun';
import { BunSessionEventLog } from '@runtime/bun/SessionEventLog.bun';
import { PACKAGE_VERSION } from '@shared/constants/Version.constants';

/**
 * Runs the interactive session REPL until `/exit` or EOF.
 * @param params - Working directory, ids, chat wiring, and event log port.
 * @param params.cwd - Repository root for run binding checks.
 * @param params.sessionId - Session directory id under `.aimo/sessions/`.
 * @param params.profileName - Active profile name (for metadata).
 * @param params.executionModel - Session chat model (execution LLM, not plan).
 * @param params.executionChat - Port for `executionModel`.
 * @param params.toolParseChat - Optional cheap worker port for tool-arg JSON normalization.
 * @param params.toolParseModel - Model id for `toolParseChat` (when set).
 * @param params.toolResultAggregateChat - Optional cheap worker to compress large tool *outputs* for the main model.
 * @param params.toolResultAggregateModel - Model id for the aggregate worker (when set).
 * @param params.toolResultAggregateMinTriggerChars - Min tool output size to run aggregation.
 * @param params.toolResultAggregateMaxInputChars - Max characters sent to the aggregate worker.
 * @param params.log - Append-only session event log port.
 * @param params.aimoConfig - Merged YAML (for `session.tools` and future session wiring).
 */
export async function runAimoSessionReplApp(params: {
  readonly cwd: string;
  readonly sessionId: string;
  readonly profileName: string;
  readonly executionModel: string;
  readonly executionChat: IChatCompletionPort;
  readonly toolParseChat: IChatCompletionPort | null;
  readonly toolParseModel: string | null;
  readonly toolResultAggregateChat: IChatCompletionPort | null;
  readonly toolResultAggregateModel: string | null;
  readonly toolResultAggregateMinTriggerChars: number;
  readonly toolResultAggregateMaxInputChars: number;
  readonly log: ISessionEventLogPort;
  readonly aimoConfig: TAimoConfig;
}): Promise<void> {
  const {
    cwd,
    sessionId,
    profileName,
    executionModel,
    executionChat,
    toolParseChat,
    toolParseModel,
    toolResultAggregateChat,
    toolResultAggregateModel,
    toolResultAggregateMinTriggerChars,
    toolResultAggregateMaxInputChars,
    log,
    aimoConfig,
  } = params;
  const clock = new BunClockPort();
  const turnAbort = new SessionTurnAbort();
  const mergedSessionTools = mergeSessionToolsFromConfig(aimoConfig);
  const repoTools = new BunRepoTools();

  const onSigInt = (): void => {
    turnAbort.abort();
  };

  process.on('SIGINT', onSigInt);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: process.stdin.isTTY === true,
  });

  const lineQueue: string[] = [];
  const waiters: ((line: string | null) => void)[] = [];
  let stdinClosed = false;

  rl.on('line', (line: string) => {
    const next = waiters.shift();

    if (next) {
      next(line);
      return;
    }

    lineQueue.push(line);
  });

  rl.on('close', () => {
    stdinClosed = true;

    while (waiters.length > 0) {
      const w = waiters.shift();

      if (w) {
        w(null);
      }
    }
  });

  const readLine = (): Promise<string | null> => {
    process.stdout.write('aimo> ');

    if (lineQueue.length > 0) {
      const line = lineQueue.shift() ?? null;
      return Promise.resolve(line);
    }

    if (stdinClosed) {
      return Promise.resolve(null);
    }

    return new Promise<string | null>((resolve) => {
      waiters.push(resolve);
    });
  };

  try {
    await runSessionLoop(
      {
        cwd,
        sessionId,
        profileName,
        cliVersion: PACKAGE_VERSION,
        executionModel,
        executionChat,
        toolParseChat,
        toolParseModel,
        toolResultAggregateChat,
        toolResultAggregateModel,
        toolResultAggregateMinTriggerChars,
        toolResultAggregateMaxInputChars,
        log,
        clock,
        mergedSessionTools,
        repoTools,
        writeStderr: (text: string) => {
          writeSync(2, text);
        },
        readLine,
        existsRunDir: (runId) => BunSessionEventLog.runDirExists(cwd, runId),
      },
      turnAbort,
    );
  } finally {
    process.off('SIGINT', onSigInt);
    rl.close();
  }

  writeRunProgressWarnLine(`session ${sessionId} ended`);
}
