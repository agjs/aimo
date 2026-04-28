/**
 * @file ParseReviewVerdict.behavior.ts
 * @layer core
 * @description Parse trailing `VERDICT:` line from reviewer markdown (no I/O).
 */

/** Allowed final-line verdict tokens (match CLI exit contract). */
export type TReviewVerdict = 'pass' | 'changes_requested' | 'fail';

/**
 * The last non-empty line must be `VERDICT: pass|changes_requested|fail` (case-insensitive token).
 * @param markdown - Full assistant markdown.
 * @returns Parsed verdict or a human-readable error.
 */
export function parseReviewVerdictFromMarkdown(
  markdown: string,
): { ok: true; verdict: TReviewVerdict } | { ok: false; message: string } {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');

  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const trimmed = lines[i]?.trim() ?? '';

    if (trimmed.length === 0) {
      continue;
    }

    const m = /^VERDICT:\s*(pass|changes_requested|fail)\s*$/i.exec(trimmed);

    if (!m?.[1]) {
      return {
        ok: false,
        message: `review output must end with a line VERDICT: pass|changes_requested|fail; last non-empty line was: ${trimmed.slice(0, 120)}`,
      };
    }

    const raw = m[1].toLowerCase();

    if (raw === 'pass') {
      return { ok: true, verdict: 'pass' };
    }

    if (raw === 'changes_requested') {
      return { ok: true, verdict: 'changes_requested' };
    }

    return { ok: true, verdict: 'fail' };
  }

  return { ok: false, message: 'review output has no non-empty lines' };
}
