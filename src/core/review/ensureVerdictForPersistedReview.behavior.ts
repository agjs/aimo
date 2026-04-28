/**
 * @file ensureVerdictForPersistedReview.behavior.ts
 * @layer core
 * @description Normalize reviewer markdown for persistence when the `fake` provider omits `VERDICT:`.
 */

import { parseReviewVerdictFromMarkdown } from './ParseReviewVerdict.behavior';
import type { TReviewVerdict } from './ParseReviewVerdict.behavior';

/**
 * When the in-process fake echoes the user blob without a verdict line, treat review as **pass**
 * for CI and append the required trailing line to persisted markdown.
 * @param markdown - Raw assistant markdown.
 * @param provider - Config provider id for the review stage.
 * @returns Markdown to persist and verdict, or a parse error for non-fake providers.
 */
export function ensureVerdictForPersistedReview(
  markdown: string,
  provider: string,
):
  | { ok: true; readonly markdownOut: string; readonly verdict: TReviewVerdict }
  | { ok: false; readonly message: string } {
  const parsed = parseReviewVerdictFromMarkdown(markdown);
  if (parsed.ok) {
    return { ok: true, markdownOut: markdown, verdict: parsed.verdict };
  }
  if (provider === 'fake') {
    const suffix = '\n\nVERDICT: pass\n';
    return {
      ok: true,
      markdownOut: `${markdown.replace(/\s+$/u, '')}${suffix}`,
      verdict: 'pass',
    };
  }
  return { ok: false, message: parsed.message };
}
