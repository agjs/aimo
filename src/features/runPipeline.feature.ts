/**
 * @file runPipeline.feature.ts
 * @layer features
 * @description Chat-stage building blocks for plan/review; full `aimo run` orchestration lives in `app/runPipeline/`.
 */

import { EXIT_SUCCESS } from '@core/contracts/ExitCodes.constants';

import { runPlanChat } from './planStage.feature';
import { runReviewChat } from './reviewStage.feature';

/**
 * Compile-time hook proving `features` → `core` wiring stays linked for the pipeline graph.
 * @returns The success exit code constant for composition checks.
 */
export function getPipelinePlaceholderExitCode(): typeof EXIT_SUCCESS {
  void runPlanChat;
  void runReviewChat;
  return EXIT_SUCCESS;
}
