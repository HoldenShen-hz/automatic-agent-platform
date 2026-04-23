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
export declare class HarnessLoopController {
    private readonly guards;
    private state;
    constructor(constraintPack: ConstraintPack, overrides?: Partial<HarnessLoopGuards>, initialState?: Partial<Omit<HarnessLoopState, "startedAt">> & {
        startedAt?: number;
    });
    recordIteration(cost?: number): void;
    recordReplan(): void;
    shouldContinue(lastAction: HarnessDecisionAction, hasRemainingIterations?: boolean): boolean;
    getGuardViolation(now?: number): string | null;
    evaluateProgress(lastAction: HarnessDecisionAction, hasRemainingIterations: boolean): HarnessLoopProgress;
    getState(): Readonly<HarnessLoopState>;
    getGuards(): Readonly<HarnessLoopGuards>;
}
