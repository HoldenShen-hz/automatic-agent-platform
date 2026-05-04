import type { DurableHarnessService } from "./durable/durable-harness-service.js";
import type { HarnessRun, HarnessRuntimeService, HarnessRunRuntimeState } from "./index.js";
import { HarnessLoopController } from "./loop/index.js";
import { TypedEventBusPublisher, type TypedEventPublisher } from "../../state-evidence/events/typed-event-publisher.js";
import type { TypedEventBus } from "../../state-evidence/events/typed-event-bus.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

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
    private readonly loopController?: HarnessLoopController,
    private readonly eventPublisher?: TypedEventPublisher,
  ) {}

  /**
   * Gets or creates a LoopController for the given run.
   * If a LoopController was provided at construction time, returns it.
   * Otherwise creates one on-demand using the run's constraintPack and state.
   * R18-16 fix: ensures all retry decisions go through LoopController per §45.11
   */
  private getLoopController(run: HarnessRunRuntimeState): HarnessLoopController {
    if (this.loopController) {
      return this.loopController;
    }
    // Create LoopController on-demand from run's constraintPack and state
    return new HarnessLoopController(run.constraintPack, {}, {
      iteration: run.loopMetrics?.iterationCount ?? 0,
      replanCount: run.loopMetrics?.replanCount ?? 0,
      retryAttempt: run.sleepLease?.retryAttempt ?? 0,
      totalCost: run.loopMetrics?.totalCost ?? 0,
      lastRetryAt: run.sleepLease?.createdAt ? new Date(run.sleepLease.createdAt).getTime() : Date.now(),
    });
  }

  /**
   * Emits a recovery event to the state-evidence plane.
   * R9-22 fix: RecoveryController.handleFailure() must emit events to state-evidence plane
   */
  private emitRecoveryEvent(
    eventType: "recovery:decision_recorded" | "recovery:repair_applied",
    executionId: string,
    reasonCode: string,
    decisionDetails?: Record<string, unknown>,
  ): void {
    if (!this.eventPublisher) {
      return;
    }
    try {
      this.eventPublisher.publish({
        eventType,
        executionId,
        payload: {
          executionId,
          decisionId: newId("recovery_decision"),
          occurredAt: nowIso(),
          reasonCode,
          ...decisionDetails,
        },
      });
    } catch {
      // Event emission failure should not interrupt recovery flow
    }
  }

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

  public handleFailure(run: HarnessRunRuntimeState, failure: HarnessFailureType): HarnessRunRuntimeState {
    // R18-04 fix: operator_abort now routes through RecoveryController for consistent handling.
    // Previously it short-circuited without going through the recovery path, violating §45.11.
    const checkpointRef = this.durableService.getCheckpointRef(run.runId);
    const restored = checkpointRef ? this.durableService.restoreFromCheckpoint(checkpointRef) : null;
    const sourceRun = restored ?? this.durableService.restore(run.runId) ?? run;
    const recovering = this.runtime.recover(sourceRun);

    // Get current retry attempt from sleep lease (0 if no prior retry)
    const currentAttempt = run.sleepLease?.retryAttempt ?? 0;
    const scope = this.determineRetryScope(failure);

    switch (failure) {
      case "operator_abort":
        // R9-22 fix: emit recovery event for operator_abort escalation
        this.emitRecoveryEvent("recovery:decision_recorded", run.runId, "operator_abort", {
          scope,
          action: "escalate_hitl",
        });
        // Operator abort: no retry, transition to aborted and require human review per §45.11
        return this.runtime.openHitlReview(
          recovering,
          "operator_aborted",
          [],
        );

      case "llm_provider_unavailable": {
        // R13-13 fix: exponential backoff with max retries and retry_exhausted escalation
        if (currentAttempt >= RETRY_MAX_ATTEMPTS) {
          // R9-22 fix: emit recovery event for llm_provider retry exhaustion escalation
          this.emitRecoveryEvent("recovery:decision_recorded", run.runId, "llm_provider_retry_exhausted", {
            scope,
            action: "escalate_hitl",
            attempt: currentAttempt,
            maxAttempts: RETRY_MAX_ATTEMPTS,
          });
          // Retry budget exhausted → escalate to human review per §9.3
          const escalated = this.runtime.openHitlReview(
            recovering,
            "llm_provider_retry_exhausted",
            [],
          );
          this.durableService.persist(escalated);
          return escalated;
        }

        // R9-22 fix: emit recovery event for llm_provider node-level retry
        this.emitRecoveryEvent("recovery:repair_applied", run.runId, "llm_provider_unavailable", {
          scope: "node",
          action: "retry_same_plan",
          attempt: currentAttempt + 1,
          delayMs: computeBackoffDelayMs(currentAttempt + 1),
        });

        const delayMs = computeBackoffDelayMs(currentAttempt + 1);
        const resumeAt = new Date(Date.now() + delayMs).toISOString();
        this.durableService.persist(recovering);
        // R13-16 fix: use node scope for llm_provider_unavailable (retry_same_plan semantics)
        return this.runtime.sleep(recovering, `llm_provider_unavailable_retry`, resumeAt, currentAttempt + 1);
      }

      case "tool_timeout": {
        // R18-16 fix: consult LoopController for retry/replan decision per §45.11
        // Node-level retry should go through LoopController's guard evaluation
        const loop = this.getLoopController(run as HarnessRunRuntimeState);
        const hasRemainingIterations = (run.steps?.length ?? 0) < (run.loopMetrics?.maxIterations ?? Infinity);
        if (!loop.shouldContinue("retry_same_plan", hasRemainingIterations)) {
          // R9-22 fix: emit recovery event for tool_timeout guard violation escalation
          const guardViolation = loop.getGuardViolation();
          const reasonCode = guardViolation ?? "harness.guard.retry_not_allowed";
          this.emitRecoveryEvent("recovery:decision_recorded", run.runId, "tool_timeout_loop_guard_violation", {
            scope: "node",
            action: "escalate_hitl",
            reasonCode,
            guardViolation,
          });
          // Guard violation or no remaining iterations → escalate to human review
          const escalated = this.runtime.openHitlReview(
            recovering,
            "tool_timeout_loop_guard_violation",
            [reasonCode],
          );
          this.durableService.persist(escalated);
          return escalated;
        }

        // R9-22 fix: emit recovery event for tool_timeout node-level retry
        const backoffMs = loop.getBackoffMs();
        this.emitRecoveryEvent("recovery:repair_applied", run.runId, "tool_timeout", {
          scope: "node",
          action: "retry_same_plan",
          attempt: loop.getState().retryAttempt,
          delayMs: backoffMs,
        });

        // Use LoopController's backoff with jitter per §9.3
        const resumeAt = new Date(Date.now() + backoffMs).toISOString();
        loop.recordIteration(0); // Record retry attempt in LoopController
        this.durableService.persist(recovering);
        // Use LoopController's retryAttempt as the authoritative count
        return this.runtime.sleep(recovering, `tool_timeout_retry`, resumeAt, loop.getState().retryAttempt);
      }

      case "budget_exhausted":
        // R9-22 fix: emit recovery event for budget_exhausted escalation
        this.emitRecoveryEvent("recovery:decision_recorded", run.runId, "budget_exhausted", {
          scope,
          action: "escalate_hitl",
        });
        // Budget exhausted: transition to paused, requires human review
        this.durableService.persist(recovering);
        return this.runtime.openHitlReview(recovering, "budget_exhausted", []);

      case "platform_panic": {
        // R9-22 fix: emit recovery event for platform_panic graph-scope replan
        this.emitRecoveryEvent("recovery:repair_applied", run.runId, "platform_panic", {
          scope: "graph",
          action: "replan",
          checkpointRef,
        });
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
          // R9-22 fix: emit recovery event for worker_crash retry exhaustion escalation
          this.emitRecoveryEvent("recovery:decision_recorded", run.runId, "worker_crash_retry_exhausted", {
            scope: "graph",
            action: "escalate_hitl",
            attempt: currentAttempt,
            maxAttempts: RETRY_MAX_ATTEMPTS,
          });
          const escalated = this.runtime.openHitlReview(
            recovering,
            "worker_crash_retry_exhausted",
            [],
          );
          this.durableService.persist(escalated);
          return escalated;
        }

        // R9-22 fix: emit recovery event for worker_crash graph-level retry
        const delayMs = computeBackoffDelayMs(currentAttempt + 1);
        this.emitRecoveryEvent("recovery:repair_applied", run.runId, "worker_crash", {
          scope: "graph",
          action: "replan",
          attempt: currentAttempt + 1,
          delayMs,
        });

        const resumeAt = new Date(Date.now() + delayMs).toISOString();
        this.durableService.persist(recovering);
        return this.runtime.sleep(recovering, `worker_crash_retry`, resumeAt, currentAttempt + 1);
      }
    }
  }
}
