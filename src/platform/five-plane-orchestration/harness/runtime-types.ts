import type {
  ArtifactRef,
  DecisionInputBundle as CanonicalDecisionInputBundle,
  HarnessDecision as CanonicalHarnessDecision,
  HarnessRun as CanonicalHarnessRun,
  HarnessRunStatus as CanonicalHarnessRunStatus,
  PlanGraphBundle,
  PolicyFinding,
  RiskClass,
} from "../../../platform/contracts/executable-contracts/index.js";
import type { ConstraintPack } from "./constraint-pack.js";
import type { GuardrailAssessment } from "./guardrails/guardrail-engine.js";
import type { HitlRequest } from "./hitl-runtime.js";
import type { OapeflirSemanticPhase } from "./oapeflir-harness-mapping.js";
import type { HarnessToolbelt } from "./toolbelt-assembler.js";

export type HarnessRole = "planner" | "generator" | "evaluator" | "hitl_operator" | "loop_controller" | "learner" | "release_manager";
export type HarnessDecisionAction =
  | "accept"
  | "retry_same_plan"
  | "replan"
  | "escalate_to_human"
  | "downgrade_mode"
  | "abort"
  | "quarantine"
  | "revoke_approval"
  | "pause_for_external"
  | "require_revalidation";

export type HarnessRunStatus = CanonicalHarnessRunStatus;

export function ensureIsoAfter(startedAt: string, candidate: string): string {
  if (candidate > startedAt) {
    return candidate;
  }
  return new Date(Date.parse(startedAt) + 1).toISOString();
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
  readonly stepSignals: readonly {
    readonly stepId: string;
    readonly role: HarnessRole;
    readonly signals: readonly string[];
    readonly timestamp: string;
  }[];
  readonly taskSignals: readonly {
    readonly taskId: string;
    readonly iteration: number;
    readonly signals: readonly string[];
    readonly timestamp: string;
  }[];
  readonly workflowSignals: readonly {
    readonly phase: string;
    readonly signals: readonly string[];
    readonly timestamp: string;
  }[];
  readonly systemSignals: readonly {
    readonly category: "budget" | "safety" | "policy" | "capacity";
    readonly signals: readonly string[];
    readonly timestamp: string;
  }[];
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
  readonly retryAttempt: number;
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
  readonly type:
    | "run_created"
    | "step_completed"
    | "guardrails_evaluated"
    | "decision_recorded"
    | "sleep_started"
    | "recovery_started"
    | "hitl_requested"
    | "hitl_resolved";
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
  readonly nodeRunRefs?: readonly string[];
  readonly rationale?: string;
  readonly evidenceRefs?: readonly string[];
  readonly toolCalls?: readonly Record<string, unknown>[];
  readonly latency?: number;
  readonly cost?: number;
  readonly error?: string | null;
  readonly nextAction?: string | null;
}

export interface HarnessDecision {
  readonly decisionId: string;
  readonly harnessDecisionId?: string;
  readonly decisionInputBundleId?: string;
  readonly decisionKind?: CanonicalDecisionInputBundle["decisionKind"];
  readonly decision?: CanonicalHarnessDecision["decision"];
  readonly deciderType?: CanonicalHarnessDecision["deciderType"];
  readonly deciderRef?: string;
  readonly reasonCode?: string;
  readonly action: HarnessDecisionAction;
  readonly reasonCodes: readonly string[];
  readonly confidence: number;
  readonly createdAt: string;
}

export type HarnessRun = CanonicalHarnessRun;

export interface HarnessRunRuntimeState {
  readonly harnessRunId: string;
  readonly runId: string;
  readonly tenantId: string;
  readonly leaseId?: string;
  readonly fencingToken?: string;
  readonly goal?: string;
  readonly mode?: string;
  readonly riskLevel?: string;
  readonly ownership?: Readonly<{ ownerId: string; ownerType: string }>;
  readonly auditRefs?: readonly string[];
  readonly traceId?: string;
  readonly confirmedTaskSpecId: string;
  readonly requestEnvelopeId: string;
  readonly requestHash: string;
  readonly constraintPackRef: string;
  readonly versionLockId: string;
  readonly budgetLedgerId: string;
  readonly currentSeq: number;
  readonly taskId: string;
  readonly domainId: string;
  readonly constraintPack: ConstraintPack;
  readonly planGraphBundle: PlanGraphBundle;
  readonly steps: readonly HarnessStep[];
  readonly nodeRunIds: readonly string[];
  readonly maxIterations: number;
  readonly currentIteration: number;
  readonly status: CanonicalHarnessRunStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt: string | null;
  readonly pauseReason: "sleep" | "hitl" | "recovery" | null;
  readonly decision: HarnessDecision | null;
  readonly contextSnapshots: readonly ContextSnapshot[];
  readonly sleepLease: WorkflowSleepLease | null;
  readonly recoveryCheckpoint: RecoveryCheckpoint | null;
  readonly feedbackEnvelope: FeedbackEnvelope | null;
  readonly toolbelt: HarnessToolbelt | null;
  readonly sandboxLayer?: HarnessToolbelt["sandboxLayer"];
  readonly guardrailAssessment: GuardrailAssessment | null;
  readonly hitlRequest: HitlRequest | null;
  readonly timeline: readonly HarnessTimelineEvent[];
  readonly loopMetrics?: {
    readonly iterationCount: number;
    readonly replanCount: number;
    readonly totalCost: number;
    readonly durationMs: number;
    readonly maxIterations: number;
    readonly maxCost: number;
    readonly maxDurationMs: number;
  };
}

export function toCanonicalHarnessRun(state: HarnessRunRuntimeState): CanonicalHarnessRun {
  const riskLevel = (state.riskLevel as RiskClass) ?? "medium";
  const base = {
    harnessRunId: state.harnessRunId,
    runId: state.runId,
    tenantId: state.tenantId,
    orgId: state.tenantId,
    domainId: state.domainId,
    taskId: state.taskId,
    confirmedTaskSpecId: state.confirmedTaskSpecId,
    requestEnvelopeId: state.requestEnvelopeId,
    requestHash: state.requestHash,
    status: state.status,
    constraintPack: state.constraintPack,
    constraintPackRef: state.constraintPackRef,
    versionLockId: state.versionLockId,
    planGraphBundleId: state.planGraphBundle.planGraphBundleId,
    budgetLedgerId: state.budgetLedgerId,
    currentSeq: state.currentSeq,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    traceId: state.traceId ?? `trace:${state.harnessRunId}`,
    riskLevel,
    riskProfile: { riskClass: riskLevel, reasons: [`risk_level:${riskLevel}`] },
    ownership: state.ownership ?? { ownerId: state.tenantId, ownerType: "harness" },
    auditRefs: state.auditRefs ?? [],
    auditTrail: { auditRefs: state.auditRefs ?? [], evidenceRefs: [] },
    budgetEnvelope: { budgetLedgerId: state.budgetLedgerId, currency: "credits" },
    ...(state.leaseId != null ? { leaseId: state.leaseId } : {}),
    fencingToken: state.fencingToken ?? `fence:${state.harnessRunId}:${state.currentSeq}`,
  } as CanonicalHarnessRun & {
    readonly runId: string;
    readonly taskId: string;
    readonly constraintPack: ConstraintPack;
  };
  if (state.completedAt != null) {
    return { ...base, terminalAt: state.completedAt };
  }
  return base;
}

export interface PromptExecutionRecord {
  readonly recordId: string;
  readonly promptVersion: string;
  readonly modelRoute: string;
  readonly inputHash: string;
  readonly outputHash: string;
  readonly contextSnapshotRef: string;
  readonly guardrailResult: GuardrailAssessment | null;
  readonly usage: Readonly<{
    readonly inputTokens: number;
    readonly outputTokens: number;
    readonly totalTokens: number;
    readonly costUsd: number;
  }>;
  readonly executedAt: string;
}

export interface DecisionInputBundle {
  readonly decisionInputBundleId: string;
  readonly harnessRunId: string;
  readonly nodeRunId?: string;
  readonly decisionKind: CanonicalDecisionInputBundle["decisionKind"];
  readonly riskClass: RiskClass;
  readonly contextRefs: readonly ArtifactRef[];
  readonly evidenceRefs: readonly ArtifactRef[];
  readonly policyFindings: readonly PolicyFinding[];
  readonly budgetSnapshotRef?: ArtifactRef;
  readonly sideEffectRefs: readonly string[];
  readonly bundleId: string;
  readonly evaluator: Readonly<{
    readonly score: number;
    readonly reasoning: string;
  }>;
  readonly policy: Readonly<{
    readonly policyIds: readonly string[];
    readonly constraintPackRef: string;
  }>;
  readonly budget: Readonly<{
    readonly remainingSteps: number;
    readonly remainingCost: number;
    readonly remainingDurationMs: number;
  }>;
  readonly risk: Readonly<{
    readonly currentScore: number;
    readonly maxScore: number;
    readonly escalationThreshold: number;
  }>;
  readonly node: Readonly<{
    readonly nodeId: string;
    readonly nodeType: string;
    readonly status: string;
  }>;
  readonly sideEffect: Readonly<{
    readonly mayCommit: boolean;
    readonly reversible: boolean;
  }>;
  readonly hitl: Readonly<{
    readonly pending: boolean;
    readonly requestId: string | null;
  }>;
  readonly guardrail: GuardrailAssessment | null;
  readonly capturedAt: string;
  readonly createdAt: string;
}

export interface TaintPolicy {
  readonly blockedPatterns: readonly string[];
  readonly requireSanitization: boolean;
}

export interface RankingPolicy {
  readonly relevanceWeight: number;
  readonly freshnessWeight: number;
  readonly trustWeight: number;
  readonly recencyBias: number;
}

export interface RedactionPolicy {
  readonly redactPatterns: readonly string[];
  readonly replacementMask: string;
  readonly preserveLength: boolean;
}

export interface ContextAssemblyContract {
  readonly contractId: string;
  readonly role: HarnessRole;
  readonly taintPolicy: TaintPolicy;
  readonly rankingPolicy: RankingPolicy;
  readonly redactionPolicy: RedactionPolicy;
  readonly maxTokenBudget: number;
  readonly enforcedAt: string;
}

export const DEFAULT_TAINT_POLICY: TaintPolicy = {
  blockedPatterns: ["__import__", "<script", "javascript:", "data:text/html", "${", "expr:"],
  requireSanitization: true,
};

export const DEFAULT_RANKING_POLICY: RankingPolicy = {
  relevanceWeight: 0.5,
  freshnessWeight: 0.3,
  trustWeight: 0.2,
  recencyBias: 0.1,
};

export const DEFAULT_REDACTION_POLICY: RedactionPolicy = {
  redactPatterns: ["password", "secret", "api_key", "token", "credential"],
  replacementMask: "***REDACTED***",
  preserveLength: false,
};

export interface HarnessLoopInput {
  readonly taskId: string;
  readonly domainId: string;
  readonly constraintPack: ConstraintPack;
  readonly plannerOutput?: Readonly<Record<string, unknown>>;
  readonly generatorOutput?: Readonly<Record<string, unknown>>;
  readonly evaluatorOutput?: Readonly<Record<string, unknown>>;
  readonly evaluatorScore?: number;
  readonly riskScore?: number;
  readonly requestedTools?: readonly string[];
  readonly producedEvidenceRefs?: readonly string[];
  readonly requiresHuman?: boolean;
  readonly iteration?: number;
  readonly loopServices?: HarnessLoopServices;
}

export interface HarnessLoopPlannerInput {
  readonly taskId: string;
  readonly domainId: string;
  readonly constraintPack: ConstraintPack;
  readonly iteration: number;
  readonly previousPlannerOutput: Readonly<Record<string, unknown>> | null;
}

export interface HarnessLoopGeneratorInput {
  readonly taskId: string;
  readonly domainId: string;
  readonly constraintPack: ConstraintPack;
  readonly iteration: number;
  readonly plannerOutput: Readonly<Record<string, unknown>>;
}

export interface HarnessLoopEvaluatorInput {
  readonly taskId: string;
  readonly domainId: string;
  readonly constraintPack: ConstraintPack;
  readonly iteration: number;
  readonly generatorOutput: Readonly<Record<string, unknown>>;
}

export interface HarnessLoopServices {
  readonly plan: (input: HarnessLoopPlannerInput) => Readonly<Record<string, unknown>>;
  readonly generate: (input: HarnessLoopGeneratorInput) => Readonly<Record<string, unknown>>;
  readonly evaluate: (input: HarnessLoopEvaluatorInput) => Readonly<Record<string, unknown>>;
}
