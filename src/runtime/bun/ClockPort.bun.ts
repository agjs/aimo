/**
 * @file ClockPort.bun.ts
 * @layer runtime
 * @description Bun-backed {@link IClockPort} using the system wall clock.
 */

import type { IClockPort } from '@core/ports/IClockPort.types';

/**
 * Real wall-clock implementation suitable for production wiring from `app/wireDefaults.ts`.
 */
export class BunClockPort implements IClockPort {
  /**
   * @returns Current epoch milliseconds from the host system.
   */
  public nowMs(): number {
    return Date.now();
  }
}
