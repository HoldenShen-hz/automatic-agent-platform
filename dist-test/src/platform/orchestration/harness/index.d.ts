import { AsyncHarnessService } from "./async-harness-service.js";
import { ContextAssembler, type HarnessContext, type HarnessContextSourceSet } from "./context-assembler.js";
import { DurableHarnessService } from "./durable/durable-harness-service.js";
import { GuardrailEngine, type GuardrailAssessment } from "./guardrails/guardrail-engine.js";
import { HitlRuntime, type HitlRequest } from "./hitl-runtime.js";
import { EvalRunService } from "./evaluation/eval-run-service.js";
import { HarnessMemoryManager } from "./memory-manager.js";
import { type OapeflirSemanticPhase } from "./oapeflir-harness-mapping.js";
import { type HarnessFailureType } from "./recovery-controller.js";
import { ToolbeltAssembler, type HarnessToolbelt } from "./toolbelt-assembler.js";
export * from "./harness-baseline.js";
export * from "./harness-bootstrap.js";
export * from "./async-harness-service.js";
export * from "./context-assembler.js";
export * from "./durable/durable-harness-service.js";
export * from "./evaluation/eval-run-service.js";
export * from "./evaluation/task-outcome-grader.js";
export * from "./guardrails/guardrail-engine.js";
export * from "./hitl-runtime.js";
export * from "./loop/index.js";
export * from "./memory-manager.js";
export * from "./oapeflir-harness-mapping.js";
export * from "./recovery-controller.js";
export * from "./toolbelt-assembler.js";
export type HarnessRole = "planner" | "generator" | "evaluator" | "hitl_operator" | "loop_controller";
export type HarnessDecisionAction = "accept" | "retry_same_plan" | "replan" | "escalate_to_human" | "downgrade_mode" | "abort";
export type HarnessRunStatus = "created" | "running" | "waiting_hitl" | "sleeping" | "recovering" | "completed" | "aborted";
export interface ConstraintPack {
    readonly policyIds: readonly string[];
    readonly approvalMode: "none" | "required" | "supervised";
    readonly autonomyMode: "manual" | "supervised" | "auto" | "full_auto";
    readonly toolPolicy: {
        readonly allowedTools: readonly string[];
    };
    readonly risk_policy: {
        readonly maxRiskScore: number;
        readonly escalationThreshold: number;
    };
    readonly output_policy: {
        readonly requiredEvidence: readonly string[];
        readonly redactSensitiveData: boolean;
    };
    readonly budget: {
        readonly maxSteps: number;
        readonly maxCost: number;
        readonly maxDurationMs: number;
    };
}
export interface PlanBundle {
    readonly planId: string;
    readonly summary: string;
    readonly checkpoints: readonly string[];
    readonly policyIds: readonly string[];
}
export interface WorkProduct {
    readonly artifactRefs: readonly string[];
    readonly output: Readonly<Record<string, unknown>>;
    readonly promptLineage: readonly string[];
}
export interface EvaluationReport {
    readonly verdict: HarnessDecisionAction;
    readonly score: number;
    readonly evidenceRefs: readonly string[];
    readonly notes?: string;
}
export interface FeedbackEnvelope {
    readonly feedbackId: string;
    readonly signals: readonly string[];
    readonly learnedActions: readonly string[];
    readonly createdAt: string;
}
export interface ContextSnapshot {
    readonly snapshotId: string;
    readonly runId: string;
    readonly domainId: string;
    readonly iteration: number;
    readonly stepCount: number;
    readonly lastDecisionId: string | null;
    readonly capturedAt: string;
}
export interface WorkflowSleepLease {
    readonly leaseId: string;
    readonly runId: string;
    readonly reason: string;
    readonly resumeAt: string;
    readonly createdAt: string;
}
export interface RecoveryCheckpoint {
    readonly checkpointId: string;
    readonly runId: string;
    readonly lastCompletedStepId: string | null;
    readonly statusBeforeRecovery: HarnessRunStatus;
    readonly createdAt: string;
}
export interface HarnessTimelineEvent {
    readonly eventId: string;
    readonly runId: string;
    readonly type: "run_created" | "step_completed" | "guardrails_evaluated" | "decision_recorded" | "sleep_started" | "recovery_started" | "hitl_requested" | "hitl_resolved";
    readonly payload: Readonly<Record<string, unknown>>;
    readonly recordedAt: string;
}
export interface HarnessStep {
    readonly stepId: string;
    readonly role: HarnessRole;
    readonly stage: string;
    readonly iteration: number;
    readonly semanticPhase: OapeflirSemanticPhase;
    readonly inputs: Readonly<Record<string, unknown>>;
    readonly outputs: Readonly<Record<string, unknown>>;
    readonly startedAt: string;
    readonly completedAt: string;
}
export interface HarnessDecision {
    readonly decisionId: string;
    readonly action: HarnessDecisionAction;
    readonly reasonCodes: readonly string[];
    readonly confidence: number;
    readonly createdAt: string;
}
export interface HarnessRun {
    readonly runId: string;
    readonly taskId: string;
    readonly domainId: string;
    readonly constraintPack: ConstraintPack;
    readonly steps: readonly HarnessStep[];
    readonly maxIterations: number;
    readonly currentIteration: number;
    readonly status: HarnessRunStatus;
    readonly createdAt: string;
    readonly completedAt: string | null;
    readonly decision: HarnessDecision | null;
    readonly contextSnapshots: readonly ContextSnapshot[];
    readonly sleepLease: WorkflowSleepLease | null;
    readonly recoveryCheckpoint: RecoveryCheckpoint | null;
    readonly feedbackEnvelope: FeedbackEnvelope | null;
    readonly toolbelt: HarnessToolbelt | null;
    readonly guardrailAssessment: GuardrailAssessment | null;
    readonly hitlRequest: HitlRequest | null;
    readonly timeline: readonly HarnessTimelineEvent[];
}
export interface HarnessLoopInput {
    readonly taskId: string;
    readonly domainId: string;
    readonly constraintPack: ConstraintPack;
    readonly plannerOutput: Readonly<Record<string, unknown>>;
    readonly generatorOutput: Readonly<Record<string, unknown>>;
    readonly evaluatorOutput: Readonly<Record<string, unknown>>;
    readonly evaluatorScore: number;
    readonly riskScore?: number;
    readonly requestedTools?: readonly string[];
    readonly producedEvidenceRefs?: readonly string[];
    readonly requiresHuman?: boolean;
    readonly iteration?: number;
}
export declare class HarnessRuntimeService {
    private readonly toolbeltAssembler;
    private readonly guardrailEngine;
    private readonly hitlRuntime;
    private readonly memoryManager;
    private readonly evalRunService;
    private readonly durableService;
    private readonly contextAssembler;
    private readonly recoveryController;
    constructor(options?: {
        toolbeltAssembler?: ToolbeltAssembler;
        guardrailEngine?: GuardrailEngine;
        hitlRuntime?: HitlRuntime;
        memoryManager?: HarnessMemoryManager;
        evalRunService?: EvalRunService;
        durableService?: DurableHarnessService;
        contextAssembler?: ContextAssembler;
    });
    createRun(input: {
        taskId: string;
        domainId: string;
        constraintPack: ConstraintPack;
    }): HarnessRun;
    appendStep(run: HarnessRun, input: {
        role: HarnessRole;
        stage: string;
        inputs: Readonly<Record<string, unknown>>;
        outputs: Readonly<Record<string, unknown>>;
        iteration?: number;
    }): HarnessRun;
    captureContextSnapshot(run: HarnessRun): ContextSnapshot;
    assembleContext(sources: HarnessContextSourceSet, tokenBudget: number): HarnessContext;
    snapshotContext(run: HarnessRun, context: HarnessContext): ContextSnapshot;
    sleep(run: HarnessRun, reason: string, resumeAt: string): HarnessRun;
    recover(run: HarnessRun): HarnessRun;
    resume(run: HarnessRun): HarnessRun;
    openHitlReview(run: HarnessRun, reason: string, evidenceRefs: readonly string[]): HarnessRun;
    resolveHitlReview(run: HarnessRun, resolution: "approved" | "rejected", actorId: string): HarnessRun;
    listTimeline(run: HarnessRun): readonly HarnessTimelineEvent[];
    writeMemory(run: HarnessRun, namespace: Parameters<HarnessMemoryManager["write"]>[0], key: string, value: unknown): void;
    readMemory(run: HarnessRun, namespace: Parameters<HarnessMemoryManager["read"]>[0], key: string): unknown;
    assertInvariants(run: HarnessRun): {
        violations: string[];
    };
    evaluateRun(run: HarnessRun): import("./evaluation/eval-run-service.js").HarnessEvaluationReport;
    createAsyncService(): AsyncHarnessService;
    persistRun(run: HarnessRun): import("./durable/durable-harness-service.js").DurableHarnessRecord;
    checkpointRun(run: HarnessRun): string;
    restoreRun(runId: string): HarnessRun | null;
    restoreFromCheckpoint(checkpointRef: string): HarnessRun | null;
    handleFailure(run: HarnessRun, failure: HarnessFailureType): HarnessRun;
    private appendTimelineEvent;
    decide(input: {
        evaluatorScore: number;
        requiresHuman?: boolean;
        maxIterationsReached?: boolean;
    }): HarnessDecision;
    runLoop(input: HarnessLoopInput): HarnessRun;
}
