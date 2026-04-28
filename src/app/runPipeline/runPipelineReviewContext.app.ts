/**
 * @file runPipelineReviewContext.app.ts
 * @layer app
 * @description Load post-execute review inputs, preferring `*.shrunk.md` when present.
 */

import { join } from 'node:path';

import { shrunkBasenameForContextSource } from '@core/contextSources/ContextSourcePaths.behavior';
import { GIT_DIFF_AFTER_BASENAME } from '@core/runs/AimoRunPaths.constants';

/**
 * Reads diff + executor transcript for the reviewer, using shrunk artifacts when written.
 * @param runDir - Absolute `.aimo/runs/<id>/`.
 * @returns Markdown strings passed to {@link runReviewChat}.
 */
export async function loadReviewDiffAndTranscriptFromRunDir(runDir: string): Promise<{
  readonly diffMarkdown: string;
  readonly transcriptMarkdown: string;
}> {
  const diffShrunkPath = join(runDir, shrunkBasenameForContextSource('execute.git_diff_after'));
  const diffRawPath = join(runDir, GIT_DIFF_AFTER_BASENAME);
  let diffMarkdown = '';

  if (await Bun.file(diffShrunkPath).exists()) {
    diffMarkdown = await Bun.file(diffShrunkPath).text();
  } else if (await Bun.file(diffRawPath).exists()) {
    diffMarkdown = await Bun.file(diffRawPath).text();
  }

  const outShrunk = join(runDir, shrunkBasenameForContextSource('execute.stdout'));
  const errShrunk = join(runDir, shrunkBasenameForContextSource('execute.stderr'));
  const parts: string[] = [];

  if (await Bun.file(outShrunk).exists()) {
    parts.push('## Shrunk executor stdout\n\n', await Bun.file(outShrunk).text());
  }

  if (await Bun.file(errShrunk).exists()) {
    parts.push('\n\n## Shrunk executor stderr\n\n', await Bun.file(errShrunk).text());
  }

  return { diffMarkdown, transcriptMarkdown: parts.join('') };
}
