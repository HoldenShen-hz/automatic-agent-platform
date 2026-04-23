/**
 * @fileoverview Backward-compatible exports for legacy Phase 1B orchestration naming.
 *
 * Canonical implementation now lives in:
 * - `runtime/orchestrator/`
 * - `runtime/dispatcher/`
 * - `runtime/planner/`
 */
export { runMultiStepOrchestration, executeMultiStepToolCallForTests, resetMultiStepToolRegistryForTests, } from "./multi-step-orchestration.js";
export { runMultiStepOrchestration as runPhase1BOrchestration, executeMultiStepToolCallForTests as executePhase1BToolCallForTests, resetMultiStepToolRegistryForTests as resetPhase1BToolRegistryForTests, } from "./multi-step-orchestration.js";
export type { MultiStepOrchestrationResult, MultiStepToolExecutionInput, StepFailurePlan, } from "./multi-step-orchestration-types.js";
export type { MultiStepToolExecutionInput as MultiStepOrchestrationInput } from "./multi-step-orchestration-types.js";
export type { MultiStepOrchestrationResult as Phase1BOrchestrationResult, MultiStepToolExecutionInput as Phase1BOrchestrationInput, } from "./multi-step-orchestration-types.js";
