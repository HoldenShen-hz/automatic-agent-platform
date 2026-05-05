import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
import {
  createBudgetLedger,
  createDecisionInputBundle as createCanonicalDecisionInputBundle,
  createHarnessDecision as createCanonicalHarnessDecision,
  type ArtifactRef,
  type DecisionInputBundle as CanonicalDecisionInputBundle,
  type HarnessDecision as CanonicalHarnessDecision,
  type HarnessRun as CanonicalHarnessRun,
  type HarnessRunStatus as CanonicalHarnessRunStatus,
  type PlanGraphBundle,
  type PolicyFinding,
  type RiskClass,
} from "../../../platform/contracts/executable-contracts/index.js";
import type { EvidenceRecord } from "../../../platform/contracts/types/platform-contracts.js";
import { createEvidenceRecord, createPlatformPrincipal } from "../../../platform/contracts/types/platform-contracts.js";
import type { RuntimeRepository } from "../../../platform/state-evidence/truth/runtime-truth-repository.js";
import { RuntimeStateMachine, RuntimeTransitionCommand } from "../../../platform/execution/runtime-state-machine.js";
import { AsyncHarnessService } from "./async-harness-service.js";
import { ContextAssembler, type HarnessContext, type HarnessContextSourceSet } from "./context-assembler.js";
import { DurableHarnessService } from "./durable/durable-harness-service.js";
import { GuardrailEngine, type GuardrailAssessment } from "./guardrails/guardrail-engine.js";
import {
  GuardrailVibrationBreaker,
  type GuardrailActionSignal,
  type GuardrailVibrationState,
  type GuardrailVibrationDecision,
} from "./guardrails/guardrail-vibration-breaker.js";
import { HitlRuntime, type HitlRequest, type HitlPersistenceStore, type InMemoryHitlStore } from "./hitl-runtime.js";
import { EvalRunService } from "./evaluation/eval-run-service.js";
import { HarnessMemoryManager } from "./memory-manager.js";
import { HarnessLoopController } from "./loop/index.js";
import { mapHarnessStepToOapeflirPhase, type OapeflirSemanticPhase } from "./oapeflir-harness-mapping.js";
import { RecoveryController, type HarnessFailureType } from "./recovery-controller.js";
import { ToolbeltAssembler, type HarnessToolbelt } from "./toolbelt-assembler.js";
import type { ControlPlaneDirectiveSink } from "../../../platform/five-plane-control-plane/control-plane-directive-sink.js";
import { createOperationalDirective } from "../../../platform/contracts/control-directive/index.js";

export * from "./harness-baseline.js";
export * from "./harness-bootstrap.js";
export * from "./async-harness-service.js";
export * from "./context-assembler.js";
export * from "./durable/durable-harness-service.js";
export * from "./durable/sleep-scheduler.js";
export * from "./evaluation/eval-run-service.js";
export * from "./evaluation/task-outcome-grader.js";
export * from "./guardrails/guardrail-engine.js";
export * from "./guardrails/guardrail-vibration-breaker.js";
export * from "./hitl-runtime.js";
export * from "./loop/index.js";
export * from "./memory-manager.js";
export * from "./oapeflir-harness-mapping.js";
export * from "./recovery-controller.js";
export * from "./toolbelt-assembler.js";

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

// R6-13: Re-export canonical HarnessRunStatus to consolidate to single interface
export type HarnessRunStatus = CanonicalHarnessRunStatus;

export interface ConstraintToolPolicy {
  readonly allowedTools: readonly string[];
}

export interface ConstraintRiskPolicy {
  readonly maxRiskScore: number;
  readonly escalationThreshold: number;
}

export interface ConstraintOutputPolicy {
  readonly requiredEvidence: readonly string[];
  readonly redactSensitiveData: boolean;
}

export interface ConstraintSandboxRequirement {
  readonly sandboxMode: "none" | "ephemeral" | "persistent" | "network_isolated";
  readonly timeoutMs: number;
  readonly allowedHosts?: readonly string[];
}

export interface ConstraintApprovalRequirement {
  readonly requiredForRiskClass: readonly ("low" | "medium" | "high" | "critical")[];
  readonly approverRoles: readonly string[];
  readonly escalationTimeoutMs: number;
}

export interface ConstraintBudgetEnvelope {
  readonly maxSteps: number;
  readonly maxCost: number;
  readonly maxDurationMs: number;
  readonly maxTokens?: number;
  /** @deprecated Use maxModelTokens/maxContextTokens/maxOutputTokens directly */
  readonly maxModelTokens?: number;
  readonly maxContextTokens?: number;
  readonly maxOutputTokens?: number;
}

export interface ConstraintPack {
  readonly policyIds: readonly string[];
  readonly approvalMode: "none" | "required" | "supervised";
  readonly autonomyMode: "suggestion" | "supervised" | "semi_auto" | "full_auto";
  readonly tool_policy: ConstraintToolPolicy;
  readonly risk_policy?: ConstraintRiskPolicy;
  readonly output_policy?: ConstraintOutputPolicy;
  readonly budgetEnvelope?: ConstraintBudgetEnvelope;
  // ADR-093 §v4.3: sandbox_requirement is required minimum field
  readonly sandboxRequirement: ConstraintSandboxRequirement;
  // ADR-093 §v4.3: approval_requirement is required minimum field
  readonly approvalRequirement: ConstraintApprovalRequirement;
  /** @deprecated Use budgetEnvelope or budget_envelope */
  readonly budget?: {
    readonly maxSteps: number;
    readonly maxCost: number;
    readonly maxDurationMs: number;
    readonly max_model_tokens?: number;
    readonly max_context_tokens?: number;
    readonly max_output_tokens?: number;
  };
}

export function getConstraintRiskPolicy(constraintPack: ConstraintPack): ConstraintRiskPolicy {
  const riskPolicy = constraintPack.risk_policy;
  if (riskPolicy == null) {
    throw new Error("harness.constraint_pack.missing_risk_policy");
  }
  return riskPolicy;
}

export function getConstraintOutputPolicy(constraintPack: ConstraintPack): ConstraintOutputPolicy {
  const outputPolicy = constraintPack.output_policy;
  if (outputPolicy == null) {
    throw new Error("harness.constraint_pack.missing_output_policy");
  }
  return outputPolicy;
}

export function normalizeConstraintPack(input: ConstraintPack): ConstraintPack {
  const riskPolicy = input.risk_policy;
  if (riskPolicy == null) {
    throw new Error("harness.constraint_pack.missing_risk_policy");
  }
  const outputPolicy = input.output_policy;
  if (outputPolicy == null) {
    throw new Error("harness.constraint_pack.missing_output_policy");
  }
  const budgetEnvelope = input.budgetEnvelope ?? input.budget;

  const partial: {
    policyIds: readonly string[];
    approvalMode: "none" | "required" | "supervised";
    autonomyMode: "suggestion" | "supervised" | "semi_auto" | "full_auto";
    tool_policy: { allowedTools: readonly string[] };
    risk_policy: { maxRiskScore: number; escalationThreshold: number };
    output_policy: { requiredEvidence: readonly string[]; redactSensitiveData: boolean };
    sandboxRequirement?: ConstraintSandboxRequirement;
    approvalRequirement?: ConstraintApprovalRequirement;
    budgetEnvelope?: ConstraintBudgetEnvelope;
    budget?: {
      maxSteps: number;
      maxCost: number;
      maxDurationMs: number;
      max_model_tokens?: number;
      max_context_tokens?: number;
      max_output_tokens?: number;
    };
  } = {
    policyIds: [...input.policyIds],
    approvalMode: input.approvalMode,
    autonomyMode: input.autonomyMode,
    tool_policy: {
      allowedTools: [...input.tool_policy.allowedTools],
    },
    risk_policy: {
      maxRiskScore: riskPolicy.maxRiskScore,
      escalationThreshold: riskPolicy.escalationThreshold,
    },
    output_policy: {
      requiredEvidence: [...outputPolicy.requiredEvidence],
      redactSensitiveData: outputPolicy.redactSensitiveData,
    },
  };

  const sandboxRequirement = input.sandboxRequirement;
  if (sandboxRequirement != null) {
    partial.sandboxRequirement = sandboxRequirement;
  }
  const approvalRequirement = input.approvalRequirement;
  if (approvalRequirement != null) {
    partial.approvalRequirement = approvalRequirement;
  }
  if (budgetEnvelope != null) {
    partial.budget = {
      maxSteps: budgetEnvelope.maxSteps,
      maxCost: budgetEnvelope.maxCost,
      maxDurationMs: budgetEnvelope.maxDurationMs,
    };
    if ("maxTokens" in budgetEnvelope && budgetEnvelope.maxTokens != null) {
      partial.budget.max_model_tokens = budgetEnvelope.maxTokens;
      partial.budget.max_context_tokens = budgetEnvelope.maxTokens;
      partial.budget.max_output_tokens = budgetEnvelope.maxTokens;
    }
    // R18-01 fix: Copy explicit token budget fields per §45.3
    if ("maxModelTokens" in budgetEnvelope && budgetEnvelope.maxModelTokens != null) {
      partial.budget.max_model_tokens = budgetEnvelope.maxModelTokens;
    }
    if ("maxContextTokens" in budgetEnvelope && budgetEnvelope.maxContextTokens != null) {
      partial.budget.max_context_tokens = budgetEnvelope.maxContextTokens;
    }
    if ("maxOutputTokens" in budgetEnvelope && budgetEnvelope.maxOutputTokens != null) {
      partial.budget.max_output_tokens = budgetEnvelope.maxOutputTokens;
    }
    partial.budgetEnvelope = {
      maxSteps: budgetEnvelope.maxSteps,
      maxCost: budgetEnvelope.maxCost,
      maxDurationMs: budgetEnvelope.maxDurationMs,
      ...("maxTokens" in budgetEnvelope && budgetEnvelope.maxTokens != null
        ? { maxTokens: budgetEnvelope.maxTokens }
        : {}),
      ...("maxModelTokens" in budgetEnvelope && budgetEnvelope.maxModelTokens != null
        ? { maxModelTokens: budgetEnvelope.maxModelTokens }
        : {}),
      ...("maxContextTokens" in budgetEnvelope && budgetEnvelope.maxContextTokens != null
        ? { maxContextTokens: budgetEnvelope.maxContextTokens }
        : {}),
      ...("maxOutputTokens" in budgetEnvelope && budgetEnvelope.maxOutputTokens != null
        ? { maxOutputTokens: budgetEnvelope.maxOutputTokens }
        : {}),
    };
  }

  return partial as ConstraintPack;
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

/**
 * FeedbackEnvelope - hierarchical signal structure per §45.6.
 * Four-level hierarchy: Step → Task → Workflow → System
 */
export interface FeedbackEnvelope {
  readonly feedbackId: string;
  /** Step-level signals: atomic feedback from single step execution */
  readonly stepSignals: readonly {
    readonly stepId: string;
    readonly role: HarnessRole;
    readonly signals: readonly string[];
    readonly timestamp: string;
  }[];
  /** Task-level signals: aggregated feedback for full task attempt */
  readonly taskSignals: readonly {
    readonly taskId: string;
    readonly iteration: number;
    readonly signals: readonly string[];
    readonly timestamp: string;
  }[];
  /** Workflow-level signals: cross-step coordination feedback */
  readonly workflowSignals: readonly {
    readonly phase: string;
    readonly signals: readonly string[];
    readonly timestamp: string;
  }[];
  /** System-level signals: global feedback affecting entire run */
  readonly systemSignals: readonly {
    readonly category: "budget" | "safety" | "policy" | "capacity";
    readonly signals: readonly string[];
    readonly timestamp: string;
  }[];
  /** Legacy flat signals array for backward compatibility */
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
  /** Current retry attempt number (0-indexed, so 0 = first attempt) */
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

/**
 * HarnessStep - semantic projection per §5.5.
 * Represents step progress as a semantic marker, not a canonical execution identifier.
 * @deprecated Per §5.5, stepId is legacy projection. Use nodeRunIds for canonical execution references.
 */
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

/**
 * @deprecated HarnessRun is deprecated per §5.5. Use CanonicalHarnessRun from executable-contracts.
 * This alias exists for internal runtime state management only.
 * Runtime execution uses NodeRun references, not embedded HarnessStep.
 */
export type HarnessRun = CanonicalHarnessRun;

/**
 * HarnessRunRuntimeState - internal runtime state for Harness execution.
 * Per §5.5, steps are semantic projections - use nodeRunIds for canonical execution references.
 * This type is NOT exported from the public API - only for internal harness implementation.
 */
export interface HarnessRunRuntimeState {
  readonly harnessRunId: string;
  readonly runId: string;
  readonly tenantId: string;
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
  /**
   * @deprecated HarnessStep is semantic projection per §5.5. Use nodeRunIds instead.
   * Kept for legacy adapter compatibility only.
   */
  readonly steps: readonly HarnessStep[];
  /** @deprecated Use nodeRunIds per §5.5 */
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

/**
 * Adapter: Convert internal HarnessRunRuntimeState to canonical HarnessRun.
 * This extracts only the canonical fields for external consumption.
 */
export function toCanonicalHarnessRun(state: HarnessRunRuntimeState): CanonicalHarnessRun {
  const base: CanonicalHarnessRun = {
    harnessRunId: state.harnessRunId,
    tenantId: state.tenantId,
    domainId: state.domainId,
    confirmedTaskSpecId: state.confirmedTaskSpecId,
    requestEnvelopeId: state.requestEnvelopeId,
    requestHash: state.requestHash,
    status: state.status,
    constraintPackRef: state.constraintPackRef,
    versionLockId: state.versionLockId,
    planGraphBundleId: state.planGraphBundle.planGraphBundleId,
    budgetLedgerId: state.budgetLedgerId,
    currentSeq: state.currentSeq,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    // R18-02 fix: Map traceId/riskLevel/ownership/auditRefs with defaults per §45.3
    traceId: state.traceId ?? `trace:${state.harnessRunId}`,
    riskLevel: (state.riskLevel as RiskClass) ?? "medium",
    ownership: state.ownership ?? { ownerId: state.tenantId, ownerType: "harness" },
    auditRefs: state.auditRefs ?? [],
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
  /** @deprecated compatibility alias; use decisionInputBundleId */
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
  /** @deprecated compatibility alias; use createdAt */
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

export class HarnessRuntimeService {
  private readonly toolbeltAssembler: ToolbeltAssembler;
  private readonly guardrailEngine: GuardrailEngine;
  private readonly vibrationBreaker: GuardrailVibrationBreaker;
  private readonly hitlRuntime: HitlRuntime;
  private readonly memoryManager: HarnessMemoryManager;
  private readonly evalRunService: EvalRunService;
  private readonly durableService: DurableHarnessService;
  private readonly contextAssembler: ContextAssembler;
  private readonly recoveryController: RecoveryController;
  private readonly stateMachine: RuntimeStateMachine;
  /** R4-35: RuntimeTruthRepository for persisting decisions as immutable EvidenceRecords */
  private readonly runtimeTruthRepository: RuntimeRepository | undefined;
  /** R4-47: Directive sink for emitting OperationalDirective during HITL pause/resume operations */
  private readonly directiveSink: ControlPlaneDirectiveSink | null;
  /** Vibration state per-run, maintained across runLoop iterations per §45.20 */
  private vibrationState: GuardrailVibrationState = {
    guardrailActionCount: 0,
    lastGuardrailSignature: null,
    guardrailCooldownUntilMs: null,
  };

  public constructor(
    options: {
      toolbeltAssembler?: ToolbeltAssembler;
      guardrailEngine?: GuardrailEngine;
      vibrationBreaker?: GuardrailVibrationBreaker;
      hitlRuntime?: HitlRuntime;
      memoryManager?: HarnessMemoryManager;
      evalRunService?: EvalRunService;
      durableService?: DurableHarnessService;
      contextAssembler?: ContextAssembler;
      /** R4-35: Optional RuntimeTruthRepository for persisting evidence records */
      runtimeTruthRepository?: RuntimeRepository;
      /** R4-47: Optional directive sink for emitting OperationalDirective during HITL operations */
      directiveSink?: ControlPlaneDirectiveSink | null;
    } = {},
  ) {
    this.toolbeltAssembler = options.toolbeltAssembler ?? new ToolbeltAssembler();
    this.guardrailEngine = options.guardrailEngine ?? new GuardrailEngine();
    // R18-05 fix: Initialize vibration breaker with defaults per §45.20
    // maxRepeatedActions=3 means allow up to 3 repeated guardrail actions before cooldown
    // cooldownMs=30000 means 30 second cooldown when vibration is detected
    this.vibrationBreaker = options.vibrationBreaker ?? new GuardrailVibrationBreaker(3, 30_000);
    this.hitlRuntime = options.hitlRuntime ?? new HitlRuntime();
    this.memoryManager = options.memoryManager ?? new HarnessMemoryManager();
    this.evalRunService = options.evalRunService ?? new EvalRunService();
    this.durableService = options.durableService ?? new DurableHarnessService();
    this.contextAssembler = options.contextAssembler ?? new ContextAssembler();
    this.stateMachine = new RuntimeStateMachine();
    this.runtimeTruthRepository = options.runtimeTruthRepository;
    this.directiveSink = options.directiveSink ?? null;
    this.recoveryController = new RecoveryController(this.durableService, this);
    // R18-05 fix: Reset vibration state for each new service instance
    this.vibrationState = {
      guardrailActionCount: 0,
      lastGuardrailSignature: null,
      guardrailCooldownUntilMs: null,
    };
  }

  public createRun(input: {
    taskId: string;
    domainId: string;
    constraintPack: ConstraintPack;
    planGraphBundle?: PlanGraphBundle;
  }): HarnessRunRuntimeState {
    const constraintPack = normalizeConstraintPack(input.constraintPack);
    const runId = newId("harness_run");
    const budgetEnvelope = constraintPack.budgetEnvelope;
    const budgetLedger = createBudgetLedger({
      tenantId: "tenant:local",
      harnessRunId: runId,
      currency: "USD",
      hardCap: budgetEnvelope?.maxCost ?? 100000,
    });
    const run: HarnessRunRuntimeState = {
      harnessRunId: runId,
      runId,
      tenantId: "tenant:local",
      confirmedTaskSpecId: `confirmed_task_spec:${input.taskId}`,
      requestEnvelopeId: `request_envelope:${input.taskId}`,
      requestHash: `request_hash:${input.taskId}`,
      constraintPackRef: `constraint_pack:${input.domainId}`,
      versionLockId: newId("run_version_lock"),
      budgetLedgerId: budgetLedger.budgetLedgerId,
      currentSeq: 0,
      taskId: input.taskId,
      domainId: input.domainId,
      constraintPack,
      planGraphBundle: input.planGraphBundle ?? createInitialPlanGraphBundle({
        runId,
        taskId: input.taskId,
        domainId: input.domainId,
        constraintPack,
      }),
      steps: [],
      nodeRunIds: [],
      maxIterations: budgetEnvelope?.maxSteps ?? 100,
      currentIteration: 0,
      status: "created",
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null,
      pauseReason: null,
      decision: null,
      contextSnapshots: [],
      sleepLease: null,
      recoveryCheckpoint: null,
      feedbackEnvelope: null,
      toolbelt: null,
      guardrailAssessment: null,
      hitlRequest: null,
      timeline: [],
      loopMetrics: {
        iterationCount: 0,
        replanCount: 0,
        totalCost: 0,
        durationMs: 0,
        maxIterations: budgetEnvelope?.maxSteps ?? 100,
        maxCost: budgetEnvelope?.maxCost ?? 100000,
        maxDurationMs: budgetEnvelope?.maxDurationMs ?? 3600000,
      },
    };
    return this.appendTimelineEvent(run, "run_created", {
      taskId: input.taskId,
      domainId: input.domainId,
    });
  }

  public appendStep(
    run: HarnessRunRuntimeState,
    input: {
      role: HarnessRole;
      stage: string;
      inputs: Readonly<Record<string, unknown>>;
      outputs: Readonly<Record<string, unknown>>;
      iteration?: number;
      nodeRunId?: string;
      rationale?: string;
      evidenceRefs?: readonly string[];
      toolCalls?: readonly Record<string, unknown>[];
      latency?: number;
      cost?: number;
      error?: string | null;
      nextAction?: string;
    },
  ): HarnessRunRuntimeState {
    const startedAt = nowIso();
    const completedAt = nowIso();
    const iteration = input.iteration ?? Math.max(run.currentIteration, 1);
    const step: HarnessStep = {
      stepId: newId("harness_step"),
      role: input.role,
      stage: input.stage,
      iteration,
      semanticPhase: mapHarnessStepToOapeflirPhase(input.role, input.stage),
      inputs: input.inputs,
      outputs: input.outputs,
      startedAt,
      completedAt,
      ...(input.nodeRunId != null ? { nodeRunRefs: [input.nodeRunId] as const } : {}),
      ...(input.rationale != null ? { rationale: input.rationale } : {}),
      ...(input.evidenceRefs != null ? { evidenceRefs: input.evidenceRefs } : {}),
      ...(input.toolCalls != null ? { toolCalls: input.toolCalls } : {}),
      ...(input.latency != null ? { latency: input.latency } : {}),
      ...(input.cost != null ? { cost: input.cost } : {}),
      ...(input.error != null ? { error: input.error } : {}),
      ...(input.nextAction != null ? { nextAction: input.nextAction } : {}),
    };
    return {
      ...run,
      steps: [...run.steps, step],
      nodeRunIds: input.nodeRunId != null ? [...run.nodeRunIds, input.nodeRunId] : run.nodeRunIds,
      currentIteration: Math.max(run.currentIteration, iteration),
      timeline: [
        ...run.timeline,
        {
          eventId: newId("timeline"),
          runId: run.runId,
          type: "step_completed",
          payload: { stepId: step.stepId, role: step.role, stage: step.stage, iteration, nodeRunId: input.nodeRunId },
          recordedAt: nowIso(),
        },
      ],
    };
  }

  public captureContextSnapshot(run: HarnessRunRuntimeState): ContextSnapshot {
    return {
      snapshotId: newId("ctx_snapshot"),
      runId: run.runId,
      domainId: run.domainId,
      iteration: run.currentIteration,
      stepCount: run.steps.length,
      lastDecisionId: run.decision?.decisionId ?? null,
      capturedAt: nowIso(),
    };
  }

  public assembleContext(sources: HarnessContextSourceSet, tokenBudget: number): HarnessContext {
    return this.contextAssembler.assemble(sources, tokenBudget);
  }

  public snapshotContext(run: HarnessRunRuntimeState, context: HarnessContext): ContextSnapshot {
    return this.contextAssembler.snapshot(run, context);
  }

  public sleep(run: HarnessRunRuntimeState, reason: string, resumeAt: string, retryAttempt = 0): HarnessRunRuntimeState {
    const paused = this.pauseRun(this.ensureRunning(run), "sleep");
    return {
      ...paused,
      pauseReason: "sleep",
      sleepLease: {
        leaseId: newId("sleep_lease"),
        runId: run.runId,
        reason,
        resumeAt,
        createdAt: nowIso(),
        retryAttempt,
      },
      timeline: [
        ...paused.timeline,
        {
          eventId: newId("timeline"),
          runId: run.runId,
          type: "sleep_started",
          payload: { reason, resumeAt },
          recordedAt: nowIso(),
        },
      ],
    };
  }

  public recover(run: HarnessRunRuntimeState): HarnessRunRuntimeState {
    const isTerminal = run.status === "completed" || run.status === "failed" || run.status === "aborted";
    // R1-1: Must route all status changes through state machine to maintain INV-RUNTIME-001
    const paused = isTerminal
      ? this.transitionRunStatus(run, "paused", "harness.recover_from_terminal")
      : this.pauseRun(this.ensureRunning(run), "recovery");
    return {
      ...paused,
      pauseReason: "recovery",
      recoveryCheckpoint: {
        checkpointId: newId("recovery_checkpoint"),
        runId: run.runId,
        lastCompletedStepId: run.steps.at(-1)?.stepId ?? null,
        statusBeforeRecovery: run.status,
        createdAt: nowIso(),
      },
      timeline: [
        ...paused.timeline,
        {
          eventId: newId("timeline"),
          runId: run.runId,
          type: "recovery_started",
          payload: { statusBeforeRecovery: run.status },
          recordedAt: nowIso(),
        },
      ],
    };
  }

  public resume(run: HarnessRunRuntimeState): HarnessRunRuntimeState {
    const resumed = run.status === "paused"
      ? this.transitionRunStatus(this.transitionRunStatus(run, "resuming", "harness.resume"), "running", "harness.resumed")
      : this.transitionRunStatus(this.ensureRunning(run), "running", "harness.resume_noop");
    return {
      ...resumed,
      pauseReason: null,
      sleepLease: null,
      recoveryCheckpoint: null,
    };
  }

  public openHitlReview(run: HarnessRunRuntimeState, reason: string, evidenceRefs: readonly string[]): HarnessRunRuntimeState {
    const paused = this.pauseRun(this.ensureRunning(run), "hitl");
    // R4-47: Emit pause OperationalDirective when HITL review is opened
    this.emitOperationalDirective("pause", "harness_runtime_service", `hitl_review:${reason}`, {
      harnessRunId: run.harnessRunId,
    });
    return {
      ...paused,
      pauseReason: "hitl",
      hitlRequest: this.hitlRuntime.open({
        runId: run.runId,
        domainId: run.domainId,
        reason,
        evidenceRefs,
      }),
      timeline: [
        ...paused.timeline,
        {
          eventId: newId("timeline"),
          runId: run.runId,
          type: "hitl_requested",
          payload: { reason, evidenceCount: evidenceRefs.length },
          recordedAt: nowIso(),
        },
      ],
    };
  }

  public resolveHitlReview(run: HarnessRunRuntimeState, resolution: "approved" | "rejected", actorId: string): HarnessRunRuntimeState {
    if (run.hitlRequest == null) {
      throw new Error(`harness.hitl.request_not_found_for_run:${run.runId}`);
    }
    this.hydrateHitlRuntime(run.hitlRequest);
    const resolved = this.hitlRuntime.resolve(run.hitlRequest.requestId, resolution, actorId);
    // R4-47: Emit resume OperationalDirective when HITL review is approved
    if (resolution === "approved") {
      this.emitOperationalDirective("resume", "harness_runtime_service", "hitl_review_resolved:approved", {
        harnessRunId: run.harnessRunId,
      });
    }
    const nextRun = resolution === "approved"
      ? this.transitionRunStatus(this.transitionRunStatus(run, "resuming", "harness.hitl_approved"), "running", "harness.hitl_resumed")
      : this.transitionRunStatus(run, "aborted", "harness.hitl_rejected");
    return {
      ...nextRun,
      pauseReason: resolution === "approved" ? null : run.pauseReason,
      completedAt: resolution === "approved" ? null : nowIso(),
      hitlRequest: resolved,
      timeline: [
        ...nextRun.timeline,
        {
          eventId: newId("timeline"),
          runId: run.runId,
          type: "hitl_resolved",
          payload: { resolution, actorId },
          recordedAt: nowIso(),
        },
      ],
    };
  }

  public listTimeline(run: HarnessRunRuntimeState): readonly HarnessTimelineEvent[] {
    return run.timeline;
  }

  public writeMemory(run: HarnessRunRuntimeState, namespace: Parameters<HarnessMemoryManager["write"]>[0], key: string, value: unknown): void {
    const scopeId = namespace === "run" ? run.runId : namespace === "domain" ? run.domainId : "global";
    this.memoryManager.write(namespace, scopeId, key, value);
  }

  public readMemory(run: HarnessRunRuntimeState, namespace: Parameters<HarnessMemoryManager["read"]>[0], key: string): unknown {
    const scopeId = namespace === "run" ? run.runId : namespace === "domain" ? run.domainId : "global";
    return this.memoryManager.read(namespace, scopeId, key);
  }

  public assertInvariants(run: HarnessRunRuntimeState): { violations: string[] } {
    const violations: string[] = [];
    const iterationCount = run.loopMetrics?.iterationCount ?? run.currentIteration;
    const replanCount = run.loopMetrics?.replanCount ?? 0;
    const totalCost = run.loopMetrics?.totalCost ?? 0;
    const durationMs = run.loopMetrics?.durationMs ?? 0;
    const abortedByGuard = run.status === "aborted"
      ? new Set(run.decision?.reasonCodes ?? [])
      : new Set<string>();

    // INV-1: Iteration budget must not be exceeded without guard abort
    if (iterationCount > run.maxIterations && !abortedByGuard.has("harness.guard.max_iterations_reached")) {
      violations.push("INV-1:harness.invariant.iteration_exceeds_budget");
    }

    // INV-2: Replan count should not exceed 3 without guard abort
    if (replanCount > 3 && !abortedByGuard.has("harness.guard.max_replans_reached")) {
      violations.push("INV-2:harness.invariant.replan_count_exceeds_budget");
    }

    // INV-3: Total cost must not exceed budget without guard abort
    const budget = run.constraintPack.budget;
    if (budget && totalCost > budget.maxCost && !abortedByGuard.has("harness.guard.max_cost_exceeded")) {
      violations.push("INV-3:harness.invariant.total_cost_exceeds_budget");
    }

    // INV-4: Duration must not exceed budget without guard abort
    if (budget && durationMs > budget.maxDurationMs && !abortedByGuard.has("harness.guard.max_duration_exceeded")) {
      violations.push("INV-4:harness.invariant.duration_exceeds_budget");
    }

    // INV-5: Terminal state (completed/aborted) must have completedAt set
    if ((run.status === "completed" || run.status === "aborted") && run.completedAt == null) {
      violations.push("INV-5:harness.invariant.final_state_requires_completed_at");
    }

    // INV-6: Paused state must have pauseReason set
    if (run.status === "paused" && run.pauseReason == null) {
      violations.push("INV-6:harness.invariant.paused_requires_wait_reason");
    }

    // INV-7: HITL pause requires hitlRequest
    if (run.status === "paused" && run.pauseReason === "hitl" && run.hitlRequest == null) {
      violations.push("INV-7:harness.invariant.waiting_hitl_requires_request");
    }

    // INV-8: Sleep pause requires sleepLease
    if (run.status === "paused" && run.pauseReason === "sleep" && run.sleepLease == null) {
      violations.push("INV-8:harness.invariant.sleeping_requires_sleep_lease");
    }

    // INV-9: Non-accept decision requires feedback envelope
    if (run.decision != null && run.decision.action !== "accept" && run.feedbackEnvelope == null) {
      violations.push("INV-9:harness.invariant.non_accept_decision_requires_feedback");
    }

    // INV-10: Terminal state must not have open execution blockers
    const hasOpenExecutionBlockers = run.status === "completed" || run.status === "aborted";
    if (hasOpenExecutionBlockers && (run.toolbelt?.blockedTools.length ?? 0) > 0) {
      violations.push("INV-10:harness.invariant.blocked_tool_requested");
    }
    if (
      hasOpenExecutionBlockers
      && run.guardrailAssessment?.findings.some((finding) => finding.code === "harness.guardrail.required_evidence_missing")
    ) {
      violations.push("INV-10:harness.invariant.required_evidence_missing");
    }
    if (
      hasOpenExecutionBlockers
      && run.guardrailAssessment?.findings.some((finding) => finding.code === "harness.guardrail.max_risk_exceeded")
    ) {
      violations.push("INV-10:harness.invariant.max_risk_exceeded");
    }

    // INV-10 extended: Toolbelt must have valid state
    if (run.toolbelt == null && run.status === "running") {
      violations.push("INV-10:harness.invariant.running_requires_toolbelt");
    }

    return { violations };
  }

  public evaluateRun(run: HarnessRunRuntimeState) {
    return this.evalRunService.evaluate(run);
  }

  public createAsyncService(): AsyncHarnessService {
    return new AsyncHarnessService(this);
  }

  public persistRun(run: HarnessRunRuntimeState) {
    this.ensureInvariantSafe(run);
    return this.durableService.persist(run);
  }

  public checkpointRun(run: HarnessRunRuntimeState): string {
    this.ensureInvariantSafe(run);
    return this.durableService.checkpoint(run);
  }

  public restoreRun(runId: string): HarnessRunRuntimeState | null {
    const run = this.durableService.restore(runId);
    if (run) {
      this.ensureInvariantSafe(run);
      this.hydrateHitlRuntime(run.hitlRequest);
    }
    return run;
  }

  public restoreFromCheckpoint(checkpointRef: string): HarnessRunRuntimeState | null {
    const run = this.durableService.restoreFromCheckpoint(checkpointRef);
    if (run) {
      this.ensureInvariantSafe(run);
      this.hydrateHitlRuntime(run.hitlRequest);
    }
    return run;
  }

  public handleFailure(run: HarnessRunRuntimeState, failure: HarnessFailureType): HarnessRunRuntimeState {
    return this.recoveryController.handleFailure(run, failure);
  }

  private hydrateHitlRuntime(request: HitlRequest | null): void {
    if (request == null || this.hitlRuntime.get(request.requestId) != null) {
      return;
    }
    this.hitlRuntime.hydrate(request);
  }

  private appendTimelineEvent(
    run: HarnessRunRuntimeState,
    type: HarnessTimelineEvent["type"],
    payload: Readonly<Record<string, unknown>>,
  ): HarnessRunRuntimeState {
    return {
      ...run,
      timeline: [
        ...run.timeline,
        {
          eventId: newId("timeline"),
          runId: run.runId,
          type,
          payload,
          recordedAt: nowIso(),
        },
      ],
    };
  }

  public decide(input: {
    evaluatorScore: number;
    requiresHuman?: boolean;
    maxIterationsReached?: boolean;
    riskScore?: number;
    guardrailSuggestedAction?: GuardrailAssessment["suggestedAction"];
    /** Deterministic: sideEffect mayCommit=false must abort regardless of evaluatorScore (§45.25) */
    sideEffectMayCommit?: boolean;
    /** Deterministic: HITL pending must escalate regardless of evaluatorScore (§45.25) */
    hitlPending?: boolean;
    /** Deterministic: budget exhausted must abort regardless of evaluatorScore (§45.25) */
    budgetExhausted?: boolean;
    /** Deterministic: guardrail abort signal must override evaluatorScore (§45.25) */
    guardrailAbort?: boolean;
    harnessRunId?: string;
    nodeRunId?: string;
    evidenceRefs?: readonly string[];
    sideEffectRefs?: readonly string[];
    deciderRef?: string;
  }): HarnessDecision {
    let action: HarnessDecisionAction = "accept";
    const reasonCodes: string[] = [];

    // §45.25 "LLM-as-Judge cannot override deterministic failure" - check all deterministic signals first
    if (input.guardrailAbort) {
      action = "abort";
      reasonCodes.push("harness.guardrail_deterministic_abort");
    } else if (input.sideEffectMayCommit === false) {
      action = "abort";
      reasonCodes.push("harness.side_effect_cannot_commit");
    } else if (input.budgetExhausted) {
      action = "abort";
      reasonCodes.push("harness.budget_exhausted");
    } else if (input.maxIterationsReached) {
      action = "abort";
      reasonCodes.push("harness.max_iterations_reached");
    } else if (input.hitlPending) {
      action = "escalate_to_human";
      reasonCodes.push("harness.hitl_pending");
    } else if (input.requiresHuman) {
      action = "escalate_to_human";
      reasonCodes.push("harness.human_required");
    } else if (input.riskScore !== undefined && input.riskScore > 0.8) {
      action = "downgrade_mode";
      reasonCodes.push("harness.risk_high_downgrade");
    } else if (input.guardrailSuggestedAction === "retry_same_plan") {
      action = "retry_same_plan";
      reasonCodes.push("harness.guardrail_retry_same_plan");
    } else if (input.evaluatorScore < 0.5) {
      action = "replan";
      reasonCodes.push("harness.eval_below_replan_threshold");
    } else if (input.evaluatorScore < 0.75) {
      action = "retry_same_plan";
      reasonCodes.push("harness.eval_below_accept_threshold");
    } else {
      reasonCodes.push("harness.accepted");
    }

    const decisionKind = this.mapDecisionKind(action);
    const decisionInputBundle = createCanonicalDecisionInputBundle({
      harnessRunId: input.harnessRunId ?? "harness_run:compat",
      ...(input.nodeRunId != null ? { nodeRunId: input.nodeRunId } : {}),
      decisionKind,
      riskClass: this.resolveRiskClass(input.riskScore),
      evidenceRefs: this.asArtifactRefs(input.evidenceRefs ?? []),
      sideEffectRefs: input.sideEffectRefs ?? [],
    });
    const harnessDecisionId = newId("harness_decision");
    const canonicalDecision = createCanonicalHarnessDecision({
      decisionInputBundleId: decisionInputBundle.decisionInputBundleId,
      decisionKind,
      decision: this.mapDecisionOutcome(action),
      deciderType: this.resolveDeciderType(action, input.requiresHuman === true, input.maxIterationsReached === true),
      deciderRef: input.deciderRef ?? "harness.runtime_service",
      reasonCode: reasonCodes[0] ?? "harness.accepted",
      harnessDecisionId,
    });

    // R4-35: Persist decision as immutable EvidenceRecord after creating canonicalDecision
    this.persistDecisionEvidence(canonicalDecision, decisionInputBundle, input);

    return {
      decisionId: canonicalDecision.harnessDecisionId,
      harnessDecisionId: canonicalDecision.harnessDecisionId,
      decisionInputBundleId: canonicalDecision.decisionInputBundleId,
      decisionKind: canonicalDecision.decisionKind,
      decision: canonicalDecision.decision,
      deciderType: canonicalDecision.deciderType,
      deciderRef: canonicalDecision.deciderRef,
      reasonCode: canonicalDecision.reasonCode,
      action,
      reasonCodes,
      confidence: Number(input.evaluatorScore.toFixed(4)),
      createdAt: canonicalDecision.createdAt,
    };
  }

  /**
   * R4-35: Persist a harness decision as an immutable EvidenceRecord.
   * This ensures decisions are auditable and can be replayed for debugging/certification.
   */
  private persistDecisionEvidence(
    decision: ReturnType<typeof createCanonicalHarnessDecision>,
    inputBundle: ReturnType<typeof createCanonicalDecisionInputBundle>,
    input: Parameters<typeof this.decide>[0],
  ): void {
    if (this.runtimeTruthRepository == null) {
      return; // Evidence persistence is optional - runtime functions without RTR
    }

    const principal = createPlatformPrincipal({
      actorId: decision.deciderRef,
      tenantId: input.harnessRunId != null && input.harnessRunId !== "harness_run:compat"
        ? `tenant:${input.harnessRunId.split(":")[0] ?? "local"}`
        : "tenant:local",
      roles: ["harness", "decider"],
    });

    const evidenceRecord = createEvidenceRecord({
      traceId: `trace:${input.harnessRunId ?? "harness_run:compat"}`,
      principal,
      category: "decision",
      targetRef: `harness_decision:${decision.harnessDecisionId}`,
      content: {
        decisionId: decision.harnessDecisionId,
        decisionInputBundleId: decision.decisionInputBundleId,
        decisionKind: decision.decisionKind,
        decision: decision.decision,
        deciderType: decision.deciderType,
        deciderRef: decision.deciderRef,
        reasonCode: decision.reasonCode,
        action: input.riskScore,
        evaluatorScore: input.evaluatorScore,
        riskScore: input.riskScore,
        requiresHuman: input.requiresHuman ?? false,
        maxIterationsReached: input.maxIterationsReached ?? false,
        hitlPending: input.hitlPending ?? false,
        guardrailAbort: input.guardrailAbort ?? false,
        sideEffectMayCommit: input.sideEffectMayCommit,
        budgetExhausted: input.budgetExhausted ?? false,
        guardrailSuggestedAction: input.guardrailSuggestedAction,
        reasonCodes: input.sideEffectRefs,
        evidenceRefs: input.evidenceRefs,
        sideEffectRefs: input.sideEffectRefs,
        nodeRunId: input.nodeRunId,
        createdAt: decision.createdAt,
      },
      metadata: {
        deciderType: decision.deciderType,
        decisionKind: decision.decisionKind,
        action: decision.decision,
      },
    });

    this.runtimeTruthRepository.appendEvidenceRecord(evidenceRecord);
  }

  public runLoop(input: HarnessLoopInput): HarnessRunRuntimeState {
    const loop = new HarnessLoopController(input.constraintPack, {}, {
      iteration: Math.max(0, (input.iteration ?? 1) - 1),
    });
    let run = this.createRun({
      taskId: input.taskId,
      domainId: input.domainId,
      constraintPack: input.constraintPack,
    });
    run = this.transitionRunStatus(run, "admitted", "harness.admitted");
    run = this.transitionRunStatus(run, "planning", "harness.planning_started");
    run = this.transitionRunStatus(run, "ready", "harness.plan_ready");
    run = this.transitionRunStatus(run, "running", "harness.execution_started");
    run = { ...run, currentIteration: input.iteration ?? 1 };

    while (true) {
      const iteration = (input.iteration ?? 1) + loop.getState().iteration;

      // §45.5 budget gate: check budget BEFORE each stage per spec
      // Budget gate check BEFORE planner stage (not after)
      const inputBudget = input.constraintPack.budget;
      if (inputBudget && run.steps.length >= inputBudget.maxSteps) {
        const guardAbortDecisionId = newId("harness_decision");
        return this.transitionRunStatus({
          ...run,
          decision: {
            decisionId: guardAbortDecisionId,
            harnessDecisionId: guardAbortDecisionId,
            decisionInputBundleId: newId("dib"),
            decisionKind: "abort",
            decision: "abort",
            deciderType: "system",
            deciderRef: "harness.loop_controller",
            reasonCode: "harness.guard.max_steps_exceeded",
            action: "abort",
            reasonCodes: ["harness.guard.max_steps_exceeded"],
            confidence: 0,
            createdAt: nowIso(),
          },
        }, "aborted", "harness.guard_aborted");
      }

      // Root cause §191-2235: Spec requires budget gate BEFORE each stage (planner/generator/evaluator).
      // Previously all three stages executed BEFORE any budget check, causing budget exhaustion during execution.
      // Fixed by moving budget check before planner stage above, and adding checks before generator/evaluator below.

      run = this.appendStep(run, {
        role: "planner",
        stage: "plan",
        inputs: { taskId: input.taskId, domainId: input.domainId },
        outputs: input.plannerOutput,
        iteration,
      });

      // Budget gate check before generator stage
      if (inputBudget && run.steps.length >= inputBudget.maxSteps) {
        const guardAbortDecisionId = newId("harness_decision");
        return this.transitionRunStatus({
          ...run,
          decision: {
            decisionId: guardAbortDecisionId,
            harnessDecisionId: guardAbortDecisionId,
            decisionInputBundleId: newId("dib"),
            decisionKind: "abort",
            decision: "abort",
            deciderType: "system",
            deciderRef: "harness.loop_controller",
            reasonCode: "harness.guard.max_steps_exceeded",
            action: "abort",
            reasonCodes: ["harness.guard.max_steps_exceeded"],
            confidence: 0,
            createdAt: nowIso(),
          },
        }, "aborted", "harness.guard_aborted");
      }

      run = this.appendStep(run, {
        role: "generator",
        stage: "execute",
        inputs: input.plannerOutput,
        outputs: input.generatorOutput,
        iteration,
      });

      // Budget gate check before evaluator stage
      if (inputBudget && run.steps.length >= inputBudget.maxSteps) {
        const guardAbortDecisionId = newId("harness_decision");
        return this.transitionRunStatus({
          ...run,
          decision: {
            decisionId: guardAbortDecisionId,
            harnessDecisionId: guardAbortDecisionId,
            decisionInputBundleId: newId("dib"),
            decisionKind: "abort",
            decision: "abort",
            deciderType: "system",
            deciderRef: "harness.loop_controller",
            reasonCode: "harness.guard.max_steps_exceeded",
            action: "abort",
            reasonCodes: ["harness.guard.max_steps_exceeded"],
            confidence: 0,
            createdAt: nowIso(),
          },
        }, "aborted", "harness.guard_aborted");
      }

      run = this.appendStep(run, {
        role: "evaluator",
        stage: "evaluate",
        inputs: input.generatorOutput,
        outputs: input.evaluatorOutput,
        iteration,
      });

      const outputPolicy = getConstraintOutputPolicy(input.constraintPack);
      const riskPolicy = getConstraintRiskPolicy(input.constraintPack);
      const toolbelt = this.toolbeltAssembler.assemble({
        allowedTools: input.constraintPack.tool_policy.allowedTools,
        requestedTools: [...(input.requestedTools ?? [])],
        requiredEvidence: outputPolicy.requiredEvidence,
      });
      const guardrailAssessment = this.guardrailEngine.assess({
        toolbelt,
        evidenceRefs: [...(input.producedEvidenceRefs ?? [])],
        riskScore: input.riskScore ?? Math.max(0, riskPolicy.escalationThreshold - 1),
        maxRiskScore: riskPolicy.maxRiskScore,
        escalationThreshold: riskPolicy.escalationThreshold,
        currentStepCount: run.steps.length,
        maxSteps: inputBudget?.maxSteps ?? 100,
        // R3-1 fix: Pass inputPrompt and memoryAccessPattern for Input/Memory guardrail checks
        ...(typeof input.generatorOutput?.input === "string" ? { inputPrompt: input.generatorOutput.input as string } : {}),
        ...(input.producedEvidenceRefs ? { memoryAccessPattern: input.producedEvidenceRefs } : {}),
      });
      this.memoryManager.write("run", run.runId, "last_guardrail_assessment", guardrailAssessment);
      this.memoryManager.write("domain", run.domainId, "last_evaluator_score", input.evaluatorScore);

      const lastNodeRunId = run.nodeRunIds.at(-1);
      // R18-03 fix: Pass all decision factors to decide() per §45.25
      const decision = this.decide({
        evaluatorScore: input.evaluatorScore,
        ...(input.requiresHuman || guardrailAssessment.requiresHuman ? { requiresHuman: true } : {}),
        ...(inputBudget && run.steps.length >= inputBudget.maxSteps ? { maxIterationsReached: true } : {}),
        ...(input.riskScore !== undefined ? { riskScore: input.riskScore } : {}),
        guardrailSuggestedAction: guardrailAssessment.suggestedAction,
        // R18-03 fix: Include all decision factors (policy/budget/risk/sideEffect/guardrail/HITL)
        guardrailAbort: guardrailAssessment.suggestedAction === "abort",
        hitlPending: run.hitlRequest?.status === "pending_approval",
        budgetExhausted: inputBudget != null && run.steps.length >= inputBudget.maxSteps,
        harnessRunId: run.harnessRunId,
        ...(lastNodeRunId !== undefined ? { nodeRunId: lastNodeRunId } : {}),
        ...(input.producedEvidenceRefs != null ? { evidenceRefs: input.producedEvidenceRefs } : {}),
        deciderRef: "harness.run_loop",
      });

      // R18-05 fix: Check for guardrail vibration (repeated same action) per §45.20
      // VibrationBreaker detects when the same guardrail action repeats too often,
      // indicating an oscillation loop that would cause infinite replanning.
      // Use guardrailSuggestedAction as the signature since that drives retry/replan.
      const vibrationSignal: GuardrailActionSignal = {
        runId: run.runId,
        signature: guardrailAssessment.suggestedAction,
        observedAtMs: Date.now(),
      };
      const vibrationDecision: GuardrailVibrationDecision = this.vibrationBreaker.evaluate(
        vibrationSignal,
        this.vibrationState,
      );
      this.vibrationState = vibrationDecision.state;

      // If vibration is in cooldown, escalate to human review to break the oscillation loop
      if (!vibrationDecision.allowed && guardrailAssessment.suggestedAction !== "proceed") {
        const escalated = this.openHitlReview(
          run,
          "guardrail_vibration_detected",
          [vibrationDecision.reasonCode, guardrailAssessment.suggestedAction],
        );
        this.durableService.persist(escalated);
        return escalated;
      }

      const contextSnapshot = this.captureContextSnapshot({
        ...run,
        decision,
      });

      let baseRun: HarnessRunRuntimeState = {
        ...run,
        toolbelt,
        guardrailAssessment,
        hitlRequest: null,
        pauseReason: null,
        completedAt: null,
        decision,
        contextSnapshots: [...run.contextSnapshots, contextSnapshot],
        feedbackEnvelope: {
          feedbackId: newId("feedback"),
          stepSignals: [],
          taskSignals: [],
          workflowSignals: [],
          systemSignals: [],
          signals: [
            ...(input.producedEvidenceRefs ?? []),
            ...decision.reasonCodes,
            ...guardrailAssessment.findings.map((finding) => finding.code),
          ],
          learnedActions: decision.action === "replan"
            ? ["update_plan_bundle"]
            : decision.action === "retry_same_plan"
              ? ["tighten_generator"]
              : [],
          createdAt: nowIso(),
        },
      };
      baseRun = this.appendTimelineEvent(baseRun, "guardrails_evaluated", {
        passed: guardrailAssessment.passed,
        requiresHuman: guardrailAssessment.requiresHuman,
        suggestedAction: guardrailAssessment.suggestedAction,
      });
      baseRun = this.appendTimelineEvent(baseRun, "decision_recorded", {
        action: decision.action,
        confidence: decision.confidence,
      });
      if (guardrailAssessment.suggestedAction === "abort" || decision.action === "abort") {
        baseRun = this.transitionRunStatus(baseRun, "aborted", "harness.loop_aborted");
        // R1-1 fix: terminalAt is set by RuntimeStateMachine.transition() on terminal transitions
      } else if (decision.action === "accept") {
        baseRun = this.transitionRunStatus(baseRun, "completed", "harness.loop_completed");
        // R1-1 fix: terminalAt is set by RuntimeStateMachine.transition() on terminal transitions
      } else if (decision.action === "replan") {
        baseRun = this.transitionRunStatus(baseRun, "replanning", "harness.loop_replanning");
        baseRun = this.transitionRunStatus(baseRun, "running", "harness.loop_replan_applied");
      }
      if (decision.action === "escalate_to_human" && guardrailAssessment.suggestedAction !== "abort") {
        baseRun = this.openHitlReview(
          baseRun,
          guardrailAssessment.requiresHuman
            ? "guardrail_or_operator_escalation"
            : decision.reasonCodes[0] ?? "harness.requires_human_review",
          input.producedEvidenceRefs ?? [],
        );
      }

      loop.recordIteration(this.estimateIterationCost(input));
      if (decision.action === "replan") {
        loop.recordReplan();
      }
      const loopState = loop.getState();
      const currentMetrics = {
        iterationCount: loopState.iteration,
        replanCount: loopState.replanCount,
        totalCost: loopState.totalCost,
        durationMs: Math.max(0, Date.now() - new Date(run.createdAt).getTime()),
        maxIterations: loop.getGuards().maxIterations,
        maxCost: loop.getGuards().maxCost,
        maxDurationMs: loop.getGuards().maxDurationMs,
      };
      const progress = loop.evaluateProgress(
        decision.action,
        (inputBudget && baseRun.steps.length + 3 <= inputBudget.maxSteps) ?? true,
      );
      const shouldStop = baseRun.status !== "running" || !progress.shouldContinue;

      if (shouldStop) {
        const guardAbortDecisionId = newId("harness_decision");
        let finalRun: HarnessRunRuntimeState = progress.violation !== null && baseRun.status === "running"
          ? {
              ...baseRun,
              loopMetrics: currentMetrics,
              decision: {
                decisionId: guardAbortDecisionId,
                harnessDecisionId: guardAbortDecisionId,
                decisionInputBundleId: newId("dib"),
                decisionKind: "abort",
                decision: "abort",
                deciderType: "system",
                deciderRef: "harness.loop_controller",
                reasonCode: progress.reasonCodes[0] ?? "harness.guard.max_iterations_reached",
                action: "abort" as const,
                reasonCodes: progress.reasonCodes,
                confidence: baseRun.decision?.confidence ?? 0,
                createdAt: nowIso(),
              },
              feedbackEnvelope: baseRun.feedbackEnvelope == null
                ? null
                : {
                    ...baseRun.feedbackEnvelope,
                    signals: [...baseRun.feedbackEnvelope.signals, ...progress.reasonCodes],
                },
            }
          : {
              ...baseRun,
              loopMetrics: currentMetrics,
            };
        if (progress.violation !== null && baseRun.status === "running") {
          finalRun = this.transitionRunStatus(finalRun, "aborted", "harness.guard_aborted");
          // R1-1 fix: terminalAt is set by RuntimeStateMachine.transition() on terminal transitions
        }

        this.ensureInvariantSafe(finalRun);

        if (finalRun.status === "paused" && finalRun.pauseReason === "hitl" && finalRun.hitlRequest == null) {
          const withHitl = this.openHitlReview(
            finalRun,
            "guardrail_or_operator_escalation",
            [...(input.producedEvidenceRefs ?? []), ...guardrailAssessment.findings.map((finding) => finding.code)],
          );
          this.durableService.persist(withHitl);
          return withHitl;
        }

        this.durableService.persist(finalRun);
        return finalRun;
      }

      run = {
        ...baseRun,
        loopMetrics: currentMetrics,
        completedAt: null,
      };
    }
  }

  private ensureRunning(run: HarnessRunRuntimeState): HarnessRunRuntimeState {
    if (run.status === "running") {
      return run;
    }
    let current = run;
    if (current.status === "created") {
      current = this.transitionRunStatus(current, "admitted", "harness.auto_admitted");
    }
    if (current.status === "admitted") {
      current = this.transitionRunStatus(current, "ready", "harness.auto_ready");
    }
    if (current.status === "planning") {
      current = this.transitionRunStatus(current, "ready", "harness.auto_ready_from_planning");
    }
    if (current.status === "ready") {
      current = this.transitionRunStatus(current, "running", "harness.auto_running");
    }
    if (current.status === "paused") {
      current = this.transitionRunStatus(this.transitionRunStatus(current, "resuming", "harness.auto_resuming"), "running", "harness.auto_running");
    }
    return current;
  }

  private pauseRun(run: HarnessRunRuntimeState, reason: HarnessRunRuntimeState["pauseReason"]): HarnessRunRuntimeState {
    const pausing = run.status === "running"
      ? this.transitionRunStatus(run, "pausing", `harness.pause.${reason ?? "generic"}`)
      : run;
    const paused = pausing.status === "pausing"
      ? this.transitionRunStatus(pausing, "paused", `harness.paused.${reason ?? "generic"}`)
      : pausing;
    return {
      ...paused,
      pauseReason: reason,
    };
  }

  private transitionRunStatus(
    run: HarnessRunRuntimeState,
    toStatus: CanonicalHarnessRunStatus,
    reasonCode: string,
  ): HarnessRunRuntimeState {
    if (run.status === toStatus) {
      return run;
    }
    const baseAggregate: CanonicalHarnessRun = {
      harnessRunId: run.harnessRunId ?? run.runId,
      tenantId: run.tenantId ?? "tenant:local",
      domainId: run.domainId,
      confirmedTaskSpecId: run.confirmedTaskSpecId ?? `confirmed_task_spec:${run.taskId}`,
      requestEnvelopeId: run.requestEnvelopeId ?? `request_envelope:${run.taskId}`,
      requestHash: run.requestHash ?? `request_hash:${run.taskId}`,
      status: run.status,
      constraintPackRef: run.constraintPackRef ?? `constraint_pack:${run.domainId}`,
      versionLockId: run.versionLockId ?? `${run.runId}:version_lock`,
      planGraphBundleId: run.planGraphBundle?.planGraphBundleId ?? `${run.runId}:compat_plan_graph_bundle`,
      budgetLedgerId: run.budgetLedgerId ?? `${run.runId}:compat_budget_ledger`,
      currentSeq: run.currentSeq ?? 0,
      createdAt: run.createdAt,
      updatedAt: run.updatedAt ?? run.createdAt,
      // R18-02 fix: Map traceId/riskLevel/ownership/auditRefs with defaults per §45.3
      traceId: run.traceId ?? `trace:${run.harnessRunId ?? run.runId}`,
      riskLevel: (run.riskLevel as RiskClass) ?? "medium",
      ownership: run.ownership ?? { ownerId: run.tenantId, ownerType: "harness" },
      auditRefs: run.auditRefs ?? [],
    };
    if (run.completedAt != null) {
      (baseAggregate as { terminalAt?: string }).terminalAt = run.completedAt;
    }
    const transitionParams: {
      aggregateType: "HarnessRun";
      aggregate: CanonicalHarnessRun;
      fromStatus: typeof run.status;
      toStatus: typeof toStatus;
      expectedSeq: number;
      tenantId: string;
      traceId: string;
      reasonCode: string;
      emittedBy: string;
      auditRef: string;
      runVersionLockId?: string;
      policyGuard?: { allowed: true; policyProofRef: string };
      budgetPrecondition?: { reservationId: string; hardCapSatisfied: true };
    } = {
      aggregateType: "HarnessRun",
      aggregate: baseAggregate,
      fromStatus: run.status,
      toStatus,
      expectedSeq: run.currentSeq ?? 0,
      tenantId: run.tenantId ?? "tenant:local",
      traceId: `trace:${run.harnessRunId ?? run.runId}`,
      reasonCode,
      emittedBy: "harness-runtime-service",
      auditRef: `audit://harness-runs/${run.harnessRunId ?? run.runId}/${reasonCode}`,
    };
    if (toStatus === "admitted") {
      transitionParams.runVersionLockId = run.versionLockId ?? `${run.runId}:version_lock`;
      transitionParams.policyGuard = {
        allowed: true,
        policyProofRef: run.constraintPackRef ?? `constraint_pack:${run.domainId}`,
      };
      transitionParams.budgetPrecondition = {
        reservationId: run.budgetLedgerId ?? `${run.runId}:compat_budget_ledger`,
        hardCapSatisfied: true,
      };
    }
    const transitioned = this.stateMachine.transition(transitionParams as unknown as RuntimeTransitionCommand<HarnessRun>);

    return {
      ...run,
      status: transitioned.aggregate.status,
      currentSeq: transitioned.aggregate.currentSeq,
      updatedAt: transitioned.aggregate.updatedAt,
      completedAt: transitioned.aggregate.terminalAt ?? run.completedAt,
    };
  }

  private ensureInvariantSafe(run: HarnessRunRuntimeState): void {
    const result = this.assertInvariants(run);
    if (result.violations.length > 0) {
      throw new Error(`harness.invariant_violation:${result.violations.join(",")}`);
    }
  }

  private estimateIterationCost(input: HarnessLoopInput): number {
    const extract = (value: unknown): number => {
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
      if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        return extract(record["costUsd"] ?? record["estimatedCostUsd"] ?? record["totalCostUsd"] ?? record["usage"]);
      }
      return 0;
    };

    return Number((extract(input.plannerOutput) + extract(input.generatorOutput) + extract(input.evaluatorOutput)).toFixed(6));
  }

  private mapDecisionKind(action: HarnessDecisionAction): CanonicalDecisionInputBundle["decisionKind"] {
    switch (action) {
      case "accept":
        return "approve";
      case "retry_same_plan":
        return "retry";
      case "replan":
        return "replan";
      case "escalate_to_human":
        return "takeover";
      case "abort":
      case "quarantine":
      case "revoke_approval":
        return "abort";
      case "pause_for_external":
        return "resume";
      case "downgrade_mode":
      case "require_revalidation":
      default:
        return "patch";
    }
  }

  private mapDecisionOutcome(action: HarnessDecisionAction): CanonicalHarnessDecision["decision"] {
    switch (action) {
      case "accept":
        return "accept";
      case "retry_same_plan":
        return "retry";
      case "replan":
        return "replan";
      case "escalate_to_human":
        return "escalate";
      case "abort":
        return "abort";
      case "quarantine":
      case "revoke_approval":
        return "reject";
      case "pause_for_external":
        return "takeover";
      case "downgrade_mode":
      case "require_revalidation":
      default:
        return "patch";
    }
  }

  private resolveDeciderType(
    action: HarnessDecisionAction,
    requiresHuman: boolean,
    maxIterationsReached: boolean,
  ): CanonicalHarnessDecision["deciderType"] {
    if (action === "escalate_to_human") {
      return "policy";
    }
    if (requiresHuman || maxIterationsReached || action === "abort") {
      return "system";
    }
    return "evaluator";
  }

  private resolveRiskClass(riskScore: number | undefined): RiskClass {
    if (riskScore == null) {
      return "medium";
    }
    const normalized = riskScore <= 1 ? riskScore * 100 : riskScore;
    if (normalized >= 85) {
      return "critical";
    }
    if (normalized >= 60) {
      return "high";
    }
    if (normalized >= 30) {
      return "medium";
    }
    return "low";
  }

  private asArtifactRefs(refs: readonly string[]): ArtifactRef[] {
    return refs.map((ref) => ({
      artifactId: ref,
      uri: `memory://${ref}`,
    }));
  }

  /**
   * R4-47: Emit an OperationalDirective for pause/resume operations.
   * Used by HITL and other pause/resume flows to notify downstream P3/P4 consumers.
   */
  private emitOperationalDirective(
    type: "pause" | "resume",
    principalId: string,
    reason: string,
    scope: { harnessRunId?: string },
  ): void {
    if (this.directiveSink == null) {
      return;
    }
    this.directiveSink.emitOperationalDirective(
      createOperationalDirective({
        type,
        scope: {
          ...(scope.harnessRunId != null ? { harnessRunId: scope.harnessRunId } : {}),
        },
        issuedBy: {
          principalId,
          tenantId: "tenant:local",
          roles: ["harness_runtime_service"],
        },
        reason,
      }),
    );
  }
}

function createInitialPlanGraphBundle(input: {
  readonly runId: string;
  readonly taskId: string;
  readonly domainId: string;
  readonly constraintPack: ConstraintPack;
}): PlanGraphBundle {
  const createdAt = nowIso();
  const plannerNodeId = newId("plan_node");
  const generatorNodeId = newId("plan_node");
  const evaluatorNodeId = newId("plan_node");
  const graphId = newId("graph");
  const graphHash = [
    input.taskId,
    input.domainId,
    plannerNodeId,
    generatorNodeId,
    evaluatorNodeId,
  ].join(":");
  const budgetEnvelope = input.constraintPack.budgetEnvelope ?? input.constraintPack.budget ?? {
    maxSteps: 100,
    maxCost: 100000,
    maxDurationMs: 3600000,
  };

  return {
    planGraphBundleId: newId("plan_graph_bundle"),
    harnessRunId: input.runId,
    graphVersion: 1,
    graph: {
      graphId,
      nodes: [
        {
          nodeId: plannerNodeId,
          nodeType: "llm",
          inputRefs: [`task:${input.taskId}`],
          outputSchemaRef: "schema:harness.plan",
          riskClass: "medium",
          budgetIntent: {
            amount: Math.max(1, budgetEnvelope.maxCost / 3),
            currency: "USD",
            resourceKinds: ["compute"],
          },
          sideEffectProfile: {
            mayCommitExternalEffect: false,
            reversible: true,
          },
          retryPolicyRef: "retry:harness.default",
          timeoutMs: budgetEnvelope.maxDurationMs,
        },
        {
          nodeId: generatorNodeId,
          nodeType: "tool",
          inputRefs: [plannerNodeId],
          outputSchemaRef: "schema:harness.work_product",
          riskClass: "medium",
          budgetIntent: {
            amount: Math.max(1, budgetEnvelope.maxCost / 3),
            currency: "USD",
            resourceKinds: ["compute"],
          },
          sideEffectProfile: {
            mayCommitExternalEffect: input.constraintPack.tool_policy.allowedTools.length > 0,
            reversible: true,
          },
          retryPolicyRef: "retry:harness.default",
          timeoutMs: budgetEnvelope.maxDurationMs,
        },
        {
          nodeId: evaluatorNodeId,
          nodeType: "evaluator",
          inputRefs: [generatorNodeId],
          outputSchemaRef: "schema:harness.evaluation",
          riskClass: "medium",
          budgetIntent: {
            amount: Math.max(1, budgetEnvelope.maxCost / 3),
            currency: "USD",
            resourceKinds: ["compute"],
          },
          sideEffectProfile: {
            mayCommitExternalEffect: false,
            reversible: true,
          },
          retryPolicyRef: "retry:harness.default",
          timeoutMs: budgetEnvelope.maxDurationMs,
        },
      ],
      edges: [
        {
          edgeId: newId("plan_edge"),
          fromNodeId: plannerNodeId,
          toNodeId: generatorNodeId,
          condition: { type: "always" },
          dependencyType: "hard",
        },
        {
          edgeId: newId("plan_edge"),
          fromNodeId: generatorNodeId,
          toNodeId: evaluatorNodeId,
          condition: { type: "always" },
          dependencyType: "hard",
        },
      ],
      entryNodeIds: [plannerNodeId],
      terminalNodeIds: [evaluatorNodeId],
      joinStrategy: "all",
      graphHash,
    },
    schedulerPolicy: {
      policyId: "scheduler:harness.deterministic_fifo",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: "budget:harness.initial",
    riskProfile: {
      riskClass: "medium",
      reasons: ["harness.initial_plan_graph_bundle"],
    },
    validationReport: {
      valid: true,
      findings: [],
      normalizedNodeIds: [plannerNodeId, generatorNodeId, evaluatorNodeId],
    },
    artifactRefs: [],
    createdAt,
  };
}
