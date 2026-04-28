/**
 * @file IClockPort.types.ts
 * @layer core
 * @description Wall-clock abstraction — `core/` never reads wall time from globals; use this port.
 */

/**
 * Port for reading monotonic wall time in milliseconds since Unix epoch.
 */
export interface IClockPort {
  /**
   * @returns Milliseconds since Unix epoch (ECMAScript time value in milliseconds).
   */
  nowMs(): number;
}
