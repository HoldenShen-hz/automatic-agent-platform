export interface RunSnapshot {
    readonly stepId: string;
    readonly status: string;
}
export declare function compareWorkflowRuns(left: readonly RunSnapshot[], right: readonly RunSnapshot[]): string[];
