import type { DurableHarnessService } from "./durable/durable-harness-service.js";
import type { HarnessRun, HarnessRuntimeService } from "./index.js";

export type HarnessFailureType =
  | "worker_crash"
  | "tool_timeout"
  | "operator_abort"
  | "llm_provider_unavailable"
  | "budget_exhausted"
  | "platform_panic";

/**
 * Failure recovery scope per §45.15.
 * - node: Retry at the node level (retry_same_plan) - recovers a single step/node
 * - graph: Retry the full plan (replan) - regenerates the entire execution graph
 */
export type RecoveryScope = "node" | "graph";

/** Exponential backoff parameters per §9.3 */
const RETRY_BACKOFF_BASE_MS = 1_000; // 1 second base
const RETRY_BACKOFF_MAX_MS = 60_000; // 60 second cap
const RETRY_MAX_ATTEMPTS = 5; // Max retries before escalation

/**
 * Computes exponential backoff delay with cap per §9.3.
 * delay = min(maxDelay, base * 2^(attempt - 1))
 */
function computeBackoffDelayMs(attempt: number): number {
  return Math.min(RETRY_BACKOFF_MAX_MS, RETRY_BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1));
}

export class RecoveryController {
  public constructor(
    private readonly durableService: DurableHarnessService,
    private readonly runtime: HarnessRuntimeService,
  ) {}

  /**
   * Determines the retry scope for a given failure type per §45.15.
   * Node-level failures (tool_timeout, llm_provider_unavailable) use retry_same_plan.
   * Graph-level failures (platform_panic) use replan.
   */
  public determineRetryScope(failure: HarnessFailureType): RecoveryScope {
    switch (failure) {
      case "llm_provider_unavailable":
      case "tool_timeout":
        // Transient failures at node level → node-scope retry
        return "node";
      case "platform_panic":
      case "worker_crash":
        // Non-transient or catastrophic failures → graph-scope retry
        return "graph";
      case "budget_exhausted":
        // Budget exhaustion is a graph-level concern
        return "graph";
      case "operator_abort":
        // Operator abort is not retryable
        return "node";
      default:
        return "node";
    }
  }

  public handleFailure(run: HarnessRun, failure: HarnessFailureType): HarnessRun {
    if (failure === "operator_abort") {
      const result = {
        ...run,
        status: "aborted",
        completedAt: run.completedAt ?? new Date().toISOString(),
      };
      this.durableService.persist(result);
      return result;
    }

    const checkpointRef = this.durableService.getCheckpointRef(run.runId);
    const restored = checkpointRef ? this.durableService.restoreFromCheckpoint(checkpointRef) : null;
    const sourceRun = restored ?? this.durableService.restore(run.runId) ?? run;
    const recovering = this.runtime.recover(sourceRun);

    // Get current retry attempt from sleep lease (0 if no prior retry)
    const currentAttempt = run.sleepLease?.retryAttempt ?? 0;
    const scope = this.determineRetryScope(failure);

    switch (failure) {
      case "llm_provider_unavailable": {
        // R13-13 fix: exponential backoff with max retries and retry_exhausted escalation
        if (currentAttempt >= RETRY_MAX_ATTEMPTS) {
          // Retry budget exhausted → escalate to human review per §9.3
          const escalated = this.runtime.openHitlReview(
            recovering,
            "llm_provider_retry_exhausted",
            [],
          );
          this.durableService.persist(escalated);
          return escalated;
        }

        const delayMs = computeBackoffDelayMs(currentAttempt + 1);
        const resumeAt = new Date(Date.now() + delayMs).toISOString();
        this.durableService.persist(recovering);
        // R13-16 fix: use node scope for llm_provider_unavailable (retry_same_plan semantics)
        return this.runtime.sleep(recovering, `llm_provider_unavailable_retry`, resumeAt, currentAttempt + 1);
      }

      case "tool_timeout": {
        // R13-13 fix: apply retry limits to tool_timeout
        if (currentAttempt >= RETRY_MAX_ATTEMPTS) {
          // Retry budget exhausted → escalate to human review per §9.3
          const escalated = this.runtime.openHitlReview(
            recovering,
            "tool_timeout_retry_exhausted",
            [],
          );
          this.durableService.persist(escalated);
          return escalated;
        }

        const delayMs = computeBackoffDelayMs(currentAttempt + 1);
        const resumeAt = new Date(Date.now() + delayMs).toISOString();
        this.durableService.persist(recovering);
        // R13-16 fix: use node scope for tool_timeout (retry_same_plan semantics)
        return this.runtime.sleep(recovering, `tool_timeout_retry`, resumeAt, currentAttempt + 1);
      }

      case "budget_exhausted":
        // Budget exhausted: transition to paused, requires human review
        this.durableService.persist(recovering);
        return this.runtime.openHitlReview(recovering, "budget_exhausted", []);

      case "platform_panic": {
        // Platform panic: full recovery from checkpoint with graph-scope retry
        // R13-16 fix: platform_panic uses graph scope (replan semantics)
        this.durableService.persist(recovering);
        return this.runtime.resume(recovering);
      }

      case "worker_crash":
      default: {
        // worker_crash uses graph scope per §45.15
        // R13-13 fix: apply retry limits to worker_crash
        if (currentAttempt >= RETRY_MAX_ATTEMPTS) {
          const escalated = this.runtime.openHitlReview(
            recovering,
            "worker_crash_retry_exhausted",
            [],
          );
          this.durableService.persist(escalated);
          return escalated;
        }

        const delayMs = computeBackoffDelayMs(currentAttempt + 1);
        const resumeAt = new Date(Date.now() + delayMs).toISOString();
        this.durableService.persist(recovering);
        return this.runtime.sleep(recovering, `worker_crash_retry`, resumeAt, currentAttempt + 1);
      }
    }
  }
}
