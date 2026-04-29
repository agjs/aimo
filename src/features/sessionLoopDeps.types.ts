/**
 * @file sessionLoopDeps.types.ts
 * @layer features
 * @description Dependency bundle for {@link runSessionLoop} (kept separate to avoid circular imports).
 */

import type { IChatCompletionPort } from '@core/ports/IChatCompletionPort.types';
import type { IClockPort } from '@core/ports/IClockPort.types';
import type { IRepoToolsPort } from '@core/ports/IRepoToolsPort.types';
import type { ISessionEventLogPort } from '@core/ports/ISessionEventLogPort.types';
import type { TToolName } from '@core/repoTools/RepoToolNames.constants';
import type { TToolApprovalLevel } from '@core/session/SessionState.types';

/** Dependencies for `runSessionLoop` in `sessionLoop.feature.ts`. */
export interface ISessionLoopDeps {
  readonly cwd: string;
  readonly sessionId: string;
  readonly profileName: string;
  readonly cliVersion: string;
  /**
   * Model id for `aimo session` free-text and tool-calling (resolved from `execution_llm`, else `--model` on
   * delegated execute, else plan).
   */
  readonly executionModel: string;
  /** Chat port for `executionModel`. */
  readonly executionChat: IChatCompletionPort;
  /** When set, every repo `tool_call` args string is normalized through this cheap worker before I/O. */
  readonly toolParseChat: IChatCompletionPort | null;
  readonly toolParseModel: string | null;
  /**
   * When set, successful tool *outputs* at or above `toolResultAggregateMinTriggerChars` are run
   * through this cheap worker so the execution model sees an aggregate, not raw bytes.
   */
  readonly toolResultAggregateChat: IChatCompletionPort | null;
  readonly toolResultAggregateModel: string | null;
  readonly toolResultAggregateMinTriggerChars: number;
  /** From the worker’s `max_chars_in` when the aggregate worker is configured. */
  readonly toolResultAggregateMaxInputChars: number;
  readonly log: ISessionEventLogPort;
  readonly clock: IClockPort;
  /** Effective levels from merged YAML (`session.tools`) plus replayed `approval` events. */
  readonly mergedSessionTools: Readonly<Record<TToolName, TToolApprovalLevel>>;
  readonly repoTools: IRepoToolsPort;
  /** Human-oriented status (stderr). */
  readonly writeStderr: (text: string) => void;
  /** Returns one user line or `null` on EOF. */
  readonly readLine: () => Promise<string | null>;
  /** Whether `.aimo/runs/<id>/` exists. */
  readonly existsRunDir: (runId: string) => Promise<boolean>;
}
