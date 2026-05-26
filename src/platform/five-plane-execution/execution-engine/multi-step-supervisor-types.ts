import type { StepOutputRecord, TransitionAuditContext } from "../../contracts/types/domain.js";
import type { WorkflowStepRetryDecision } from "../../five-plane-orchestration/oapeflir/workflow/workflow-step-retry-policy.js";
import type { StreamBridge } from "../../five-plane-interface/channel-gateway/stream-bridge.js";
import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { ArtifactStore } from "../../five-plane-state-evidence/artifacts/artifact-store.js";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AdmissionDecision } from "../dispatcher/admission-controller.js";
import type { TransitionService } from "../state-transition/transition-service.js";
import type { ContextCompactionResult, ContextCompactionService } from "./context-compaction-service.js";
import type { MultiStepToolExecutionInput, StepFailurePlan } from "./multi-step-orchestration-types.js";
import type { WorkflowDebuggerService } from "../../../ops-maturity/workflow-debugger/workflow-debugger-service.js";

export function normalizeStepFailurePlan(value: string | StepFailurePlan): StepFailurePlan {
  return typeof value === "string" ? { errorCode: value } : value;
}

export function resolveStepFailurePlan(
  input: MultiStepToolExecutionInput,
  stepId: string,
  attempt: number,
): StepFailurePlan | null {
  const plannedFailure = input.stepFailurePlans?.[stepId]?.[attempt - 1];
  if (plannedFailure != null) {
    return normalizeStepFailurePlan(plannedFailure);
  }
  if (attempt === 1 && input.stepFailureInjection?.has(stepId)) {
    return { errorCode: "tool.execution_failed", summary: `Step ${stepId} failed (injected)`, message: "Injected failure" };
  }
  return null;
}

export function normalizeStepErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith("workflow.output_schema_invalid")) return "validation.schema_mismatch";
  if (message.startsWith("workflow.output_schema_missing")) return "validation.invalid_input";
  return "internal.unexpected_error";
}

export function buildStepFailureSummary(stepId: string, decision: WorkflowStepRetryDecision): string {
  switch (decision.action) {
    case "retry":
      return `Step ${stepId} failed (${decision.errorCode}) and will retry.`;
    case "escalate":
      return `Step ${stepId} requires escalation (${decision.errorCode}).`;
    default:
      return `Step ${stepId} failed (${decision.errorCode}).`;
  }
}

export interface StepSupervisorContext {
  taskId: string;
  sessionId: string;
  traceId: string;
  traceContext: ReturnType<typeof import("../../shared/observability/trace-context.js").createRootTraceContext>;
  streamId: string;
  harnessRunId: string;
  admissionDecision: AdmissionDecision;
  input: MultiStepToolExecutionInput;
  routing: ReturnType<typeof import("../../five-plane-orchestration/routing/intake-router.js").IntakeRouter.prototype.route>;
  plannedWorkflow: ReturnType<typeof import("../../five-plane-orchestration/routing/workflow-planner.js").WorkflowPlanner.prototype.plan>;
  planGraphId?: string | null;
  outputs: Record<string, unknown>;
  stepOutputs: StepOutputRecord[];
  toolExposureService: import("../tool-executor/role-tool-exposure-service.js").RoleToolExposureService;
  workflowDebugger?: WorkflowDebuggerService | null;
  latestCompaction: ContextCompactionResult | null;
  executionAttemptCounter: number;
  workflowRetryCount: number;
  workflowLastErrorCode: string | null;
  blockedForDecision: boolean;
  skippedStepIds: Set<string>;
  failedStepIds: Set<string>;
}

export interface StepExecutionResult {
  stepCompleted: boolean;
  blockedForDecision: boolean;
  latestCompaction: ContextCompactionResult | null;
  workflowRetryCount: number;
  workflowLastErrorCode: string | null;
  outputs: Record<string, unknown>;
  stepOutputs: StepOutputRecord[];
  skippedStepIds: Set<string>;
  failedStepIds: Set<string>;
}

export interface ExecutionDeps {
  store: AuthoritativeTaskStore;
  db: AuthoritativeSqlDatabase;
  transitions: TransitionService;
  artifactStore: ArtifactStore;
  contextCompaction: ContextCompactionService;
  streamBridge: StreamBridge;
  transitionExecutionStatus: TransitionService["transitionExecutionStatus"];
  createContext: (reasonCode: string) => TransitionAuditContext;
}
