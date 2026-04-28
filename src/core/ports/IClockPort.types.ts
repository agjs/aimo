/**
 * @file IClockPort.types.ts
 * @layer core
 * @description Wall-clock abstraction — `core/` never calls `Date.now` directly.
 */

/**
 * Port for reading monotonic wall time in milliseconds since Unix epoch.
 */
export interface IClockPort {
  /**
   * @returns Milliseconds since Unix epoch (same contract as `Date.now()`).
   */
  nowMs(): number;
}
