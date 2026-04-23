import { newId, nowIso } from "../../../../platform/contracts/types/ids.js";
export class DurableHarnessService {
    runs = new Map();
    checkpoints = new Map();
    persist(run) {
        const existing = this.runs.get(run.runId);
        const record = {
            recordId: existing?.recordId ?? newId("durable_run"),
            run,
            checkpointRef: existing?.checkpointRef ?? null,
            persistedAt: nowIso(),
        };
        this.runs.set(run.runId, record);
        return record;
    }
    checkpoint(run) {
        const checkpointRef = newId("harness_checkpoint");
        this.checkpoints.set(checkpointRef, run);
        const record = this.persist(run);
        this.runs.set(run.runId, {
            ...record,
            checkpointRef,
            persistedAt: nowIso(),
        });
        return checkpointRef;
    }
    restore(runId) {
        return this.runs.get(runId)?.run ?? null;
    }
    restoreFromCheckpoint(checkpointRef) {
        return this.checkpoints.get(checkpointRef) ?? null;
    }
    getCheckpointRef(runId) {
        return this.runs.get(runId)?.checkpointRef ?? null;
    }
}
//# sourceMappingURL=durable-harness-service.js.map