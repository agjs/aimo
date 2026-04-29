/**
 * @file SessionAdvisoryLock.bun.ts
 * @layer runtime
 * @description Non-blocking advisory `flock` on the session `.lock` file (Unix).
 */

import { closeSync, openSync, constants } from 'node:fs';

import { dlopen, FFIType } from 'bun:ffi';

const LOCK_EX = 2;
const LOCK_NB = 4;
const LOCK_UN = 8;

type TFlock = (fd: number, op: number) => number;

function tryDlopenFlock(): TFlock | null {
  if (process.platform === 'win32') {
    return null;
  }

  const candidates =
    process.platform === 'darwin'
      ? ['/usr/lib/libSystem.B.dylib', '/usr/lib/libSystem.dylib']
      : ['libc.so.6'];

  for (const libPath of candidates) {
    try {
      const { symbols } = dlopen(libPath, {
        flock: {
          args: [FFIType.i32, FFIType.i32],
          returns: FFIType.i32,
        },
      });
      return symbols.flock;
    } catch {
      continue;
    }
  }

  return null;
}

const flockFn = tryDlopenFlock();

/**
 * Holds an exclusive non-blocking flock on a lock file until {@link release} is called.
 */
export class SessionAdvisoryLock {
  private fd: number | null = null;

  /**
   * Opens `lockPath` and applies `LOCK_EX | LOCK_NB`.
   * @param lockPath - Absolute path to `.lock`.
   * @throws {Error} When the platform is unsupported or the lock cannot be acquired.
   */
  public tryAcquire(lockPath: string): void {
    if (flockFn === null) {
      throw new Error(
        'aimo session: advisory lock is not supported on this platform (Windows); use Unix or WSL for `session resume`.',
      );
    }

    const fd = openSync(lockPath, constants.O_RDWR | constants.O_CREAT, 0o644);
    const rc = flockFn(fd, LOCK_EX | LOCK_NB);

    if (rc !== 0) {
      closeSync(fd);
      throw new Error(
        'aimo session: another process holds this session lock (`.lock`). Close the other `aimo session resume` or remove a stale lock only if no process is using this session.',
      );
    }

    this.fd = fd;
  }

  /**
   * Unlocks and closes the lock fd if {@link tryAcquire} succeeded.
   */
  public release(): void {
    if (this.fd === null || flockFn === null) {
      return;
    }

    void flockFn(this.fd, LOCK_UN);
    closeSync(this.fd);
    this.fd = null;
  }
}
