/**
 * @file FakeClockPort.fake.ts
 * @layer shared
 * @description Deterministic {@link IClockPort} for unit and integration tests.
 */

import type { IClockPort } from '@core/ports/IClockPort.types';

/**
 * Mutable fake clock — defaults to `0` until advanced via `setNowMs`.
 */
export class FakeClockPort implements IClockPort {
  private now = 0;

  /**
   * @returns Controlled epoch milliseconds.
   */
  public nowMs(): number {
    return this.now;
  }

  /**
   * @param ms - Epoch milliseconds to report on subsequent `nowMs` calls.
   */
  public setNowMs(ms: number): void {
    this.now = ms;
  }
}
