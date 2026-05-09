export type CleanupCallback = (resourceId: string) => Promise<boolean>;

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
  readonly complete: boolean;
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

export class RunTerminationCleanup {
  public async execute(
    request: RunTerminationCleanupRequest,
    callbacks: Readonly<Record<CleanupResourceKind, CleanupCallback>>,
    completedAt = request.requestedAt,
  ): Promise<RunTerminationCleanupReceipt> {
    const ordered = [...request.resources].sort((left, right) => (
      CLEANUP_ORDER.indexOf(left.resourceKind) - CLEANUP_ORDER.indexOf(right.resourceKind)
    ));

    const cleanedResourceIds: string[] = [];
    const skippedResourceIds: string[] = [];
    const failedResourceIds: string[] = [];

    for (const resource of ordered) {
      if (!resource.cleanupRequired) {
        skippedResourceIds.push(resource.resourceId);
        continue;
      }

      const callback = callbacks[resource.resourceKind];
      if (!callback) {
        skippedResourceIds.push(resource.resourceId);
        continue;
      }

      try {
        const success = await callback(resource.resourceId);
        if (success) {
          cleanedResourceIds.push(resource.resourceId);
        } else {
          failedResourceIds.push(resource.resourceId);
        }
      } catch {
        failedResourceIds.push(resource.resourceId);
      }
    }

    return {
      runId: request.runId,
      tenantId: request.tenantId,
      terminalStatus: request.terminalStatus,
      cleanupOrder: CLEANUP_ORDER,
      cleanedResourceIds,
      skippedResourceIds,
      failedResourceIds,
      completedAt,
      complete: failedResourceIds.length === 0,
    };
  }
}
