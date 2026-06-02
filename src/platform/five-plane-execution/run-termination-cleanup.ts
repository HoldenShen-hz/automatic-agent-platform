import { TypedEventBus } from "../five-plane-state-evidence/events/typed-event-bus.js";
import { nowIso } from "../contracts/types/ids.js";

export type CleanupCallback = (params: {
  readonly resourceId: string;
  readonly tenantId: string;
  readonly runId: string;
}) => Promise<boolean>;

/** R11-08: Callback type for state evidence flush */
export type StateEvidenceFlushCallback = (runId: string) => Promise<{
  readonly flushed: boolean;
  readonly artifactCount: number;
  readonly error?: string;
}>;

/** R11-08: Callback type for compensation trigger */
export type CompensationTriggerCallback = (runId: string, reason: string) => Promise<{
  readonly triggered: boolean;
  readonly compensationPlanId?: string;
  readonly error?: string;
}>;

/** R11-08: Callback type for notifications */
export type NotificationCallback = (params: {
  readonly runId: string;
  readonly terminalStatus: string;
  readonly reason?: string;
}) => Promise<{
  readonly sent: boolean;
  readonly notificationId?: string;
  readonly error?: string;
}>;

export type CleanupIncidentCallback = (params: {
  readonly runId: string;
  readonly tenantId: string;
  readonly terminalStatus: RunTerminationCleanupRequest["terminalStatus"];
  readonly cleanupStatus: "partial" | "failed";
  readonly failedResourceIds: readonly string[];
  readonly cleanedResourceIds: readonly string[];
  readonly requestedAt: string;
}) => Promise<{
  readonly created: boolean;
  readonly incidentId?: string;
  readonly error?: string;
}>;

export type CleanupResourceKind =
  | "lease"
  | "secret"
  | "budget_reservation"
  | "plugin_resource"
  | "timer"
  | "hitl_wait"
  | "context_snapshot"
  | "callback";

export interface CleanupResource {
  readonly resourceKind: CleanupResourceKind;
  readonly resourceId: string;
  readonly cleanupRequired: boolean;
}

export interface RunTerminationCleanupRequest {
  readonly runId: string;
  readonly tenantId: string;
  readonly terminalStatus: "completed" | "failed" | "cancelled" | "aborted";
  readonly requestedAt: string;
  readonly resources: readonly CleanupResource[];
  /** R11-08: Optional terminal reason for notifications and compensation */
  readonly terminalReason?: string;
}

export interface RunTerminationCleanupReceipt {
  readonly runId: string;
  readonly tenantId: string;
  readonly terminalStatus: RunTerminationCleanupRequest["terminalStatus"];
  readonly cleanupOrder: readonly CleanupResourceKind[];
  readonly cleanedResourceIds: readonly string[];
  readonly skippedResourceIds: readonly string[];
  readonly failedResourceIds: readonly string[];
  readonly resourceErrors?: readonly {
    readonly resourceId: string;
    readonly resourceKind: string;
    readonly error: string;
  }[];
  readonly completedAt: string;
  /** R11-11: Proper status - partial when there are failures */
  readonly cleanupStatus: "complete" | "partial" | "failed";
  /** R11-08: State evidence flush result */
  readonly stateEvidenceFlush?: {
    readonly flushed: boolean;
    readonly artifactCount: number;
    readonly error?: string;
  };
  /** R11-08: Compensation trigger result */
  readonly compensationTrigger?: {
    readonly triggered: boolean;
    readonly compensationPlanId?: string;
    readonly error?: string;
  };
  /** R11-08: Notification result */
  readonly notification?: {
    readonly sent: boolean;
    readonly notificationId?: string;
    readonly error?: string;
  };
  /** R11-11: Partial/failed cleanup incident escalation result */
  readonly incident?: {
    readonly created: boolean;
    readonly incidentId?: string;
    readonly error?: string;
  };
}

const CLEANUP_ORDER: readonly CleanupResourceKind[] = [
  "lease",
  "secret",
  "budget_reservation",
  "plugin_resource",
  "timer",
  "hitl_wait",
  "context_snapshot",
  "callback",
];

export interface RunTerminationCleanupCallbacks {
  readonly cleanup: Readonly<Record<CleanupResourceKind, CleanupCallback>>;
  readonly cleanupTimeoutMs?: number;
  readonly maxConcurrentCallbacks?: number;
  /** R11-08: Optional state evidence flush callback */
  readonly stateEvidenceFlush?: StateEvidenceFlushCallback;
  /** R11-08: Optional compensation trigger callback */
  readonly compensationTrigger?: CompensationTriggerCallback;
  /** R11-08: Optional notification callback */
  readonly notification?: NotificationCallback;
  /** R17-03: Optional event bus for emitting cleanup events */
  readonly eventBus?: TypedEventBus;
  /** R11-11: Optional incident escalation callback for partial/failed cleanup */
  readonly incident?: CleanupIncidentCallback;
}

export class RunTerminationCleanup {
  /**
   * Performs actual cleanup of a resource by invoking the registered callback.
   * R17-03 fix: This method now performs real cleanup operations (lease release,
   * secret revocation, budget release) by calling the appropriate cleanup callback.
   * Results are classified as cleaned/failed/skipped based on callback response.
   */
  private async performCleanup(
    resource: CleanupResource,
    request: RunTerminationCleanupRequest,
    callbacks: RunTerminationCleanupCallbacks,
    cleanedResourceIds: string[],
    failedResourceIds: string[],
    skippedResourceIds: string[],
    resourceErrors: Array<{
      resourceId: string;
      resourceKind: string;
      error: string;
    }>,
  ): Promise<void> {
    if (!resource.cleanupRequired) {
      skippedResourceIds.push(resource.resourceId);
      return;
    }

    const callback = callbacks.cleanup[resource.resourceKind];
    if (!callback) {
      skippedResourceIds.push(resource.resourceId);
      return;
    }

    try {
      const success = await withTimeout(
        callback({
          resourceId: resource.resourceId,
          tenantId: request.tenantId,
          runId: request.runId,
        }),
        callbacks.cleanupTimeoutMs ?? 30_000,
        `run_cleanup.timeout:${resource.resourceKind}:${resource.resourceId}`,
      );
      if (success) {
        cleanedResourceIds.push(resource.resourceId);
      } else {
        failedResourceIds.push(resource.resourceId);
        resourceErrors.push({
          resourceId: resource.resourceId,
          resourceKind: resource.resourceKind,
          error: "cleanup_callback_returned_false",
        });
      }
    } catch (error) {
      failedResourceIds.push(resource.resourceId);
      resourceErrors.push({
        resourceId: resource.resourceId,
        resourceKind: resource.resourceKind,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * R17-03 fix: Performs actual resource cleanup operations.
   * Each resource kind has a dedicated cleanup callback that handles
   * real cleanup like lease release, secret revocation, budget release, etc.
   * Failures are properly tracked and reflected in cleanupStatus.
   */
  public async execute(
    request: RunTerminationCleanupRequest,
    callbacks: RunTerminationCleanupCallbacks,
    completedAt = request.requestedAt,
  ): Promise<RunTerminationCleanupReceipt> {
    const ordered = [...request.resources].sort((left, right) => (
      cleanupOrderRank(left.resourceKind) - cleanupOrderRank(right.resourceKind)
    ));

    const cleanedResourceIds: string[] = [];
    const skippedResourceIds: string[] = [];
    const failedResourceIds: string[] = [];
    const resourceErrors: Array<{
      resourceId: string;
      resourceKind: string;
      error: string;
    }> = [];

    // Perform actual resource cleanup before compensation so rollback logic only
    // observes post-release resource state.
    const maxConcurrentCallbacks = Math.max(1, Math.trunc(callbacks.maxConcurrentCallbacks ?? 1));
    const resourcesByKind = new Map<CleanupResourceKind, CleanupResource[]>();
    for (const resource of ordered) {
      const existing = resourcesByKind.get(resource.resourceKind) ?? [];
      existing.push(resource);
      resourcesByKind.set(resource.resourceKind, existing);
    }
    for (const resourceKind of CLEANUP_ORDER) {
      const resources = resourcesByKind.get(resourceKind) ?? [];
      await mapWithConcurrency(resources, maxConcurrentCallbacks, async (resource) => {
        await this.performCleanup(
          resource,
          request,
          callbacks,
          cleanedResourceIds,
          failedResourceIds,
          skippedResourceIds,
          resourceErrors,
        );
      });
    }

    // State evidence flush is terminal-audit critical. Keep the error explicit and
    // feed it into cleanupStatus rather than silently collapsing into a best-effort path.
    let stateEvidenceFlushResult: RunTerminationCleanupReceipt["stateEvidenceFlush"];
    if (callbacks.stateEvidenceFlush) {
      try {
        stateEvidenceFlushResult = await withTimeout(
          callbacks.stateEvidenceFlush(request.runId),
          callbacks.cleanupTimeoutMs ?? 30_000,
          `run_cleanup.timeout:state_evidence_flush:${request.runId}`,
        );
      } catch (error) {
        stateEvidenceFlushResult = {
          flushed: false,
          artifactCount: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // Trigger compensation after cleanup so it does not see stale leases/secrets/timers.
    let compensationTriggerResult: RunTerminationCleanupReceipt["compensationTrigger"];
    if (callbacks.compensationTrigger && request.terminalStatus !== "completed") {
      try {
        compensationTriggerResult = await withTimeout(
          callbacks.compensationTrigger(
            request.runId,
            request.terminalReason ?? `run_${request.terminalStatus}`,
          ),
          callbacks.cleanupTimeoutMs ?? 30_000,
          `run_cleanup.timeout:compensation:${request.runId}`,
        );
      } catch (error) {
        compensationTriggerResult = {
          triggered: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // R11-08: Send notification after cleanup
    let notificationResult: RunTerminationCleanupReceipt["notification"];
    if (callbacks.notification) {
      try {
        notificationResult = await withTimeout(
          callbacks.notification({
            runId: request.runId,
            terminalStatus: request.terminalStatus,
            ...(request.terminalReason !== undefined && { reason: request.terminalReason ?? "" }),
          }),
          callbacks.cleanupTimeoutMs ?? 30_000,
          `run_cleanup.timeout:notification:${request.runId}`,
        );
      } catch (error) {
        notificationResult = {
          sent: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // R11-11: Determine proper cleanup status based on results
    const requiredResources = ordered.filter((resource) => resource.cleanupRequired);
    const auxiliaryFailures =
      (stateEvidenceFlushResult?.flushed === false ? 1 : 0)
      + (compensationTriggerResult?.triggered === false ? 1 : 0)
      + (notificationResult?.sent === false ? 1 : 0);
    let cleanupStatus: RunTerminationCleanupReceipt["cleanupStatus"];
    if (failedResourceIds.length === 0 && auxiliaryFailures === 0) {
      cleanupStatus = "complete";
    } else if (cleanedResourceIds.length === 0 && (requiredResources.length > 0 || auxiliaryFailures > 0)) {
      cleanupStatus = "failed";
    } else {
      cleanupStatus = "partial";
    }

    let incidentResult: RunTerminationCleanupReceipt["incident"];
    if (callbacks.incident && cleanupStatus !== "complete") {
      try {
        incidentResult = await callbacks.incident({
          runId: request.runId,
          tenantId: request.tenantId,
          terminalStatus: request.terminalStatus,
          cleanupStatus,
          failedResourceIds,
          cleanedResourceIds,
          requestedAt: request.requestedAt,
        });
      } catch (error) {
        incidentResult = {
          created: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // R11-08/R11-11: Build result with proper optional field handling
    // Include optional fields only when they have values
    const receipt: RunTerminationCleanupReceipt = {
      runId: request.runId,
      tenantId: request.tenantId,
      terminalStatus: request.terminalStatus,
      cleanupOrder: CLEANUP_ORDER,
      cleanedResourceIds,
      skippedResourceIds,
      failedResourceIds,
      ...(resourceErrors.length > 0 ? { resourceErrors } : {}),
      completedAt,
      cleanupStatus,
      ...(stateEvidenceFlushResult !== undefined && { stateEvidenceFlush: stateEvidenceFlushResult }),
      ...(compensationTriggerResult !== undefined && { compensationTrigger: compensationTriggerResult }),
      ...(notificationResult !== undefined && { notification: notificationResult }),
      ...(incidentResult !== undefined && { incident: incidentResult }),
    };

    // R17-03: Emit cleanup events to the event bus
    if (callbacks.eventBus) {
      const occurredAt = nowIso();
      if (cleanupStatus !== "complete") {
        callbacks.eventBus.publish({
          eventType: "run.cleanup_failed",
          payload: {
            runId: request.runId,
            tenantId: request.tenantId,
            terminalStatus: request.terminalStatus,
            cleanedResourceIds,
            failedResourceIds,
            cleanupStatus,
            errorMessage: buildCleanupErrorMessage(cleanupStatus, failedResourceIds, stateEvidenceFlushResult, compensationTriggerResult, notificationResult),
            occurredAt,
          },
        });
      } else {
        callbacks.eventBus.publish({
          eventType: "run.cleanup_completed",
          payload: {
            runId: request.runId,
            tenantId: request.tenantId,
            terminalStatus: request.terminalStatus,
            cleanedResourceIds,
            failedResourceIds,
            cleanupStatus,
            occurredAt,
          },
        });
      }
    }

    return receipt;
  }
}

function cleanupOrderRank(resourceKind: string): number {
  const knownIndex = CLEANUP_ORDER.indexOf(resourceKind as CleanupResourceKind);
  return knownIndex >= 0 ? knownIndex : CLEANUP_ORDER.length;
}

function buildCleanupErrorMessage(
  cleanupStatus: RunTerminationCleanupReceipt["cleanupStatus"],
  failedResourceIds: readonly string[],
  stateEvidenceFlushResult?: RunTerminationCleanupReceipt["stateEvidenceFlush"],
  compensationTriggerResult?: RunTerminationCleanupReceipt["compensationTrigger"],
  notificationResult?: RunTerminationCleanupReceipt["notification"],
): string {
  const parts: string[] = [`Cleanup ${cleanupStatus}`];
  if (failedResourceIds.length > 0) {
    parts.push(`${failedResourceIds.length} resources failed`);
  }
  if (stateEvidenceFlushResult?.flushed === false) {
    parts.push(`state evidence flush failed: ${stateEvidenceFlushResult.error ?? "unknown_error"}`);
  }
  if (compensationTriggerResult?.triggered === false) {
    parts.push(`compensation failed: ${compensationTriggerResult.error ?? "unknown_error"}`);
  }
  if (notificationResult?.sent === false) {
    parts.push(`notification failed: ${notificationResult.error ?? "unknown_error"}`);
  }
  return parts.join("; ");
}

async function mapWithConcurrency<T>(
  items: readonly T[],
  maxConcurrent: number,
  worker: (item: T, index: number) => Promise<void>,
): Promise<void> {
  if (items.length === 0) {
    return;
  }
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(items.length, Math.max(1, maxConcurrent)) }, async () => {
    while (nextIndex < items.length) {
      const current = nextIndex++;
      await worker(items[current]!, current);
    }
  });
  await Promise.all(runners);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  code: string,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => reject(new Error(code)), Math.max(1, timeoutMs));
        timeoutHandle.unref?.();
      }),
    ]);
  } finally {
    if (timeoutHandle != null) {
      clearTimeout(timeoutHandle);
    }
  }
}
