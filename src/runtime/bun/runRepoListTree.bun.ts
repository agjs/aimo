/**
 * @file runRepoListTree.bun.ts
 * @layer runtime
 * @description Bounded directory listing under a repository root (session `/tree`).
 */

import type { Dirent } from 'node:fs';
import { readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';

import type { IListTreeParams, IListTreeResult } from '@core/ports/IRepoToolsPort.types';
import { REPO_WALK_SKIP_DIRECTORY_NAMES } from '@core/repoTools/RepoWalkSkipDirs.constants';
import { isPathInsideRoot } from '@core/runs/isPathInsideRoot.behavior';

const DEFAULT_MAX_DEPTH = 8;
const DEFAULT_MAX_ENTRIES = 2000;
const DEFAULT_MAX_OUTPUT_BYTES = 65_536;

function capLinesByOutputBytes(
  lines: readonly string[],
  maxOut: number,
): { readonly capped: string[]; readonly truncated_output: boolean } {
  let outBytes = 0;
  const capped: string[] = [];
  let truncatedOutput = false;

  for (const line of lines) {
    const row = `${line}\n`;
    const b = Buffer.byteLength(row, 'utf8');

    if (outBytes + b > maxOut) {
      truncatedOutput = true;
      break;
    }

    capped.push(line);
    outBytes += b;
  }

  return { capped, truncated_output: truncatedOutput };
}

async function resolveListTreeStart(
  repoRoot: string,
  rawRoot: string,
): Promise<{ readonly startAbs: string; readonly relPrefix: string }> {
  const rootReal = await realpath(resolve(repoRoot));
  const trimmed = rawRoot.trim();

  if (trimmed.length === 0 || trimmed === '.') {
    return { startAbs: rootReal, relPrefix: '' };
  }

  const candidate = isAbsolute(trimmed) ? resolve(trimmed) : resolve(join(repoRoot, trimmed));
  let abs: string;

  try {
    abs = await realpath(candidate);
  } catch {
    throw new Error(`list_tree: path not found: ${trimmed}`);
  }

  if (!isPathInsideRoot(rootReal, abs)) {
    throw new Error('list_tree: path resolves outside repository root');
  }

  const st = await stat(abs);

  if (!st.isDirectory()) {
    throw new Error(`list_tree: not a directory: ${trimmed}`);
  }

  const rel = relative(rootReal, abs).replace(/\\/g, '/');

  return { startAbs: abs, relPrefix: rel.length === 0 || rel === '.' ? '' : rel };
}

function partitionSortedEntries(dirents: readonly Dirent[]): {
  readonly dirs: Dirent[];
  readonly files: Dirent[];
} {
  const dirs: Dirent[] = [];
  const files: Dirent[] = [];

  for (const e of dirents) {
    if (e.name.startsWith('.')) {
      continue;
    }

    if (e.isDirectory()) {
      if (!REPO_WALK_SKIP_DIRECTORY_NAMES.has(e.name)) {
        dirs.push(e);
      }
    } else if (e.isFile()) {
      files.push(e);
    }
  }

  dirs.sort((a, b) => a.name.localeCompare(b.name));
  files.sort((a, b) => a.name.localeCompare(b.name));

  return { dirs, files };
}

type TWalkStats = { dirs_visited: number; truncated_entries: boolean };

async function walkDirectory(
  abs: string,
  relPrefix: string,
  depth: number,
  maxDepth: number,
  maxEntries: number,
  lines: string[],
  stats: TWalkStats,
): Promise<void> {
  if (lines.length >= maxEntries) {
    stats.truncated_entries = true;
    return;
  }

  stats.dirs_visited += 1;

  let dirents: Dirent[];

  try {
    dirents = await readdir(abs, { withFileTypes: true });
  } catch {
    return;
  }

  const { dirs, files } = partitionSortedEntries(dirents);

  for (const d of dirs) {
    if (lines.length >= maxEntries) {
      stats.truncated_entries = true;
      return;
    }

    const childRel = relPrefix === '' ? d.name : `${relPrefix}/${d.name}`;
    lines.push(`${childRel}/`);

    if (depth < maxDepth) {
      await walkDirectory(
        join(abs, d.name),
        childRel,
        depth + 1,
        maxDepth,
        maxEntries,
        lines,
        stats,
      );
    }
  }

  for (const f of files) {
    if (lines.length >= maxEntries) {
      stats.truncated_entries = true;
      return;
    }

    const childRel = relPrefix === '' ? f.name : `${relPrefix}/${f.name}`;
    lines.push(childRel);
  }
}

/**
 * Depth-first listing of files and directories under `repoRoot`, with caps.
 * @param repoRoot - Working tree root.
 * @param params - Optional subtree `root`, depth/entry/output caps.
 * @returns Relative paths (dirs end with `/`) and truncation metadata.
 */
export async function runRepoListTree(
  repoRoot: string,
  params: IListTreeParams,
): Promise<IListTreeResult> {
  const maxDepth = params.max_depth ?? DEFAULT_MAX_DEPTH;
  const maxEntries = params.max_entries ?? DEFAULT_MAX_ENTRIES;
  const maxOut = params.max_output_bytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const rawRoot = (params.root ?? '').trim();

  const { startAbs, relPrefix } = await resolveListTreeStart(repoRoot, rawRoot);
  const lines: string[] = [];
  const stats: TWalkStats = { dirs_visited: 0, truncated_entries: false };

  await walkDirectory(startAbs, relPrefix, 0, maxDepth, maxEntries, lines, stats);

  const { capped, truncated_output } = capLinesByOutputBytes(lines, maxOut);

  return {
    lines: capped,
    truncated_entries: stats.truncated_entries,
    truncated_output,
    dirs_visited: stats.dirs_visited,
  };
}
