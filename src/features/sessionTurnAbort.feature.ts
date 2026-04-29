/**
 * @file sessionTurnAbort.feature.ts
 * @layer features
 * @description Per-REPL-turn abort for SIGINT, `/cancel`, and in-flight chat.
 */

/**
 * Per-turn abort for SIGINT, `/cancel`, and in-flight chat.
 */
export class SessionTurnAbort {
  private controller = new AbortController();

  /**
   * Replaces the controller and returns the new turn's signal.
   * @returns Fresh {@link AbortSignal} for the current REPL turn.
   */
  public reset(): AbortSignal {
    this.controller = new AbortController();
    return this.controller.signal;
  }

  /**
   * Aborts the current turn (if any).
   */
  public abort(): void {
    this.controller.abort();
  }
}
