import type { HarnessRun } from "../index.js";
export interface DurableHarnessRecord {
    readonly recordId: string;
    readonly run: HarnessRun;
    readonly checkpointRef: string | null;
    readonly persistedAt: string;
}
export declare class DurableHarnessService {
    private readonly runs;
    private readonly checkpoints;
    persist(run: HarnessRun): DurableHarnessRecord;
    checkpoint(run: HarnessRun): string;
    restore(runId: string): HarnessRun | null;
    restoreFromCheckpoint(checkpointRef: string): HarnessRun | null;
    getCheckpointRef(runId: string): string | null;
}
