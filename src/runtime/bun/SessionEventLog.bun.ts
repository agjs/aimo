/**
 * @file SessionEventLog.bun.ts
 * @layer runtime
 * @description Append-only `events.jsonl`, `session.json` snapshot, blob spill, and advisory lock.
 */

import { createHash } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { mkdir, appendFile, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  ISessionEventLogPort,
  ISessionEventReplayResult,
} from '@core/ports/ISessionEventLogPort.types';
import { relativeRunDirectoryPath } from '@core/runs/AimoRunPaths.constants';
import {
  relativeSessionDirectoryPath,
  relativeSessionEventsJsonlPath,
  relativeSessionJsonPath,
  relativeSessionLockPath,
} from '@core/runs/AimoSessionPaths.constants';
import type { TSessionEventEnvelope } from '@core/session/SessionEvents.types';

import { SessionAdvisoryLock } from './SessionAdvisoryLock.bun';

/** Max JSONL line size before spill (spec §5.3). */
export const SESSION_EVENT_MAX_LINE_BYTES = 256 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseEnvelope(raw: unknown): TSessionEventEnvelope | null {
  if (!isRecord(raw)) {
    return null;
  }

  if (raw.schema_version !== 1 || typeof raw.seq !== 'number' || typeof raw.at !== 'string') {
    return null;
  }

  if (typeof raw.kind !== 'string' || !isRecord(raw.payload)) {
    return null;
  }

  return raw as unknown as TSessionEventEnvelope;
}

/**
 * Bun-backed session event log under `.aimo/sessions/<sessionId>/`.
 */
export class BunSessionEventLog implements ISessionEventLogPort {
  /** Session directory name under `.aimo/sessions/`. */
  public readonly sessionId: string;

  private readonly sessionDirAbs: string;

  private readonly eventsPathAbs: string;

  private readonly snapshotPathAbs: string;

  private readonly lockPathAbs: string;

  private readonly lock = new SessionAdvisoryLock();

  /**
   * @param repoRootAbs - Absolute repository root (cwd).
   * @param sessionId - Session id directory name.
   */
  public constructor(repoRootAbs: string, sessionId: string) {
    this.sessionId = sessionId;
    const rel = relativeSessionDirectoryPath(sessionId);
    this.sessionDirAbs = join(repoRootAbs, rel);
    this.eventsPathAbs = join(repoRootAbs, relativeSessionEventsJsonlPath(sessionId));
    this.snapshotPathAbs = join(repoRootAbs, relativeSessionJsonPath(sessionId));
    this.lockPathAbs = join(repoRootAbs, relativeSessionLockPath(sessionId));
  }

  /**
   * Ensures the session directory tree exists.
   */
  public async ensureLayout(): Promise<void> {
    await mkdir(this.sessionDirAbs, { recursive: true });
    await mkdir(join(this.sessionDirAbs, 'blobs'), { recursive: true });
  }

  /** @inheritdoc */
  public async acquireLock(): Promise<void> {
    await this.ensureLayout();
    this.lock.tryAcquire(this.lockPathAbs);
  }

  /** @inheritdoc */
  public releaseLock(): Promise<void> {
    this.lock.release();
    return Promise.resolve();
  }

  /** @inheritdoc */
  public async appendEvent(event: TSessionEventEnvelope): Promise<void> {
    await this.ensureLayout();
    const primary = `${JSON.stringify(event)}\n`;
    const byteLen = Buffer.byteLength(primary, 'utf8');

    if (byteLen <= SESSION_EVENT_MAX_LINE_BYTES) {
      await appendFile(this.eventsPathAbs, primary, 'utf8');
      return;
    }

    const bodyBuf = Buffer.from(primary, 'utf8');
    const hash = createHash('sha256').update(bodyBuf).digest('hex');
    const relRef = `blobs/${hash}.json`;
    const blobAbs = join(this.sessionDirAbs, relRef);
    await mkdir(join(this.sessionDirAbs, 'blobs'), { recursive: true });
    await writeFile(blobAbs, bodyBuf);

    const spill: TSessionEventEnvelope = {
      schema_version: 1,
      seq: event.seq,
      at: event.at,
      kind: 'event_body_spill',
      payload: {
        body_ref: relRef,
        body_bytes: bodyBuf.length,
      },
    };

    const spillLine = `${JSON.stringify(spill)}\n`;

    if (Buffer.byteLength(spillLine, 'utf8') > SESSION_EVENT_MAX_LINE_BYTES) {
      throw new Error('session: spill envelope still exceeds max line size');
    }

    await appendFile(this.eventsPathAbs, spillLine, 'utf8');
  }

  /** @inheritdoc */
  public async readEventsForReplay(): Promise<ISessionEventReplayResult> {
    const warnings: string[] = [];
    let lines: string[];

    try {
      const rawText = await readFile(this.eventsPathAbs, 'utf8');
      lines = rawText.split('\n').filter((l) => l.trim().length > 0);
    } catch (error: unknown) {
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';

      if (code === 'ENOENT') {
        return { events: [], warnings: [] };
      }

      throw error;
    }

    const events: TSessionEventEnvelope[] = [];
    let expectedSeq = 1;

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? '';
      let parsed: unknown;

      try {
        parsed = JSON.parse(line) as unknown;
      } catch {
        if (i === lines.length - 1) {
          warnings.push('session: dropped torn final JSONL line');
          break;
        }

        throw new Error(`session: invalid JSON on line ${String(i + 1)}`);
      }

      let envelope = parseEnvelope(parsed);

      if (envelope === null) {
        throw new Error(`session: unrecognized event envelope at line ${String(i + 1)}`);
      }

      if (envelope.kind === 'event_body_spill') {
        const blobAbs = join(this.sessionDirAbs, envelope.payload.body_ref);
        const innerText = await readFile(blobAbs, 'utf8');
        const innerParsed = JSON.parse(innerText) as unknown;
        envelope = parseEnvelope(innerParsed);

        if (envelope === null) {
          throw new Error('session: spilled blob did not contain a valid event');
        }
      }

      if (envelope.seq !== expectedSeq) {
        throw new Error(
          `session: events.jsonl seq gap or reorder: expected ${String(expectedSeq)}, got ${String(envelope.seq)}`,
        );
      }

      expectedSeq += 1;
      events.push(envelope);
    }

    return { events, warnings };
  }

  /** @inheritdoc */
  public async writeSessionSnapshot(jsonText: string): Promise<void> {
    await this.ensureLayout();
    await writeFile(this.snapshotPathAbs, jsonText, 'utf8');
  }

  /**
   * @returns Absolute session directory.
   */
  public getSessionDirAbs(): string {
    return this.sessionDirAbs;
  }

  /**
   * @param repoRootAbs - Absolute repository root.
   * @param runId - Run directory name under `.aimo/runs/`.
   * @returns `true` when `.aimo/runs/<runId>/` exists under the repo root.
   */
  public static async runDirExists(repoRootAbs: string, runId: string): Promise<boolean> {
    const p = join(repoRootAbs, relativeRunDirectoryPath(runId));

    try {
      await access(p, fsConstants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}
