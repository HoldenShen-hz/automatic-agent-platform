import type { HarnessLoopInput, HarnessRun, HarnessRunStatus, HarnessRuntimeService } from "./index.js";
export interface AsyncHarnessQueuedRun {
    readonly runId: string;
    readonly input: HarnessLoopInput;
    readonly status: "queued" | "running" | "completed" | "failed";
    readonly result: HarnessRun | null;
    readonly errorMessage: string | null;
}
export declare class AsyncHarnessService {
    private readonly runtime;
    private readonly queuedRuns;
    constructor(runtime: HarnessRuntimeService);
    createRun(input: HarnessLoopInput): Promise<string>;
    execute(runId: string): Promise<HarnessRun>;
    get(runId: string): AsyncHarnessQueuedRun | null;
    getRunStatus(runId: string): AsyncHarnessQueuedRun["status"] | HarnessRunStatus | null;
    private requireRun;
}
