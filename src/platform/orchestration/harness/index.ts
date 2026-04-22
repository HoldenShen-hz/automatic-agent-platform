import { newId, nowIso } from "../../../platform/contracts/types/ids.js";
export * from "./harness-baseline.js";
export * from "./harness-bootstrap.js";

export type HarnessRole = "planner" | "generator" | "evaluator" | "hitl_operator" | "loop_controller";
export type HarnessDecisionAction =
  | "accept"
  | "retry_same_plan"
  | "replan"
  | "escalate_to_human"
  | "downgrade_mode"
  | "abort";

export interface ConstraintPack {
  readonly policyIds: readonly string[];
  readonly approvalMode: "none" | "required" | "supervised";
  readonly autonomyMode: "manual" | "supervised" | "auto" | "full_auto";
  readonly toolPolicy: {
    readonly allowedTools: readonly string[];
  };
  readonly budget: {
    readonly maxSteps: number;
    readonly maxCost: number;
    readonly maxDurationMs: number;
  };
}

export interface HarnessStep {
  readonly stepId: string;
  readonly role: HarnessRole;
  readonly stage: string;
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
  readonly status: "running" | "paused" | "completed" | "aborted";
  readonly createdAt: string;
  readonly completedAt: string | null;
  readonly decision: HarnessDecision | null;
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
      status: "running",
      createdAt: nowIso(),
      completedAt: null,
      decision: null,
    };
  }

  public appendStep(
    run: HarnessRun,
    input: {
      role: HarnessRole;
      stage: string;
      inputs: Readonly<Record<string, unknown>>;
      outputs: Readonly<Record<string, unknown>>;
    },
  ): HarnessRun {
    const completedAt = nowIso();
    const step: HarnessStep = {
      stepId: newId("harness_step"),
      role: input.role,
      stage: input.stage,
      inputs: input.inputs,
      outputs: input.outputs,
      startedAt: completedAt,
      completedAt,
    };
    return {
      ...run,
      steps: [...run.steps, step],
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
    run = this.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: { taskId: input.taskId, domainId: input.domainId },
      outputs: input.plannerOutput,
    });
    run = this.appendStep(run, {
      role: "generator",
      stage: "execute",
      inputs: input.plannerOutput,
      outputs: input.generatorOutput,
    });
    run = this.appendStep(run, {
      role: "evaluator",
      stage: "evaluate",
      inputs: input.generatorOutput,
      outputs: input.evaluatorOutput,
    });

    const decision = this.decide({
      evaluatorScore: input.evaluatorScore,
      ...(input.requiresHuman !== undefined ? { requiresHuman: input.requiresHuman } : {}),
      maxIterationsReached: run.steps.length >= input.constraintPack.budget.maxSteps,
    });

    return {
      ...run,
      status:
        decision.action === "accept"
          ? "completed"
          : decision.action === "abort"
            ? "aborted"
            : decision.action === "escalate_to_human"
              ? "paused"
              : "running",
      completedAt: decision.action === "accept" || decision.action === "abort" ? nowIso() : null,
      decision,
    };
  }
}
