export class AsyncHarnessService {
    runtime;
    queuedRuns = new Map();
    constructor(runtime) {
        this.runtime = runtime;
    }
    async createRun(input) {
        const runId = this.runtime.createRun({
            taskId: input.taskId,
            domainId: input.domainId,
            constraintPack: input.constraintPack,
        }).runId;
        this.queuedRuns.set(runId, {
            runId,
            input,
            status: "queued",
            result: null,
            errorMessage: null,
        });
        return runId;
    }
    async execute(runId) {
        const queued = this.requireRun(runId);
        this.queuedRuns.set(runId, { ...queued, status: "running" });
        try {
            const result = this.runtime.runLoop(queued.input);
            this.queuedRuns.set(runId, {
                ...queued,
                status: "completed",
                result,
                errorMessage: null,
            });
            return result;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.queuedRuns.set(runId, {
                ...queued,
                status: "failed",
                result: null,
                errorMessage: message,
            });
            throw error;
        }
    }
    get(runId) {
        return this.queuedRuns.get(runId) ?? null;
    }
    getRunStatus(runId) {
        const queued = this.queuedRuns.get(runId);
        if (!queued) {
            return null;
        }
        return queued.result?.status ?? queued.status;
    }
    requireRun(runId) {
        const queued = this.queuedRuns.get(runId);
        if (!queued) {
            throw new Error(`harness.async.run_not_found:${runId}`);
        }
        return queued;
    }
}
//# sourceMappingURL=async-harness-service.js.map