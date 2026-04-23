export interface RunSnapshot {
    readonly stepId: string;
    readonly status: string;
    readonly latencyMs?: number;
    readonly outputHash?: string;
}
export interface RunComparisonDiff {
    readonly stepId: string;
    readonly leftStatus: string;
    readonly rightStatus: string;
    readonly latencyDeltaMs: number | null;
    readonly outputChanged: boolean;
}
export declare function compareWorkflowRuns(left: readonly RunSnapshot[], right: readonly RunSnapshot[]): string[];
export declare function buildRunComparison(left: readonly RunSnapshot[], right: readonly RunSnapshot[]): RunComparisonDiff[];
