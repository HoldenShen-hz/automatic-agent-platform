import type { DurableHarnessService } from "./durable/durable-harness-service.js";
import type { HarnessRun, HarnessRuntimeService } from "./index.js";

export type HarnessFailureType =
  | "worker_crash"
  | "tool_timeout"
  | "operator_abort"
  | "llm_provider_unavailable"
  | "budget_exhausted"
  | "platform_panic";

export class RecoveryController {
  public constructor(
    private readonly durableService: DurableHarnessService,
    private readonly runtime: HarnessRuntimeService,
  ) {}

  public handleFailure(run: HarnessRun, failure: HarnessFailureType): HarnessRun {
    if (failure === "operator_abort") {
      const result = {
        ...run,
        status: "aborted",
        completedAt: run.completedAt ?? new Date().toISOString(),
      };
      // §45: Emit lifecycle transition event for abort
      this.durableService.emitEvent({
        eventType: "harness:recovery_aborted",
        runId: run.runId,
        payload: { failureType: failure, resultStatus: result.status },
      });
      return result;
    }

    const checkpointRef = this.durableService.getCheckpointRef(run.runId);
    const restored = checkpointRef ? this.durableService.restoreFromCheckpoint(checkpointRef) : null;
    const sourceRun = restored ?? this.durableService.restore(run.runId) ?? run;
    const recovering = this.runtime.recover(sourceRun);

    switch (failure) {
      case "tool_timeout":
        return this.runtime.resume(recovering);

      case "llm_provider_unavailable":
        // LLM provider failure: wait and retry with exponential backoff
        return this.runtime.sleep(recovering, "llm_provider_unavailable_retry", new Date(Date.now() + 60000).toISOString());

      case "budget_exhausted":
        // Budget exhausted: transition to paused, requires human review
        return this.runtime.openHitlReview(recovering, "budget_exhausted", []);

      case "platform_panic":
        // Platform panic: full recovery from checkpoint
        return this.runtime.resume(recovering);

      case "worker_crash":
      default:
        // Emit recovery started event for all other failure types
        this.durableService.emitEvent({
          eventType: "harness:recovery_started",
          runId: run.runId,
          payload: { failureType: failure, sourceRunId: sourceRun.runId },
        });
        return recovering;
    }
  }
}
