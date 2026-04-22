import type { DurableHarnessService } from "./durable/durable-harness-service.js";
import type { HarnessRun, HarnessRuntimeService } from "./index.js";

export type HarnessFailureType = "worker_crash" | "tool_timeout" | "operator_abort";

export class RecoveryController {
  public constructor(
    private readonly durableService: DurableHarnessService,
    private readonly runtime: HarnessRuntimeService,
  ) {}

  public handleFailure(run: HarnessRun, failure: HarnessFailureType): HarnessRun {
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
