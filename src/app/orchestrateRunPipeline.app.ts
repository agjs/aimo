/**
 * @file orchestrateRunPipeline.app.ts
 * @layer app
 * @description Re-export for `aimo run` — implementation lives under {@link ./runPipeline/}.
 */

export {
  runAimoRunPipeline,
  type TRunPipelineOptions,
} from './runPipeline/runPipelineOrchestrator.app';
