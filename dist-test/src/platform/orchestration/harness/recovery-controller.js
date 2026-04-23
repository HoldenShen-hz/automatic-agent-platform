export class RecoveryController {
    durableService;
    runtime;
    constructor(durableService, runtime) {
        this.durableService = durableService;
        this.runtime = runtime;
    }
    handleFailure(run, failure) {
        if (failure === "operator_abort") {
            return {
                ...run,
                status: "aborted",
                completedAt: run.completedAt ?? new Date().toISOString(),
            };
        }
        const checkpointRef = this.durableService.getCheckpointRef(run.runId);
        const restored = checkpointRef ? this.durableService.restoreFromCheckpoint(checkpointRef) : null;
        const sourceRun = restored ?? this.durableService.restore(run.runId) ?? run;
        const recovering = this.runtime.recover(sourceRun);
        if (failure === "tool_timeout") {
            return this.runtime.resume(recovering);
        }
        return recovering;
    }
}
//# sourceMappingURL=recovery-controller.js.map