/**
 * @file runPipelineApplyShrinkers.app.ts
 * @layer app
 * @description Run `pipeline.shrinkers` after execute: cheap worker chats + `*.shrunk.md` artifacts.
 */

import { unlink } from 'node:fs/promises';
import { join } from 'node:path';

import type { TAimoConfig } from '@core/config/AimoConfig.schema';
import type { TContextSource } from '@core/contextSources/ContextSource.constants';
import {
  rawBasenameForContextSource,
  shrunkBasenameForContextSource,
} from '@core/contextSources/ContextSourcePaths.behavior';
import { resolveWorkerProfile } from '@core/workers/ResolveWorker.behavior';
import type { TWorkersSidecarCallV1 } from '@core/workers/SerializeWorkersSidecar.behavior';
import { runWorkerChat } from '@features/workersStage.feature';
import {
  writeRunProgressLine,
  writeRunProgressWarnLine,
} from '@runtime/bun/RunProgressStderrStyle.bun';

import { selectWorkerChatPortForRun } from '../shared/runPipelineChats.app';

/**
 * Runs shrinkers for deduped `pipeline.shrinkers` rows, writes shrunk markdown + optional raw cleanup.
 * @param input - Shrinker invocation bundle.
 * @param input.runDir - Absolute `.aimo/runs/<id>/`.
 * @param input.aimoConfig - Merged config (workers + shrinkers).
 * @param input.shrinkers - Deduped shrinker list from preflight.
 * @param input.keepRaw - When false, deletes raw source files after successful shrink writes.
 * @returns Ledger rows for `workers.json`.
 */
export async function runPipelineApplyShrinkers(input: {
  readonly runDir: string;
  readonly aimoConfig: TAimoConfig;
  readonly shrinkers: ReadonlyArray<{ readonly source: TContextSource; readonly worker: string }>;
  readonly keepRaw: boolean;
}): Promise<{ readonly calls: readonly TWorkersSidecarCallV1[] }> {
  const calls: TWorkersSidecarCallV1[] = [];

  for (const row of input.shrinkers) {
    const rawName = rawBasenameForContextSource(row.source);
    const rawPath = join(input.runDir, rawName);
    const rawFile = Bun.file(rawPath);
    const rawText = (await rawFile.exists()) ? await rawFile.text() : '';
    const resolved = resolveWorkerProfile(input.aimoConfig, row.worker);

    if (!resolved.ok) {
      writeRunProgressWarnLine(resolved.message);
      continue;
    }

    const worker = resolved.profile;
    const chat = selectWorkerChatPortForRun(worker);

    if (!chat) {
      writeRunProgressWarnLine(
        `worker "${row.worker}" provider "${worker.provider}" is not supported or HTTP credentials are missing`,
      );
      continue;
    }

    writeRunProgressLine(
      `shrink ${row.source} via ${row.worker} (${worker.provider} / ${worker.model})…`,
    );
    const out = await runWorkerChat({
      worker,
      chat,
      sourceName: row.source,
      rawText,
    });
    const shrunkPath = join(input.runDir, shrunkBasenameForContextSource(row.source));
    await Bun.write(shrunkPath, `${out.markdown}\n`);
    calls.push({
      source: row.source,
      worker: row.worker,
      provider: worker.provider,
      model: worker.model,
      chars_in: out.charsIn,
      chars_out: out.charsOut,
      truncated_in: out.truncatedIn,
      ...(out.usage !== undefined
        ? {
            prompt_tokens: out.usage.prompt_tokens,
            completion_tokens: out.usage.completion_tokens,
            total_tokens: out.usage.total_tokens,
          }
        : {}),
    });
    writeRunProgressLine(
      `shrink ${row.source} done (${String(out.charsOut)} chars out${out.truncatedIn ? ', input truncated' : ''})`,
    );

    if (!input.keepRaw) {
      await unlinkRawForSource(input.runDir, row.source);
    }
  }

  return { calls };
}

async function unlinkRawForSource(runDir: string, source: TContextSource): Promise<void> {
  const base = rawBasenameForContextSource(source);

  try {
    await unlink(join(runDir, base));
  } catch {
    /* ignore missing */
  }
}
