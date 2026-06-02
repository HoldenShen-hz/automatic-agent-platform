import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
import { MS_PER_HOUR } from "../../../platform/contracts/constants/time.js";
import {
  createBudgetLedger,
  type HarnessAuditTrail,
  type HarnessBudgetEnvelope,
  type HarnessRun as CanonicalHarnessRun,
  type HarnessRunStatus as CanonicalHarnessRunStatus,
  type PlanGraphBundle,
  type RiskPreview,
} from "../../../platform/contracts/executable-contracts/index.js";
import type { RuntimeRepository } from "../../../platform/five-plane-state-evidence/truth/runtime-truth-repository.js";
import { RuntimeStateMachine, RuntimeTransitionCommand } from "../../../platform/five-plane-execution/runtime-state-machine.js";
import { AsyncHarnessService } from "./async-harness-service.js";
import { ContextAssembler, type HarnessContext, type HarnessContextSourceSet } from "./context-assembler.js";
import { DurableHarnessService } from "./durable/durable-harness-service.js";
import { GuardrailEngine } from "./guardrails/guardrail-engine.js";
import {
  GuardrailVibrationBreaker,
  type GuardrailActionSignal,
  type GuardrailVibrationState,
  type GuardrailVibrationDecision,
} from "./guardrails/guardrail-vibration-breaker.js";
import { HarnessDecisionManager, type HarnessDecisionEvaluationInput } from "./harness-decision-manager.js";
import {
  createDefaultEvaluatorOutput,
  createDefaultGeneratorOutput,
  createDefaultPlannerOutput,
  estimateIterationCost,
  getPreviousPlannerOutput,
} from "./harness-loop-support.js";
import { createInitialPlanGraphBundle } from "./harness-plan-graph.js";
import { HitlRuntime, type HitlRequest, type HitlPersistenceStore, type InMemoryHitlStore } from "./hitl-runtime.js";
import { EvalRunService } from "./evaluation/eval-run-service.js";
import { HarnessStateManager } from "./harness-state-manager.js";
import { HarnessMemoryManager } from "./memory-manager.js";
import { HarnessLoopController } from "./loop/index.js";
import { mapHarnessStepToOapeflirPhase, type OapeflirSemanticPhase } from "./oapeflir-harness-mapping.js";
import { RecoveryController, type HarnessFailureType } from "./recovery-controller.js";
import { ToolbeltAssembler, type HarnessToolbelt } from "./toolbelt-assembler.js";
import type { ControlPlaneDirectiveSink } from "../../../platform/five-plane-control-plane/control-plane-directive-sink.js";
import { createOperationalDirective } from "../../../platform/contracts/control-directive/index.js";
import {
  getConstraintOutputPolicy,
  getConstraintRiskPolicy,
  normalizeConstraintPack,
  type ConstraintPack,
} from "./constraint-pack.js";
import {
  ensureIsoAfter,
  type ContextSnapshot,
  type HarnessDecision,
  type HarnessLoopInput,
  type HarnessRole,
  type HarnessRunRuntimeState,
  type HarnessStep,
  type HarnessTimelineEvent,
} from "./runtime-types.js";

export * from "./runtime-components.js";
export * from "./constraint-pack.js";
export * from "./runtime-types.js";
export * from "./harness-state-manager.js";

export class HarnessRuntimeService {
  private readonly toolbeltAssembler: ToolbeltAssembler;
  private readonly decisionManager: HarnessDecisionManager;
  private readonly guardrailEngine: GuardrailEngine;
  private readonly vibrationBreaker: GuardrailVibrationBreaker;
  private readonly hitlRuntime: HitlRuntime;
  private readonly memoryManager: HarnessMemoryManager;
  private readonly evalRunService: EvalRunService;
  private readonly durableService: DurableHarnessService;
  private readonly contextAssembler: ContextAssembler;
  private readonly recoveryController: RecoveryController;
  private readonly stateMachine: RuntimeStateMachine;
  private readonly stateManager: HarnessStateManager;
  /** R4-35: RuntimeTruthRepository for persisting decisions as immutable EvidenceRecords */
  private readonly runtimeTruthRepository: RuntimeRepository | undefined;
  /** R4-47: Directive sink for emitting OperationalDirective during HITL pause/resume operations */
  private readonly directiveSink: ControlPlaneDirectiveSink | null;
  /** Vibration state keyed by runId so one run cannot poison another run's breaker history. */
  private readonly vibrationStates = new Map<string, GuardrailVibrationState>();

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
    this.stateMachine = new RuntimeStateMachine({ persistEvent: () => undefined });
    this.stateManager = new HarnessStateManager(this.stateMachine);
    this.runtimeTruthRepository = options.runtimeTruthRepository;
    this.decisionManager = new HarnessDecisionManager(this.runtimeTruthRepository);
    this.directiveSink = options.directiveSink ?? null;
    this.recoveryController = new RecoveryController(this.durableService, this);
  }

  private createInitialVibrationState(): GuardrailVibrationState {
    return {
      guardrailActionCount: 0,
      lastGuardrailSignature: null,
      guardrailCooldownUntilMs: null,
      recentSignals: [],
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
        maxDurationMs: budgetEnvelope?.maxDurationMs ?? MS_PER_HOUR,
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
      nodeId?: string; // R8-21 fix: replaces stage for precise node targeting
      stage?: string; // Only for semantic phase mapping when nodeId not available
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
    // R8-21 fix: nodeId takes precedence over stage for node routing
    const effectiveNodeId = input.nodeId;
    const effectiveStage = input.nodeId ? undefined : (input.stage ?? "default");
    if (run.decision != null && run.decision.action !== "accept" && run.feedbackEnvelope == null) {
      throw new Error("harness.feedback.required_for_non_accept_decision");
    }

    const startedAt = nowIso();
    const completedAt = input.latency != null
      ? new Date(Date.parse(startedAt) + Math.max(1, Math.trunc(input.latency))).toISOString()
      : ensureIsoAfter(startedAt, nowIso());
    const iteration = input.iteration ?? Math.max(run.currentIteration, 1);
    const step: HarnessStep = {
      stepId: newId("harness_step"),
      role: input.role,
      stage: effectiveStage ?? "default",
      iteration,
      semanticPhase: mapHarnessStepToOapeflirPhase(input.role, effectiveStage ?? "default"),
      inputs: input.inputs,
      outputs: input.outputs,
      startedAt,
      completedAt,
      ...(effectiveNodeId != null ? { nodeId: effectiveNodeId } : {}),
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
      recoveryCheckpoint: paused.recoveryCheckpoint,
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
    const isTerminal = run.status === "completed" || run.status === "failed" || run.status === "aborted" || run.status === "cancelled";
    // R1-1: Must route all status changes through state machine to maintain INV-RUNTIME-001
    const paused = isTerminal
      ? this.transitionRunStatus(run, "paused", "harness.recover_from_terminal")
      : this.pauseRun(this.ensureRunning(run), "recovery");
    return {
      ...paused,
      pauseReason: "recovery",
      recoveryCheckpoint: {
        checkpointId: newId("harness_checkpoint"),
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
    const { request: resolved, record: hrr } = this.hitlRuntime.resolve(run.hitlRequest.requestId, resolution, actorId);
    // R4-47: Emit resume OperationalDirective when HITL review is approved
    if (resolution === "approved") {
      this.emitOperationalDirective("resume", "harness_runtime_service", "hitl_review_resolved:approved", {
        harnessRunId: run.harnessRunId,
      });
    }
    const nextRun = resolution === "approved"
      ? this.transitionRunStatus(this.transitionRunStatus(run, "resuming", "harness.hitl_approved"), "running", "harness.hitl_resumed")
      : this.transitionRunStatus(run, "cancelled", "harness.hitl_rejected");
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
          payload: { resolution, actorId, humanResponsibilityRecordId: hrr.recordId },
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
    return this.stateManager.assertInvariants(run);
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

  public decide(input: HarnessDecisionEvaluationInput): HarnessDecision {
    return this.decisionManager.decide(input);
  }

  public runLoop(input: HarnessLoopInput): HarnessRunRuntimeState {
    input = { ...input, constraintPack: normalizeConstraintPack(input.constraintPack) };
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
      const plannerOutput = this.resolvePlannerOutput(input, iteration, run);

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
        outputs: plannerOutput,
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

      const generatorOutput = this.resolveGeneratorOutput(input, iteration, plannerOutput);

      run = this.appendStep(run, {
        role: "generator",
        stage: "execute",
        inputs: plannerOutput,
        outputs: generatorOutput,
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

      const evaluatorOutput = this.resolveEvaluatorOutput(input, iteration, generatorOutput);
      const evaluatorScore = this.resolveEvaluatorScore(input, evaluatorOutput);

      run = this.appendStep(run, {
        role: "evaluator",
        stage: "evaluate",
        inputs: generatorOutput,
        outputs: evaluatorOutput,
        iteration,
      });

      const outputPolicy = getConstraintOutputPolicy(input.constraintPack);
      const riskPolicy = getConstraintRiskPolicy(input.constraintPack);
      const toolbelt = this.toolbeltAssembler.assemble({
        allowedTools: input.constraintPack.tool_policy.allowedTools,
        requestedTools: [...(input.requestedTools ?? [])],
        requiredEvidence: outputPolicy.requiredEvidence,
        sandboxRequirement: input.constraintPack.sandboxRequirement,
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
        ...(typeof generatorOutput.input === "string" ? { inputPrompt: generatorOutput.input as string } : {}),
        ...(input.producedEvidenceRefs ? { memoryAccessPattern: input.producedEvidenceRefs } : {}),
        // R26-37 fix: Pass planningOutput and generatedOutput for Planning/Output layer guardrail checks
        ...(typeof plannerOutput.output === "string" ? { planningOutput: plannerOutput.output as string } : {}),
        ...(typeof generatorOutput.output === "string" ? { generatedOutput: generatorOutput.output as string } : {}),
      });
      this.memoryManager.write("run", run.runId, "last_guardrail_assessment", guardrailAssessment);
      this.memoryManager.write("domain", run.domainId, "last_evaluator_score", evaluatorScore);

      const lastNodeRunId = run.nodeRunIds.at(-1);
      // R18-03 fix: Pass all decision factors to decide() per §45.25
      // §45.25: Freeze all decision state at decision time before LLM-as-Judge evaluation
      const frozenEvaluator = { score: evaluatorScore, reasoning: "" };
      const frozenRisk = {
        currentScore: input.riskScore ?? 0,
        maxScore: riskPolicy.maxRiskScore,
        escalationThreshold: riskPolicy.escalationThreshold,
      };
      const frozenHitl = { pending: run.hitlRequest?.status === "pending_approval", requestId: run.hitlRequest?.requestId ?? null };
      const frozenSideEffect = { mayCommit: input.constraintPack.tool_policy.allowedTools.length > 0, reversible: true };
      const frozenBudget = inputBudget != null ? {
        remainingSteps: Math.max(0, inputBudget.maxSteps - run.steps.length),
        remainingCost: Math.max(0, inputBudget.maxCost - (run.loopMetrics?.totalCost ?? 0)),
        remainingDurationMs: Math.max(0, inputBudget.maxDurationMs - (run.loopMetrics?.durationMs ?? 0)),
      } : undefined;
      const frozenPolicy = { policyIds: input.constraintPack.policyIds, constraintPackRef: run.constraintPackRef };
      const frozenGuardrail: {
        passed: boolean;
        requiresHuman: boolean;
        suggestedAction: string;
        findings: readonly { code: string; message: string }[];
      } = {
        passed: guardrailAssessment.passed,
        requiresHuman: guardrailAssessment.requiresHuman,
        suggestedAction: guardrailAssessment.suggestedAction,
        findings: guardrailAssessment.findings.map(f => ({ code: f.code, message: f.message })),
      };
      const decision = this.decide({
        evaluatorScore,
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
        // §45.25: Pass frozen state (all fields use null defaults in decide() if not provided)
        frozenEvaluator,
        frozenRisk,
        frozenHitl,
        frozenSideEffect,
        frozenBudget,
        frozenPolicy,
        frozenGuardrail,
        ...(lastNodeRunId !== undefined ? { frozenNode: { nodeId: lastNodeRunId, nodeType: "step", status: "running" } } : {}),
      } as Parameters<typeof this.decide>[0]);

      // R18-05 fix: Check for guardrail vibration (repeated same action) per §45.20
      // VibrationBreaker detects when the same guardrail action repeats too often,
      // indicating an oscillation loop that would cause infinite replanning.
      // Use guardrailSuggestedAction as the signature since that drives retry/replan.
      if (guardrailAssessment.suggestedAction === "proceed") {
        this.vibrationStates.delete(run.runId);
      } else {
        const vibrationSignal: GuardrailActionSignal = {
          runId: run.runId,
          signature: guardrailAssessment.suggestedAction,
          observedAtMs: Date.now(),
        };
        const vibrationDecision: GuardrailVibrationDecision = this.vibrationBreaker.evaluate(
          vibrationSignal,
          this.vibrationStates.get(run.runId) ?? this.createInitialVibrationState(),
        );
        this.vibrationStates.set(run.runId, vibrationDecision.state);

        // If vibration is in cooldown, escalate to human review to break the oscillation loop
        if (!vibrationDecision.allowed) {
          const escalated = this.openHitlReview(
            run,
            "guardrail_vibration_detected",
            [vibrationDecision.reasonCode, guardrailAssessment.suggestedAction],
          );
          this.durableService.persist(escalated);
          return escalated;
        }
      }

      const contextSnapshot = this.captureContextSnapshot({
        ...run,
        decision,
      });

      let baseRun: HarnessRunRuntimeState = {
        ...run,
        toolbelt,
        ...(toolbelt.sandboxLayer !== undefined ? { sandboxLayer: toolbelt.sandboxLayer } : {}),
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

      loop.recordIteration(estimateIterationCost(plannerOutput, generatorOutput, evaluatorOutput));
      if (decision.action === "retry_same_plan") {
        loop.recordRetry();
      } else if (decision.action === "replan") {
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
    return this.stateManager.ensureRunning(run);
  }

  private pauseRun(run: HarnessRunRuntimeState, reason: HarnessRunRuntimeState["pauseReason"]): HarnessRunRuntimeState {
    return this.stateManager.pauseRun(run, reason);
  }

  private transitionRunStatus(
    run: HarnessRunRuntimeState,
    toStatus: CanonicalHarnessRunStatus,
    reasonCode: string,
  ): HarnessRunRuntimeState {
    return this.stateManager.transitionRunStatus(run, toStatus, reasonCode);
  }

  private ensureInvariantSafe(run: HarnessRunRuntimeState): void {
    this.stateManager.ensureInvariantSafe(run);
  }

  private resolvePlannerOutput(
    input: HarnessLoopInput,
    iteration: number,
    run: HarnessRunRuntimeState,
  ): Readonly<Record<string, unknown>> {
    if (input.loopServices) {
      return input.loopServices.plan({
        taskId: input.taskId,
        domainId: input.domainId,
        constraintPack: input.constraintPack,
        iteration,
        previousPlannerOutput: getPreviousPlannerOutput(run),
      });
    }
    if (input.plannerOutput) {
      return input.plannerOutput;
    }
    return createDefaultPlannerOutput(input, iteration);
  }

  private resolveGeneratorOutput(
    input: HarnessLoopInput,
    iteration: number,
    plannerOutput: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> {
    if (input.loopServices) {
      return input.loopServices.generate({
        taskId: input.taskId,
        domainId: input.domainId,
        constraintPack: input.constraintPack,
        iteration,
        plannerOutput,
      });
    }
    if (input.generatorOutput) {
      return input.generatorOutput;
    }
    return createDefaultGeneratorOutput(input, iteration, plannerOutput);
  }

  private resolveEvaluatorOutput(
    input: HarnessLoopInput,
    iteration: number,
    generatorOutput: Readonly<Record<string, unknown>>,
  ): Readonly<Record<string, unknown>> {
    if (input.loopServices) {
      return input.loopServices.evaluate({
        taskId: input.taskId,
        domainId: input.domainId,
        constraintPack: input.constraintPack,
        iteration,
        generatorOutput,
      });
    }
    if (input.evaluatorOutput) {
      return input.evaluatorOutput;
    }
    return createDefaultEvaluatorOutput(input, iteration, generatorOutput);
  }

  private resolveEvaluatorScore(
    input: HarnessLoopInput,
    evaluatorOutput: Readonly<Record<string, unknown>>,
  ): number {
    if (typeof input.evaluatorScore === "number" && Number.isFinite(input.evaluatorScore)) {
      return input.evaluatorScore;
    }
    const score = evaluatorOutput.score;
    return typeof score === "number" && Number.isFinite(score) ? score : 0.5;
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
