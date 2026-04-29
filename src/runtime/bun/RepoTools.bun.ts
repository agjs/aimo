/**
 * @file RepoTools.bun.ts
 * @layer runtime
 * @description Bun-backed {@link IRepoToolsPort}: bounded reads with repo-root containment.
 */

import { open, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';

import type {
  IGrepParams,
  IGrepResult,
  IGitDiffParams,
  IGitDiffResult,
  IGitStatusParams,
  IGitStatusResult,
  IListTreeParams,
  IListTreeResult,
  IReadFileParams,
  IReadFileResult,
  IRepoToolsPort,
  IShowArtifactParams,
} from '@core/ports/IRepoToolsPort.types';
import { isPathInsideRoot } from '@core/runs/isPathInsideRoot.behavior';

import { runRepoGitDiff } from './runRepoGitDiff.bun';
import { runRepoGitStatus } from './runRepoGitStatus.bun';
import { runRepoGrep } from './runRepoGrep.bun';
import { runRepoListTree } from './runRepoListTree.bun';
import { runRepoShowArtifact } from './runRepoShowArtifact.bun';

const DEFAULT_READ_MAX_BYTES = 65_536;

/**
 * Reads repo files for `aimo session` `/read` and related tooling.
 */
export class BunRepoTools implements IRepoToolsPort {
  /**
   * @inheritdoc
   */
  public async readFile(repoRoot: string, params: IReadFileParams): Promise<IReadFileResult> {
    const maxBytes = params.max_bytes ?? DEFAULT_READ_MAX_BYTES;
    const raw = params.path.trim();

    if (raw.length === 0) {
      throw new Error('read_file: empty path');
    }

    const rootReal = await realpath(resolve(repoRoot));
    const candidate = isAbsolute(raw) ? resolve(raw) : resolve(join(repoRoot, raw));
    let fileReal: string;

    try {
      fileReal = await realpath(candidate);
    } catch {
      throw new Error(`read_file: path not found: ${raw}`);
    }

    if (!isPathInsideRoot(rootReal, fileReal)) {
      throw new Error('read_file: path resolves outside repository root');
    }

    const st = await stat(fileReal);

    if (!st.isFile()) {
      throw new Error(`read_file: not a regular file: ${raw}`);
    }

    const cap = maxBytes + 1;
    const fh = await open(fileReal, 'r');

    try {
      const buf = Buffer.alloc(cap);
      const { bytesRead } = await fh.read(buf, 0, cap, 0);
      const truncated = bytesRead > maxBytes;
      const sliceLen = Math.min(bytesRead, maxBytes);
      const content = buf.subarray(0, sliceLen).toString('utf8');
      const total_lines = truncated ? null : countLines(content);

      return { content, truncated, total_lines };
    } finally {
      await fh.close();
    }
  }

  /**
   * @inheritdoc
   */
  public grep(repoRoot: string, params: IGrepParams): Promise<IGrepResult> {
    return runRepoGrep(repoRoot, params);
  }

  /**
   * @inheritdoc
   */
  public listTree(repoRoot: string, params: IListTreeParams): Promise<IListTreeResult> {
    return runRepoListTree(repoRoot, params);
  }

  /**
   * @inheritdoc
   */
  public gitStatus(repoRoot: string, params?: IGitStatusParams): Promise<IGitStatusResult> {
    return runRepoGitStatus(repoRoot, params ?? {});
  }

  /**
   * @inheritdoc
   */
  public gitDiff(repoRoot: string, params?: IGitDiffParams): Promise<IGitDiffResult> {
    return runRepoGitDiff(repoRoot, params ?? {});
  }

  /**
   * @inheritdoc
   */
  public showArtifact(repoRoot: string, params: IShowArtifactParams): Promise<IReadFileResult> {
    return runRepoShowArtifact(repoRoot, params);
  }
}

function countLines(text: string): number {
  if (text.length === 0) {
    return 0;
  }

  let n = 1;

  for (let i = 0; i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) {
      n += 1;
    }
  }

  return n;
}
