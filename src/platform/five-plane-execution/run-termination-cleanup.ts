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
  public execute(request: RunTerminationCleanupRequest, completedAt = request.requestedAt): RunTerminationCleanupReceipt {
    const ordered = [...request.resources].sort((left, right) => (
      CLEANUP_ORDER.indexOf(left.resourceKind) - CLEANUP_ORDER.indexOf(right.resourceKind)
    ));
    const cleanedResourceIds = ordered
      .filter((resource) => resource.cleanupRequired)
      .map((resource) => resource.resourceId);
    const skippedResourceIds = ordered
      .filter((resource) => !resource.cleanupRequired)
      .map((resource) => resource.resourceId);

    return {
      runId: request.runId,
      tenantId: request.tenantId,
      terminalStatus: request.terminalStatus,
      cleanupOrder: CLEANUP_ORDER,
      cleanedResourceIds,
      skippedResourceIds,
      completedAt,
      complete: true,
    };
  }
}
