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
//# sourceMappingURL=phase1b-orchestration.js.map