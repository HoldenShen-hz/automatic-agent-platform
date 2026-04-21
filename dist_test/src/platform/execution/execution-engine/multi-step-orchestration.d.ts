/**
 * @fileoverview Multi-step orchestrator entrypoint.
 */
import { executeMultiStepToolCallForTests, resetMultiStepToolRegistryForTests } from "../dispatcher/index.js";
import type { MultiStepOrchestrationResult, MultiStepToolExecutionInput } from "./multi-step-orchestration-types.js";
export { executeMultiStepToolCallForTests, resetMultiStepToolRegistryForTests, };
export type { MultiStepOrchestrationResult, MultiStepToolExecutionInput, StepFailurePlan, } from "./multi-step-orchestration-types.js";
export declare function runMultiStepOrchestration(input: MultiStepToolExecutionInput): Promise<MultiStepOrchestrationResult>;
