import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { StreamEventFrame } from "../../interface/channel-gateway/stream-bridge.js";
import type { IntakeRouteDecision } from "../../orchestration/routing/intake-router.js";
import type { WorkflowPlanner } from "../../orchestration/routing/workflow-planner.js";
import type { AdmissionBackpressureSnapshot, AdmissionPolicy } from "../dispatcher/admission-controller.js";
import type { ContextCompactionResult } from "./context-compaction-service.js";
import type { BudgetLedger } from "../../contracts/executable-contracts/index.js";

export interface StepFailurePlan {
  errorCode: string;
  summary?: string;
  message?: string;
}

export interface MultiStepToolExecutionInput {
  dbPath: string;
  title: string;
  request: string;
  // R4-25 (INV-BUDGET-001): Budget tracking - harnessRunId from validated PlanGraphBundle
  harnessRunId?: string;
  budgetLedger?: BudgetLedger;
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
  routing: IntakeRouteDecision;
  plannedWorkflow: ReturnType<WorkflowPlanner["plan"]>;
  compaction: ContextCompactionResult | null;
}
