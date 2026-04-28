/**
 * @file CleanupRegistry.behavior.ts
 * @layer core
 * @description LIFO stack of cleanup callbacks. No I/O here — runtime registers signal handlers that call `drain()`.
 */

/** A synchronous or asynchronous teardown callback. */
export type TCleanupFn = () => void | Promise<void>;

/**
 * Mutable in-memory registry (safe in `core/` — no wall clock or network).
 */
export class CleanupRegistry {
  private readonly stack: TCleanupFn[] = [];

  /**
   * Push a callback to run later (runs in **reverse** order of registration).
   * @param fn - Cleanup to invoke on `drain`.
   */
  public register(fn: TCleanupFn): void {
    this.stack.push(fn);
  }

  /**
   * Invoke all callbacks LIFO, then clear the stack.
   * @returns Promise that settles after all callbacks complete.
   */
  public async drain(): Promise<void> {
    while (this.stack.length > 0) {
      const fn = this.stack.pop();

      if (fn) {
        await fn();
      }
    }
  }
}
