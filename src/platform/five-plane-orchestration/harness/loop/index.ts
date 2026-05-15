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
  readonly lastRetryAt: number;
  readonly retryAttempt: number;
}

// Backoff constants per §9.3
const BACKOFF_BASE_MS = 1000; // 1 second base
const BACKOFF_MAX_MS = 60000; // 60 seconds max
// Iteration guard minimum: Math.max(1, rawIterations)
const JITTER_FACTOR = 0.1; // 10% jitter

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
    // Prefer budgetEnvelope (new) > budget (deprecated)
    const budget = constraintPack.budgetEnvelope ?? constraintPack.budget ?? {
      maxSteps: 100,
      maxCost: 100000,
      maxDurationMs: 3600000,
    };
    const rawIterations = Math.max(0, Math.floor(budget.maxSteps / 3));
    this.guards = {
      maxIterations: rawIterations,
      maxReplans: 3,
      maxDurationMs: budget.maxDurationMs,
      maxCost: budget.maxCost,
      ...overrides,
    };
    this.state = {
      iteration: initialState.iteration ?? 0,
      replanCount: initialState.replanCount ?? 0,
      startedAt: initialState.startedAt ?? Date.now(),
      totalCost: initialState.totalCost ?? 0,
      lastRetryAt: initialState.lastRetryAt ?? 0,
      retryAttempt: initialState.retryAttempt ?? 0,
    };
  }

  public recordIteration(cost = 0): void {
    this.state = {
      ...this.state,
      iteration: this.state.iteration + 1,
      totalCost: Number((this.state.totalCost + cost).toFixed(6)),
      lastRetryAt: Date.now(),
      retryAttempt: this.state.retryAttempt + 1,
    };
  }

  public recordReplan(): void {
    this.state = {
      ...this.state,
      replanCount: this.state.replanCount + 1,
    };
  }

  /**
   * Compute exponential backoff with jitter per §9.3.
   * @returns Backoff delay in milliseconds (base=1s, max=60s, 10% jitter)
   */
  public getBackoffMs(): number {
    const exponentialDelay = BACKOFF_BASE_MS * Math.pow(2, this.state.retryAttempt - 1);
    const cappedDelay = Math.min(exponentialDelay, BACKOFF_MAX_MS);
    const jitter = cappedDelay * JITTER_FACTOR * Math.random();
    return Math.floor(cappedDelay + jitter);
  }

  public shouldContinue(lastAction: HarnessDecisionAction, hasRemainingIterations = true): boolean {
    if (this.getGuardViolation() !== null) {
      return false;
    }
    if (!hasRemainingIterations) {
      return false;
    }
    if (lastAction === "retry_same_plan") {
      // Enforce exponential backoff + jitter per §9.3 to prevent thundering herd
      const elapsed = Date.now() - this.state.lastRetryAt;
      return elapsed >= this.getBackoffMs();
    }
    return lastAction === "replan";
  }

  public getGuardViolation(now = Date.now()): string | null {
    return this.checkIterationLimit(now) ?? this.checkReplanLimit(now) ?? this.checkCostLimit(now) ?? this.checkDurationLimit(now) ?? null;
  }

  /** R5-4: Check if iteration limit has been reached */
  public checkIterationLimit(now = Date.now()): string | null {
    if (this.state.iteration >= this.guards.maxIterations) {
      return "harness.guard.max_iterations_reached";
    }
    return null;
  }

  /** R30-24: Check if replan limit has been reached. */
  public checkReplanLimit(now = Date.now()): string | null {
    if (this.state.replanCount >= this.guards.maxReplans) {
      return "harness.guard.max_replans_reached";
    }
    return null;
  }

  /** R5-4: Check if cost limit has been reached */
  public checkCostLimit(now = Date.now()): string | null {
    if (this.state.totalCost > this.guards.maxCost) {
      return "harness.guard.max_cost_exceeded";
    }
    return null;
  }

  /** R5-4: Check if duration limit has been reached */
  public checkDurationLimit(now = Date.now()): string | null {
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
