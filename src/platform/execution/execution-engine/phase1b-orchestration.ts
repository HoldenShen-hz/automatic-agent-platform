/**
 * @fileoverview Backward-compatible exports for legacy Phase 1B orchestration naming.
 *
 * Canonical implementation now lives in:
 * - `runtime/orchestrator/`
 * - `runtime/dispatcher/`
 * - `runtime/planner/`
 */

export {
  runMultiStepOrchestration,
  executeMultiStepToolCallForTests,
  resetMultiStepToolRegistryForTests,
} from "../../../core/runtime/orchestrator/index.js";
export {
  runMultiStepOrchestration as runPhase1BOrchestration,
  executeMultiStepToolCallForTests as executePhase1BToolCallForTests,
  resetMultiStepToolRegistryForTests as resetPhase1BToolRegistryForTests,
} from "../../../core/runtime/orchestrator/index.js";

export type {
  MultiStepOrchestrationResult,
  MultiStepToolExecutionInput,
  StepFailurePlan,
} from "../../../core/runtime/orchestrator/types.js";

export type { MultiStepToolExecutionInput as MultiStepOrchestrationInput } from "../../../core/runtime/orchestrator/types.js";
export type {
  MultiStepOrchestrationResult as Phase1BOrchestrationResult,
  MultiStepToolExecutionInput as Phase1BOrchestrationInput,
} from "../../../core/runtime/orchestrator/types.js";
