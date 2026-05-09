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

export type CleanupResourceKind =
  | "lease"
  | "secret"
  | "budget_reservation"
  | "plugin_resource"
  | "timer"
  | "hitl_wait"
  | "context_snapshot";

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
}

const CLEANUP_ORDER: readonly CleanupResourceKind[] = [
  "lease",
  "secret",
  "budget_reservation",
  "plugin_resource",
  "timer",
  "hitl_wait",
  "context_snapshot",
];

export interface RunTerminationCleanupCallbacks {
  readonly cleanup: Readonly<Record<CleanupResourceKind, CleanupCallback>>;
  /** R11-08: Optional state evidence flush callback */
  readonly stateEvidenceFlush?: StateEvidenceFlushCallback;
  /** R11-08: Optional compensation trigger callback */
  readonly compensationTrigger?: CompensationTriggerCallback;
  /** R11-08: Optional notification callback */
  readonly notification?: NotificationCallback;
}

export class RunTerminationCleanup {
  public async execute(
    request: RunTerminationCleanupRequest,
    callbacks: RunTerminationCleanupCallbacks,
    completedAt = request.requestedAt,
  ): Promise<RunTerminationCleanupReceipt> {
    const ordered = [...request.resources].sort((left, right) => (
      CLEANUP_ORDER.indexOf(left.resourceKind) - CLEANUP_ORDER.indexOf(right.resourceKind)
    ));

    const cleanedResourceIds: string[] = [];
    const skippedResourceIds: string[] = [];
    const failedResourceIds: string[] = [];

    // R11-08: Perform state evidence flush first (before resource cleanup)
    let stateEvidenceFlushResult: RunTerminationCleanupReceipt["stateEvidenceFlush"];
    if (callbacks.stateEvidenceFlush) {
      try {
        stateEvidenceFlushResult = await callbacks.stateEvidenceFlush(request.runId);
      } catch (error) {
        stateEvidenceFlushResult = {
          flushed: false,
          artifactCount: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // R11-08: Trigger compensation if run failed/cancelled/aborted
    let compensationTriggerResult: RunTerminationCleanupReceipt["compensationTrigger"];
    if (callbacks.compensationTrigger && request.terminalStatus !== "completed") {
      try {
        compensationTriggerResult = await callbacks.compensationTrigger(
          request.runId,
          request.terminalReason ?? `run_${request.terminalStatus}`
        );
      } catch (error) {
        compensationTriggerResult = {
          triggered: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // Clean up resources in order
    for (const resource of ordered) {
      if (!resource.cleanupRequired) {
        skippedResourceIds.push(resource.resourceId);
        continue;
      }

      const callback = callbacks.cleanup[resource.resourceKind];
      if (!callback) {
        skippedResourceIds.push(resource.resourceId);
        continue;
      }

      try {
        const success = await callback({
          resourceId: resource.resourceId,
          tenantId: request.tenantId,
          runId: request.runId,
        });
        if (success) {
          cleanedResourceIds.push(resource.resourceId);
        } else {
          failedResourceIds.push(resource.resourceId);
        }
      } catch {
        failedResourceIds.push(resource.resourceId);
      }
    }

    // R11-08: Send notification after cleanup
    let notificationResult: RunTerminationCleanupReceipt["notification"];
    if (callbacks.notification) {
      try {
        notificationResult = await callbacks.notification({
          runId: request.runId,
          terminalStatus: request.terminalStatus,
          ...(request.terminalReason !== undefined && { reason: request.terminalReason ?? "" }),
        });
      } catch (error) {
        notificationResult = {
          sent: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // R11-11: Determine proper cleanup status based on results
    let cleanupStatus: RunTerminationCleanupReceipt["cleanupStatus"] = "complete";
    if (failedResourceIds.length > 0) {
      cleanupStatus = "partial";
    }
    if (stateEvidenceFlushResult?.flushed === false || compensationTriggerResult?.triggered === false) {
      cleanupStatus = "partial";
    }
    if (failedResourceIds.length > ordered.length / 2) {
      cleanupStatus = "failed";
    }

    // R11-08/R11-11: Build result with proper optional field handling
    // Include optional fields only when they have values
    return {
      runId: request.runId,
      tenantId: request.tenantId,
      terminalStatus: request.terminalStatus,
      cleanupOrder: CLEANUP_ORDER,
      cleanedResourceIds,
      skippedResourceIds,
      failedResourceIds,
      completedAt,
      cleanupStatus,
      ...(stateEvidenceFlushResult !== undefined && { stateEvidenceFlush: stateEvidenceFlushResult }),
      ...(compensationTriggerResult !== undefined && { compensationTrigger: compensationTriggerResult }),
      ...(notificationResult !== undefined && { notification: notificationResult }),
    };
  }
}
