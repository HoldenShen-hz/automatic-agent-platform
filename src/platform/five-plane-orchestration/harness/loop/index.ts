import type { ConstraintPack, HarnessDecisionAction } from "../index.js";

export interface HarnessLoopGuards {
  readonly maxIterations: number;
  readonly maxReplans: number;
  readonly maxDurationMs: number;
  readonly maxCost: number;
}

export interface HarnessLoopState {
  readonly iteration: number;
  readonly replanCount: number;
  readonly startedAt: number;
  readonly totalCost: number;
}

export interface HarnessLoopProgress {
  readonly shouldContinue: boolean;
  readonly violation: string | null;
  readonly reasonCodes: readonly string[];
}

export class HarnessLoopController {
  private readonly guards: HarnessLoopGuards;
  private state: HarnessLoopState;

  public constructor(
    constraintPack: ConstraintPack,
    overrides: Partial<HarnessLoopGuards> = {},
    initialState: Partial<Omit<HarnessLoopState, "startedAt">> & { startedAt?: number } = {},
  ) {
    const maxIterations = Math.max(0, Math.floor(constraintPack.budget.maxSteps / 3));
    this.guards = {
      maxIterations,
      maxReplans: 3,
      maxDurationMs: constraintPack.budget.maxDurationMs,
      maxCost: constraintPack.budget.maxCost,
      ...overrides,
    };
    this.state = {
      iteration: initialState.iteration ?? 0,
      replanCount: initialState.replanCount ?? 0,
      startedAt: initialState.startedAt ?? Date.now(),
      totalCost: initialState.totalCost ?? 0,
    };
  }

  public recordIteration(cost = 0): void {
    this.state = {
      ...this.state,
      iteration: this.state.iteration + 1,
      totalCost: Number((this.state.totalCost + cost).toFixed(6)),
    };
  }

  public recordReplan(): void {
    this.state = {
      ...this.state,
      replanCount: this.state.replanCount + 1,
    };
  }

  public shouldContinue(lastAction: HarnessDecisionAction, hasRemainingIterations = true): boolean {
    if (this.getGuardViolation() !== null) {
      return false;
    }
    if (!hasRemainingIterations) {
      return false;
    }
    return lastAction === "retry_same_plan" || lastAction === "replan";
  }

  public getGuardViolation(now = Date.now()): string | null {
    if (this.state.iteration >= this.guards.maxIterations) {
      return "harness.guard.max_iterations_reached";
    }
    if (this.state.replanCount > this.guards.maxReplans) {
      return "harness.guard.max_replans_reached";
    }
    if (this.state.totalCost > this.guards.maxCost) {
      return "harness.guard.max_cost_exceeded";
    }
    if (now - this.state.startedAt > this.guards.maxDurationMs) {
      return "harness.guard.max_duration_exceeded";
    }
    return null;
  }

  public evaluateProgress(lastAction: HarnessDecisionAction, hasRemainingIterations: boolean): HarnessLoopProgress {
    const violation = this.getGuardViolation();
    if (violation !== null) {
      return {
        shouldContinue: false,
        violation,
        reasonCodes: [violation],
      };
    }
    if (!hasRemainingIterations && (lastAction === "retry_same_plan" || lastAction === "replan")) {
      return {
        shouldContinue: false,
        violation: null,
        reasonCodes: ["harness.guard.iteration_input_exhausted"],
      };
    }
    return {
      shouldContinue: this.shouldContinue(lastAction, hasRemainingIterations),
      violation: null,
      reasonCodes: [],
    };
  }

  public getState(): Readonly<HarnessLoopState> {
    return this.state;
  }

  public getGuards(): Readonly<HarnessLoopGuards> {
    return this.guards;
  }
}
