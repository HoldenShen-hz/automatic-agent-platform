import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { StreamEventFrame } from "../../interface/channel-gateway/stream-bridge.js";
import type { IntakeRouter } from "../../orchestration/routing/intake-router.js";
import type { WorkflowPlanner } from "../../orchestration/routing/workflow-planner.js";
import type { AdmissionBackpressureSnapshot, AdmissionPolicy } from "../dispatcher/admission-controller.js";
import type { ContextCompactionResult } from "./context-compaction-service.js";

export interface StepFailurePlan {
  errorCode: string;
  summary?: string;
  message?: string;
}

export interface MultiStepToolExecutionInput {
  dbPath: string;
  title: string;
  request: string;
  contextBudgetTokens?: number;
  admissionPolicy?: AdmissionPolicy;
  admissionBackpressureSnapshot?: () => AdmissionBackpressureSnapshot | null;
  crashInjection?: import("../recovery/workflow-crash-simulator.js").WorkflowCrashInjection;
  stepFailureInjection?: ReadonlySet<string>;
  stepFailurePlans?: Readonly<Record<string, readonly (string | StepFailurePlan)[]>>;
  stepOutputOverrides?: Readonly<Record<string, Record<string, unknown>>>;
}

export interface MultiStepOrchestrationResult {
  snapshot: ReturnType<AuthoritativeTaskStore["loadTaskSnapshot"]>;
  streamFrames: StreamEventFrame[];
  routing: ReturnType<IntakeRouter["route"]>;
  plannedWorkflow: ReturnType<WorkflowPlanner["plan"]>;
  compaction: ContextCompactionResult | null;
}
