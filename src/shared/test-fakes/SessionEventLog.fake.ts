/**
 * @file SessionEventLog.fake.ts
 * @layer shared
 * @description In-memory {@link ISessionEventLogPort} for integration tests.
 */

import type {
  ISessionEventLogPort,
  ISessionEventReplayResult,
} from '@core/ports/ISessionEventLogPort.types';
import type { TSessionEventEnvelope } from '@core/session/SessionEvents.types';

/**
 * Records appended events; lock methods are no-ops.
 */
export class FakeSessionEventLog implements ISessionEventLogPort {
  private readonly lines: TSessionEventEnvelope[] = [];

  private lastSnapshot = '';

  /** @inheritdoc */
  public appendEvent(event: TSessionEventEnvelope): Promise<void> {
    this.lines.push(event);
    return Promise.resolve();
  }

  /** @inheritdoc */
  public readEventsForReplay(): Promise<ISessionEventReplayResult> {
    return Promise.resolve({ events: [...this.lines], warnings: [] });
  }

  /** @inheritdoc */
  public writeSessionSnapshot(jsonText: string): Promise<void> {
    this.lastSnapshot = jsonText;
    return Promise.resolve();
  }

  /** @inheritdoc */
  public acquireLock(): Promise<void> {
    return Promise.resolve();
  }

  /** @inheritdoc */
  public releaseLock(): Promise<void> {
    return Promise.resolve();
  }

  /**
   * @returns Last snapshot string passed to {@link writeSessionSnapshot}.
   */
  public getLastSnapshot(): string {
    return this.lastSnapshot;
  }
}
