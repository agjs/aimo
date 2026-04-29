/**
 * @file runRepoGrep.bun.ts
 * @layer runtime
 * @description Bounded line-oriented regex search under a repository root (session `/grep`).
 */

import type { Stats } from 'node:fs';
import { open, readdir, realpath, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { IGrepParams, IGrepResult, IGrepMatch } from '@core/ports/IRepoToolsPort.types';
import { REPO_WALK_SKIP_DIRECTORY_NAMES } from '@core/repoTools/RepoWalkSkipDirs.constants';
import { matchPathAgainstSimpleGlob } from '@core/repoTools/simpleGlobPredicate.behavior';
import { isPathInsideRoot } from '@core/runs/isPathInsideRoot.behavior';

const DEFAULT_MAX_MATCHES = 200;
const DEFAULT_MAX_FILES = 4_000;
const DEFAULT_MAX_OUTPUT_BYTES = 65_536;
const MAX_GREP_FILE_BYTES = 512 * 1024;
const MAX_LINE_LEN = 32_768;
/** Hard cap on `context_lines` each side of a hit (pattern rows still capped by `max_matches`). */
const MAX_CONTEXT_LINES_PER_SIDE = 20;

function compileGrepRegex(rawPattern: string): RegExp {
  if (rawPattern.length === 0) {
    throw new Error('grep: empty pattern');
  }

  try {
    return new RegExp(rawPattern);
  } catch {
    throw new Error(`grep: invalid regex: ${rawPattern}`);
  }
}

function capMatchesByOutputBytes(
  matches: readonly IGrepMatch[],
  maxOut: number,
): {
  readonly capped: IGrepMatch[];
  readonly truncated_output: boolean;
} {
  let outBytes = 0;
  let truncatedOutput = false;
  const capped: IGrepMatch[] = [];

  for (const m of matches) {
    const sep = m.is_context_line === true ? '-' : ':';
    const row = `${m.path}${sep}${String(m.line)}${sep}${m.text}\n`;
    const b = Buffer.byteLength(row, 'utf8');

    if (outBytes + b > maxOut) {
      truncatedOutput = true;
      break;
    }

    capped.push(m);
    outBytes += b;
  }

  return { capped, truncated_output: truncatedOutput };
}

function normalizeContextLines(raw: number | undefined): number {
  if (raw === undefined || raw <= 0) {
    return 0;
  }

  return Math.min(raw, MAX_CONTEXT_LINES_PER_SIDE);
}

/**
 * UTF-8 lines from an open handle, or `null` if the slice looks binary.
 * @param fh - Open readable file handle.
 * @param st - File stats (size caps the read).
 * @returns Split lines, or `null` when NUL bytes are present in the read slice.
 */
async function readGrepUtf8LinesFromHandle(
  fh: Awaited<ReturnType<typeof open>>,
  st: Stats,
): Promise<string[] | null> {
  const buf = Buffer.alloc(Math.min(st.size, MAX_GREP_FILE_BYTES));
  const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
  const slice = buf.subarray(0, bytesRead);

  if (slice.includes(0)) {
    return null;
  }

  return slice.toString('utf8').split(/\n/);
}

function collectGrepHitIndices(lines: readonly string[], re: RegExp): number[] {
  const hitIndices: number[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';

    if (line.length > MAX_LINE_LEN) {
      continue;
    }

    if (re.test(line)) {
      hitIndices.push(i);
    }

    re.lastIndex = 0;
  }

  return hitIndices;
}

function pushGrepHitsOnly(
  matches: IGrepMatch[],
  childRel: string,
  lines: readonly string[],
  hitsToUse: readonly number[],
): void {
  for (const i of hitsToUse) {
    const line = lines[i] ?? '';
    matches.push({
      path: childRel,
      line: i + 1,
      text: line,
    });
  }
}

function pushGrepHitsWithContext(
  matches: IGrepMatch[],
  childRel: string,
  lines: readonly string[],
  hitsToUse: readonly number[],
  contextLines: number,
): void {
  const hitSet = new Set(hitsToUse);
  const lineIndices = new Set<number>();

  for (const h of hitsToUse) {
    for (let d = -contextLines; d <= contextLines; d += 1) {
      const j = h + d;

      if (j >= 0 && j < lines.length) {
        lineIndices.add(j);
      }
    }
  }

  const sorted = [...lineIndices].sort((a, b) => a - b);

  for (const i of sorted) {
    const line = lines[i] ?? '';

    if (line.length > MAX_LINE_LEN) {
      continue;
    }

    matches.push({
      path: childRel,
      line: i + 1,
      text: line,
      ...(hitSet.has(i) ? {} : { is_context_line: true as const }),
    });
  }
}

/**
 * Scans one text file for regex hits; appends to `matches` (optionally with context rows).
 * @param fileReal - Realpath of the file under the repo root.
 * @param childRel - Path relative to repo root.
 * @param st - File stats (size used for read cap).
 * @param re - Line regex (caller resets `lastIndex` per line).
 * @param matches - Accumulator (mutated).
 * @param maxHitsPerRepo - Max **matching** lines across the whole walk.
 * @param hitsSoFar - Matching lines already collected.
 * @param contextLines - Lines before/after each hit (0 = legacy one row per hit).
 * @returns `hitsAdded` (matching lines only), walk stop, and whether this file overflowed the hit budget.
 */
async function grepLinesInFile(
  fileReal: string,
  childRel: string,
  st: Stats,
  re: RegExp,
  matches: IGrepMatch[],
  maxHitsPerRepo: number,
  hitsSoFar: number,
  contextLines: number,
): Promise<{
  readonly hitsAdded: number;
  readonly stopWalk: boolean;
  readonly truncatedHits: boolean;
}> {
  const fh = await open(fileReal, 'r');

  try {
    const lines = await readGrepUtf8LinesFromHandle(fh, st);

    if (lines === null) {
      return { hitsAdded: 0, stopWalk: false, truncatedHits: false };
    }

    const hitIndices = collectGrepHitIndices(lines, re);

    if (hitIndices.length === 0) {
      return { hitsAdded: 0, stopWalk: false, truncatedHits: false };
    }

    const remaining = maxHitsPerRepo - hitsSoFar;

    if (remaining <= 0) {
      return { hitsAdded: 0, stopWalk: true, truncatedHits: true };
    }

    const hitsToUse = hitIndices.slice(0, remaining);
    const truncatedHits = hitIndices.length > hitsToUse.length;

    if (contextLines === 0) {
      pushGrepHitsOnly(matches, childRel, lines, hitsToUse);
    } else {
      pushGrepHitsWithContext(matches, childRel, lines, hitsToUse, contextLines);
    }

    const stopWalk = hitsSoFar + hitsToUse.length >= maxHitsPerRepo;

    return { hitsAdded: hitsToUse.length, stopWalk, truncatedHits };
  } finally {
    await fh.close();
  }
}

/**
 * Runs a bounded repo grep (UTF-8 text files only; skips dot-prefixed entries and shared skip-directory basenames).
 * @param repoRoot - Working tree root (not necessarily realpathed yet).
 * @param params - Pattern, optional `context_lines` (capped per side), and caps.
 * @returns Match list and truncation flags.
 */
// eslint-disable-next-line complexity -- iterative DFS with caps; helpers cover regex, caps, and per-file scan
export async function runRepoGrep(repoRoot: string, params: IGrepParams): Promise<IGrepResult> {
  const maxMatches = params.max_matches ?? DEFAULT_MAX_MATCHES;
  const maxFiles = params.max_files_scanned ?? DEFAULT_MAX_FILES;
  const maxOut = params.max_output_bytes ?? DEFAULT_MAX_OUTPUT_BYTES;
  const contextLines = normalizeContextLines(params.context_lines);
  const re = compileGrepRegex(params.pattern.trim());
  const rootReal = await realpath(resolve(repoRoot));
  const matches: IGrepMatch[] = [];
  let filesScanned = 0;
  let truncatedMatches = false;
  let hitsSoFar = 0;
  const glob = params.glob;
  let stop = false;

  const stack: { readonly abs: string; readonly rel: string }[] = [{ abs: rootReal, rel: '' }];

  while (stack.length > 0 && !stop) {
    const cur = stack.pop();

    if (cur === undefined) {
      break;
    }

    let entries;

    try {
      entries = await readdir(cur.abs, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const ent of entries) {
      if (stop) {
        break;
      }

      if (ent.name.startsWith('.')) {
        continue;
      }

      if (ent.isDirectory()) {
        if (!REPO_WALK_SKIP_DIRECTORY_NAMES.has(ent.name)) {
          stack.push({
            abs: join(cur.abs, ent.name),
            rel: cur.rel === '' ? ent.name : `${cur.rel}/${ent.name}`,
          });
        }

        continue;
      }

      if (!ent.isFile()) {
        continue;
      }

      const childAbs = join(cur.abs, ent.name);
      const childRel = cur.rel === '' ? ent.name : `${cur.rel}/${ent.name}`;

      if (!matchPathAgainstSimpleGlob(childRel, glob)) {
        continue;
      }

      let fileReal: string;

      try {
        fileReal = await realpath(childAbs);
      } catch {
        continue;
      }

      if (!isPathInsideRoot(rootReal, fileReal)) {
        continue;
      }

      if (filesScanned >= maxFiles) {
        truncatedMatches = true;
        stop = true;
        break;
      }

      const st = await stat(fileReal).catch(() => null);

      if (st === null || !st.isFile() || st.size > MAX_GREP_FILE_BYTES) {
        continue;
      }

      filesScanned += 1;
      const { hitsAdded, stopWalk, truncatedHits } = await grepLinesInFile(
        fileReal,
        childRel,
        st,
        re,
        matches,
        maxMatches,
        hitsSoFar,
        contextLines,
      );

      if (truncatedHits) {
        truncatedMatches = true;
      }

      hitsSoFar += hitsAdded;

      if (stopWalk) {
        stop = true;
        break;
      }
    }
  }

  const { capped, truncated_output } = capMatchesByOutputBytes(matches, maxOut);

  return {
    matches: capped,
    truncated_matches: truncatedMatches,
    truncated_output,
    files_scanned: filesScanned,
  };
}
