/**
 * @file runPipeline.feature.ts
 * @layer features
 * @description Placeholder for Milestone A `runPipeline` orchestrator (plan → execute → review).
 */

import { EXIT_SUCCESS } from '@core/contracts/ExitCodes.constants';

import { runPlanChat } from './planStage.feature';

/**
 * Temporary hook proving `features` → `core` wiring compiles under boundary rules.
 * @returns The success exit code constant used once the real pipeline lands.
 */
export function getPipelinePlaceholderExitCode(): typeof EXIT_SUCCESS {
  void runPlanChat;
  return EXIT_SUCCESS;
}
