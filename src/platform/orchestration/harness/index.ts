import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
import { AsyncHarnessService } from "./async-harness-service.js";
import { ContextAssembler, type HarnessContext, type HarnessContextSourceSet } from "./context-assembler.js";
import { DurableHarnessService } from "./durable/durable-harness-service.js";
import { GuardrailEngine, type GuardrailAssessment } from "./guardrails/guardrail-engine.js";
import { HitlRuntime, type HitlRequest } from "./hitl-runtime.js";
import { EvalRunService } from "./evaluation/eval-run-service.js";
import { HarnessMemoryManager } from "./memory-manager.js";
import { HarnessLoopController } from "./loop/index.js";
import { mapHarnessStepToOapeflirPhase, type OapeflirSemanticPhase } from "./oapeflir-harness-mapping.js";
import { RecoveryController, type HarnessFailureType } from "./recovery-controller.js";
import { ToolbeltAssembler, type HarnessToolbelt } from "./toolbelt-assembler.js";

export * from "./harness-baseline.js";
export * from "./harness-bootstrap.js";
export * from "./async-harness-service.js";
export * from "./context-assembler.js";
export * from "./durable/durable-harness-service.js";
export * from "./durable/sleep-scheduler.js";
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
export type HarnessDecisionAction =
  | "accept"
  | "retry_same_plan"
  | "replan"
  | "escalate_to_human"
  | "downgrade_mode"
  | "abort";
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
  private readonly hitlRuntime: HitlRuntime;
  private readonly memoryManager: HarnessMemoryManager;
  private readonly evalRunService: EvalRunService;
  private readonly durableService: DurableHarnessService;
  private readonly contextAssembler: ContextAssembler;
  private readonly recoveryController: RecoveryController;

  public constructor(
    options: {
      toolbeltAssembler?: ToolbeltAssembler;
      guardrailEngine?: GuardrailEngine;
      hitlRuntime?: HitlRuntime;
      memoryManager?: HarnessMemoryManager;
      evalRunService?: EvalRunService;
      durableService?: DurableHarnessService;
      contextAssembler?: ContextAssembler;
    } = {},
  ) {
    this.toolbeltAssembler = options.toolbeltAssembler ?? new ToolbeltAssembler();
    this.guardrailEngine = options.guardrailEngine ?? new GuardrailEngine();
    this.hitlRuntime = options.hitlRuntime ?? new HitlRuntime();
    this.memoryManager = options.memoryManager ?? new HarnessMemoryManager();
    this.evalRunService = options.evalRunService ?? new EvalRunService();
    this.durableService = options.durableService ?? new DurableHarnessService();
    this.contextAssembler = options.contextAssembler ?? new ContextAssembler();
    this.recoveryController = new RecoveryController(this.durableService, this);
  }

  public createRun(input: {
    taskId: string;
    domainId: string;
    constraintPack: ConstraintPack;
  }): HarnessRun {
    const run: HarnessRun = {
      runId: newId("harness_run"),
      taskId: input.taskId,
      domainId: input.domainId,
      constraintPack: input.constraintPack,
      steps: [],
      maxIterations: input.constraintPack.budget.maxSteps,
      currentIteration: 0,
      status: "created",
      createdAt: nowIso(),
      completedAt: null,
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
        maxIterations: input.constraintPack.budget.maxSteps,
        maxCost: input.constraintPack.budget.maxCost,
        maxDurationMs: input.constraintPack.budget.maxDurationMs,
      },
    };
    return this.appendTimelineEvent(run, "run_created", {
      taskId: input.taskId,
      domainId: input.domainId,
    });
  }

  public appendStep(
    run: HarnessRun,
    input: {
      role: HarnessRole;
      stage: string;
      inputs: Readonly<Record<string, unknown>>;
      outputs: Readonly<Record<string, unknown>>;
      iteration?: number;
    },
  ): HarnessRun {
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
      startedAt: completedAt,
      completedAt,
    };
    return {
      ...run,
      steps: [...run.steps, step],
      currentIteration: Math.max(run.currentIteration, iteration),
      timeline: [
        ...run.timeline,
        {
          eventId: newId("timeline"),
          runId: run.runId,
          type: "step_completed",
          payload: { stepId: step.stepId, role: step.role, stage: step.stage, iteration },
          recordedAt: nowIso(),
        },
      ],
    };
  }

  public captureContextSnapshot(run: HarnessRun): ContextSnapshot {
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

  public snapshotContext(run: HarnessRun, context: HarnessContext): ContextSnapshot {
    return this.contextAssembler.snapshot(run, context);
  }

  public sleep(run: HarnessRun, reason: string, resumeAt: string): HarnessRun {
    return {
      ...run,
      status: "sleeping",
      sleepLease: {
        leaseId: newId("sleep_lease"),
        runId: run.runId,
        reason,
        resumeAt,
        createdAt: nowIso(),
      },
      timeline: [
        ...run.timeline,
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

  public recover(run: HarnessRun): HarnessRun {
    return {
      ...run,
      status: "recovering",
      recoveryCheckpoint: {
        checkpointId: newId("recovery_checkpoint"),
        runId: run.runId,
        lastCompletedStepId: run.steps.at(-1)?.stepId ?? null,
        statusBeforeRecovery: run.status,
        createdAt: nowIso(),
      },
      timeline: [
        ...run.timeline,
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

  public resume(run: HarnessRun): HarnessRun {
    return {
      ...run,
      status: "running",
      sleepLease: null,
      recoveryCheckpoint: null,
    };
  }

  public openHitlReview(run: HarnessRun, reason: string, evidenceRefs: readonly string[]): HarnessRun {
    return {
      ...run,
      status: "waiting_hitl",
      hitlRequest: this.hitlRuntime.open({
        runId: run.runId,
        domainId: run.domainId,
        reason,
        evidenceRefs,
      }),
      timeline: [
        ...run.timeline,
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

  public resolveHitlReview(run: HarnessRun, resolution: "approved" | "rejected", actorId: string): HarnessRun {
    if (run.hitlRequest == null) {
      throw new Error(`harness.hitl.request_not_found_for_run:${run.runId}`);
    }
    const resolved = this.hitlRuntime.resolve(run.hitlRequest.requestId, resolution, actorId);
    return {
      ...run,
      status: resolution === "approved" ? "running" : "aborted",
      completedAt: resolution === "approved" ? null : nowIso(),
      hitlRequest: resolved,
      timeline: [
        ...run.timeline,
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

  public listTimeline(run: HarnessRun): readonly HarnessTimelineEvent[] {
    return run.timeline;
  }

  public writeMemory(run: HarnessRun, namespace: Parameters<HarnessMemoryManager["write"]>[0], key: string, value: unknown): void {
    const scopeId = namespace === "run" ? run.runId : namespace === "domain" ? run.domainId : "global";
    this.memoryManager.write(namespace, scopeId, key, value);
  }

  public readMemory(run: HarnessRun, namespace: Parameters<HarnessMemoryManager["read"]>[0], key: string): unknown {
    const scopeId = namespace === "run" ? run.runId : namespace === "domain" ? run.domainId : "global";
    return this.memoryManager.read(namespace, scopeId, key);
  }

  public assertInvariants(run: HarnessRun): { violations: string[] } {
    const violations: string[] = [];
    const iterationCount = run.loopMetrics?.iterationCount ?? run.currentIteration;
    const replanCount = run.loopMetrics?.replanCount ?? 0;
    const totalCost = run.loopMetrics?.totalCost ?? 0;
    const durationMs = run.loopMetrics?.durationMs ?? 0;
    if (iterationCount > run.maxIterations) {
      violations.push("harness.invariant.iteration_exceeds_budget");
    }
    if (replanCount > 3) {
      violations.push("harness.invariant.replan_count_exceeds_budget");
    }
    if (totalCost > run.constraintPack.budget.maxCost) {
      violations.push("harness.invariant.total_cost_exceeds_budget");
    }
    if (durationMs > run.constraintPack.budget.maxDurationMs) {
      violations.push("harness.invariant.duration_exceeds_budget");
    }
    if ((run.status === "completed" || run.status === "aborted") && run.completedAt == null) {
      violations.push("harness.invariant.final_state_requires_completed_at");
    }
    if (run.status === "waiting_hitl" && run.hitlRequest == null) {
      violations.push("harness.invariant.waiting_hitl_requires_request");
    }
    if (run.decision != null && run.decision.action !== "accept" && run.feedbackEnvelope == null) {
      violations.push("harness.invariant.non_accept_decision_requires_feedback");
    }
    const hasOpenExecutionBlockers = run.status === "completed" || run.status === "aborted";
    if (hasOpenExecutionBlockers && (run.toolbelt?.blockedTools.length ?? 0) > 0) {
      violations.push("harness.invariant.blocked_tool_requested");
    }
    if (
      hasOpenExecutionBlockers
      && run.guardrailAssessment?.findings.some((finding) => finding.code === "harness.guardrail.required_evidence_missing")
    ) {
      violations.push("harness.invariant.required_evidence_missing");
    }
    if (
      hasOpenExecutionBlockers
      && run.guardrailAssessment?.findings.some((finding) => finding.code === "harness.guardrail.max_risk_exceeded")
    ) {
      violations.push("harness.invariant.max_risk_exceeded");
    }
    return { violations };
  }

  public evaluateRun(run: HarnessRun) {
    return this.evalRunService.evaluate(run);
  }

  public createAsyncService(): AsyncHarnessService {
    return new AsyncHarnessService(this);
  }

  public persistRun(run: HarnessRun) {
    this.ensureInvariantSafe(run);
    return this.durableService.persist(run);
  }

  public checkpointRun(run: HarnessRun): string {
    this.ensureInvariantSafe(run);
    return this.durableService.checkpoint(run);
  }

  public restoreRun(runId: string): HarnessRun | null {
    const run = this.durableService.restore(runId);
    if (run) {
      this.ensureInvariantSafe(run);
    }
    return run;
  }

  public restoreFromCheckpoint(checkpointRef: string): HarnessRun | null {
    const run = this.durableService.restoreFromCheckpoint(checkpointRef);
    if (run) {
      this.ensureInvariantSafe(run);
    }
    return run;
  }

  public handleFailure(run: HarnessRun, failure: HarnessFailureType): HarnessRun {
    return this.recoveryController.handleFailure(run, failure);
  }

  private appendTimelineEvent(
    run: HarnessRun,
    type: HarnessTimelineEvent["type"],
    payload: Readonly<Record<string, unknown>>,
  ): HarnessRun {
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
  }): HarnessDecision {
    let action: HarnessDecisionAction = "accept";
    const reasonCodes: string[] = [];

    if (input.maxIterationsReached) {
      action = "abort";
      reasonCodes.push("harness.max_iterations_reached");
    } else if (input.requiresHuman) {
      action = "escalate_to_human";
      reasonCodes.push("harness.human_required");
    } else if (input.evaluatorScore < 0.5) {
      action = "replan";
      reasonCodes.push("harness.eval_below_replan_threshold");
    } else if (input.evaluatorScore < 0.75) {
      action = "retry_same_plan";
      reasonCodes.push("harness.eval_below_accept_threshold");
    } else {
      reasonCodes.push("harness.accepted");
    }

    return {
      decisionId: newId("harness_decision"),
      action,
      reasonCodes,
      confidence: Number(input.evaluatorScore.toFixed(4)),
      createdAt: nowIso(),
    };
  }

  public runLoop(input: HarnessLoopInput): HarnessRun {
    const loop = new HarnessLoopController(input.constraintPack, {}, {
      iteration: Math.max(0, (input.iteration ?? 1) - 1),
    });
    let run = this.createRun({
      taskId: input.taskId,
      domainId: input.domainId,
      constraintPack: input.constraintPack,
    });
    run = {
      ...run,
      status: "running",
      currentIteration: input.iteration ?? 1,
    };

    while (true) {
      const iteration = (input.iteration ?? 1) + loop.getState().iteration;
      run = this.appendStep(run, {
        role: "planner",
        stage: "plan",
        inputs: { taskId: input.taskId, domainId: input.domainId },
        outputs: input.plannerOutput,
        iteration,
      });
      run = this.appendStep(run, {
        role: "generator",
        stage: "execute",
        inputs: input.plannerOutput,
        outputs: input.generatorOutput,
        iteration,
      });
      run = this.appendStep(run, {
        role: "evaluator",
        stage: "evaluate",
        inputs: input.generatorOutput,
        outputs: input.evaluatorOutput,
        iteration,
      });

      const toolbelt = this.toolbeltAssembler.assemble({
        allowedTools: input.constraintPack.toolPolicy.allowedTools,
        requestedTools: [...(input.requestedTools ?? [])],
        requiredEvidence: input.constraintPack.output_policy.requiredEvidence,
      });
      const guardrailAssessment = this.guardrailEngine.assess({
        toolbelt,
        evidenceRefs: [...(input.producedEvidenceRefs ?? [])],
        riskScore: input.riskScore ?? Math.max(0, input.constraintPack.risk_policy.escalationThreshold - 1),
        maxRiskScore: input.constraintPack.risk_policy.maxRiskScore,
        escalationThreshold: input.constraintPack.risk_policy.escalationThreshold,
        currentStepCount: run.steps.length,
        maxSteps: input.constraintPack.budget.maxSteps,
      });
      this.memoryManager.write("run", run.runId, "last_guardrail_assessment", guardrailAssessment);
      this.memoryManager.write("domain", run.domainId, "last_evaluator_score", input.evaluatorScore);

      const decision = this.decide({
        evaluatorScore: input.evaluatorScore,
        requiresHuman: input.requiresHuman === true || guardrailAssessment.requiresHuman,
        maxIterationsReached: run.steps.length >= input.constraintPack.budget.maxSteps,
      });
      const contextSnapshot = this.captureContextSnapshot({
        ...run,
        decision,
      });

      let baseRun: HarnessRun = {
        ...run,
        toolbelt,
        guardrailAssessment,
        hitlRequest: null,
        status:
          guardrailAssessment.suggestedAction === "abort" || decision.action === "abort"
            ? "aborted"
            : decision.action === "accept"
            ? "completed"
            : decision.action === "escalate_to_human"
                ? "waiting_hitl"
                : "running",
        completedAt:
          guardrailAssessment.suggestedAction === "abort" || decision.action === "accept" || decision.action === "abort"
            ? nowIso()
            : null,
        decision,
        contextSnapshots: [...run.contextSnapshots, contextSnapshot],
        feedbackEnvelope: {
          feedbackId: newId("feedback"),
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
        baseRun.steps.length + 3 <= input.constraintPack.budget.maxSteps,
      );
      const shouldStop = baseRun.status !== "running" || !progress.shouldContinue;

      if (shouldStop) {
        const finalRun = progress.violation !== null && baseRun.status === "running"
          ? {
              ...baseRun,
              loopMetrics: currentMetrics,
              status: "aborted" as const,
              completedAt: nowIso(),
              decision: {
                decisionId: newId("harness_decision"),
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

        this.ensureInvariantSafe(finalRun);

        if (finalRun.status !== "waiting_hitl") {
          this.durableService.persist(finalRun);
          return finalRun;
        }

        const withHitl = this.openHitlReview(
          finalRun,
          "guardrail_or_operator_escalation",
          [...(input.producedEvidenceRefs ?? []), ...guardrailAssessment.findings.map((finding) => finding.code)],
        );
        this.durableService.persist(withHitl);
        return withHitl;
      }

      run = {
        ...baseRun,
        loopMetrics: currentMetrics,
        status: "running",
        completedAt: null,
      };
    }
  }

  private ensureInvariantSafe(run: HarnessRun): void {
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
}
