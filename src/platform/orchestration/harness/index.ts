import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
import { mapHarnessStepToOapeflirPhase, type OapeflirSemanticPhase } from "./oapeflir-harness-mapping.js";

export * from "./harness-baseline.js";
export * from "./harness-bootstrap.js";
export * from "./oapeflir-harness-mapping.js";

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
}

export interface HarnessLoopInput {
  readonly taskId: string;
  readonly domainId: string;
  readonly constraintPack: ConstraintPack;
  readonly plannerOutput: Readonly<Record<string, unknown>>;
  readonly generatorOutput: Readonly<Record<string, unknown>>;
  readonly evaluatorOutput: Readonly<Record<string, unknown>>;
  readonly evaluatorScore: number;
  readonly requiresHuman?: boolean;
  readonly iteration?: number;
}

export class HarnessRuntimeService {
  public createRun(input: {
    taskId: string;
    domainId: string;
    constraintPack: ConstraintPack;
  }): HarnessRun {
    return {
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
    };
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
    };
  }

  public resume(run: HarnessRun): HarnessRun {
    return {
      ...run,
      status: "running",
      sleepLease: null,
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
    run = this.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: { taskId: input.taskId, domainId: input.domainId },
      outputs: input.plannerOutput,
      iteration: input.iteration,
    });
    run = this.appendStep(run, {
      role: "generator",
      stage: "execute",
      inputs: input.plannerOutput,
      outputs: input.generatorOutput,
      iteration: input.iteration,
    });
    run = this.appendStep(run, {
      role: "evaluator",
      stage: "evaluate",
      inputs: input.generatorOutput,
      outputs: input.evaluatorOutput,
      iteration: input.iteration,
    });

    const decision = this.decide({
      evaluatorScore: input.evaluatorScore,
      ...(input.requiresHuman !== undefined ? { requiresHuman: input.requiresHuman } : {}),
      maxIterationsReached: run.steps.length >= input.constraintPack.budget.maxSteps,
    });
    const contextSnapshot = this.captureContextSnapshot({
      ...run,
      decision,
    });

    return {
      ...run,
      status:
        decision.action === "accept"
          ? "completed"
          : decision.action === "abort"
            ? "aborted"
            : decision.action === "escalate_to_human"
              ? "waiting_hitl"
              : "running",
      completedAt: decision.action === "accept" || decision.action === "abort" ? nowIso() : null,
      decision,
      contextSnapshots: [...run.contextSnapshots, contextSnapshot],
      feedbackEnvelope: {
        feedbackId: newId("feedback"),
        signals: [...decision.reasonCodes],
        learnedActions: decision.action === "replan" ? ["update_plan_bundle"] : decision.action === "retry_same_plan" ? ["tighten_generator"] : [],
        createdAt: nowIso(),
      },
    };
  }
}
