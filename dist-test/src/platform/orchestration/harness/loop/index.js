export class HarnessLoopController {
    guards;
    state;
    constructor(constraintPack, overrides = {}, initialState = {}) {
        const maxIterations = Math.max(1, Math.floor(constraintPack.budget.maxSteps / 3));
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
    recordIteration(cost = 0) {
        this.state = {
            ...this.state,
            iteration: this.state.iteration + 1,
            totalCost: Number((this.state.totalCost + cost).toFixed(6)),
        };
    }
    recordReplan() {
        this.state = {
            ...this.state,
            replanCount: this.state.replanCount + 1,
        };
    }
    shouldContinue(lastAction, hasRemainingIterations = true) {
        if (this.getGuardViolation() !== null) {
            return false;
        }
        if (!hasRemainingIterations) {
            return false;
        }
        return lastAction === "retry_same_plan" || lastAction === "replan";
    }
    getGuardViolation(now = Date.now()) {
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
    evaluateProgress(lastAction, hasRemainingIterations) {
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
    getState() {
        return this.state;
    }
    getGuards() {
        return this.guards;
    }
}
//# sourceMappingURL=index.js.map