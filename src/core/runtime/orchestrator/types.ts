/**
 * @fileoverview Multi-Step Orchestration types.
 */

import type { AuthoritativeTaskStore } from "../../../platform/state-evidence/truth/authoritative-task-store.js";
import type { IntakeRouter } from "../../../platform/orchestration/routing/intake-router.js";
import type { WorkflowPlanner } from "../../../platform/orchestration/routing/workflow-planner.js";
import type { ContextCompactionResult } from "../../../platform/execution/execution-engine/context-compaction-service.js";
import type { StreamEventFrame } from "../../../platform/interface/channel-gateway/stream-bridge.js";

export interface MultiStepToolExecutionInput {
  dbPath: string;
  title: string;
  request: string;
  contextBudgetTokens?: number;
  crashInjection?: import("../../../platform/execution/recovery/workflow-crash-simulator.js").WorkflowCrashInjection;
  stepFailureInjection?: ReadonlySet<string>;
  stepFailurePlans?: Readonly<Record<string, readonly (string | StepFailurePlan)[]>>;
  stepOutputOverrides?: Readonly<Record<string, Record<string, unknown>>>;
}

export interface StepFailurePlan {
  errorCode: string;
  summary?: string;
  message?: string;
}

/**
 * Result of multi-step orchestration containing all outputs and metadata.
 */
export interface MultiStepOrchestrationResult {
  snapshot: ReturnType<AuthoritativeTaskStore["loadTaskSnapshot"]>;
  streamFrames: StreamEventFrame[];
  routing: ReturnType<IntakeRouter["route"]>;
  plannedWorkflow: ReturnType<WorkflowPlanner["plan"]>;
  compaction: ContextCompactionResult | null;
}
