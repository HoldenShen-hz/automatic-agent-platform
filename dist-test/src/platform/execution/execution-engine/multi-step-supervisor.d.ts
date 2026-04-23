/**
 * @fileoverview Multi-step workflow supervisor for orchestration execution.
 */
import type { StepOutputRecord, TransitionAuditContext } from "../../contracts/types/domain.js";
import type { StreamBridge } from "../../interface/channel-gateway/stream-bridge.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { ArtifactStore } from "../../state-evidence/artifacts/artifact-store.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import { type WorkflowStepRetryDecision } from "../../orchestration/oapeflir/workflow/workflow-step-retry-policy.js";
import type { AdmissionDecision } from "../dispatcher/admission-controller.js";
import type { TransitionService } from "../state-transition/transition-service.js";
import type { ContextCompactionResult } from "./context-compaction-service.js";
import type { ContextCompactionService } from "./context-compaction-service.js";
import type { MultiStepToolExecutionInput, StepFailurePlan } from "./multi-step-orchestration-types.js";
export declare function normalizeStepFailurePlan(value: string | StepFailurePlan): StepFailurePlan;
export declare function resolveStepFailurePlan(input: MultiStepToolExecutionInput, stepId: string, attempt: number): StepFailurePlan | null;
export declare function normalizeStepErrorCode(error: unknown): string;
export declare function buildStepFailureSummary(stepId: string, decision: WorkflowStepRetryDecision): string;
export interface StepSupervisorContext {
    taskId: string;
    sessionId: string;
    traceId: string;
    traceContext: ReturnType<typeof import("../../shared/observability/trace-context.js").createRootTraceContext>;
    streamId: string;
    admissionDecision: AdmissionDecision;
    input: MultiStepToolExecutionInput;
    routing: ReturnType<typeof import("../../orchestration/routing/intake-router.js").IntakeRouter.prototype.route>;
    plannedWorkflow: ReturnType<typeof import("../../orchestration/routing/workflow-planner.js").WorkflowPlanner.prototype.plan>;
    outputs: Record<string, unknown>;
    stepOutputs: StepOutputRecord[];
    toolExposureService: import("../tool-executor/role-tool-exposure-service.js").RoleToolExposureService;
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
interface ExecutionDeps {
    store: AuthoritativeTaskStore;
    db: AuthoritativeSqlDatabase;
    transitions: TransitionService;
    artifactStore: ArtifactStore;
    contextCompaction: ContextCompactionService;
    streamBridge: StreamBridge;
    transitionExecutionStatus: TransitionService["transitionExecutionStatus"];
    createContext: (reasonCode: string) => TransitionAuditContext;
}
export declare function executeStepLoop(ctx: StepSupervisorContext, deps: ExecutionDeps): Promise<StepExecutionResult>;
export {};
