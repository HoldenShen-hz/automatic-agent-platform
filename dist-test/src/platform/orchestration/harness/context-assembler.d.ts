import type { ContextSnapshot, HarnessRun } from "./index.js";
export interface HarnessContextSourceSet {
    readonly conversation?: Readonly<Record<string, unknown>>;
    readonly task?: Readonly<Record<string, unknown>>;
    readonly memory?: Readonly<Record<string, unknown>>;
    readonly knowledge?: Readonly<Record<string, unknown>>;
}
export interface HarnessContext {
    readonly contextId: string;
    readonly tokenBudget: number;
    readonly conversation: Readonly<Record<string, unknown>>;
    readonly task: Readonly<Record<string, unknown>>;
    readonly memory: Readonly<Record<string, unknown>>;
    readonly knowledge: Readonly<Record<string, unknown>>;
    readonly assembledAt: string;
}
export declare class ContextAssembler {
    assemble(sources: HarnessContextSourceSet, tokenBudget: number): HarnessContext;
    snapshot(run: HarnessRun, context: HarnessContext): ContextSnapshot;
}
