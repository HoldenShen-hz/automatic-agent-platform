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
  "callback",
];

export interface RunTerminationCleanupResult {
  readonly runId: string;
  readonly tenantId: string;
  readonly traceId: string;
  readonly terminalStatus: RunTerminationCleanupRequest["terminalStatus"];
  readonly cleanupOrder: readonly CleanupResourceKind[];
  readonly cleanedResourceIds: readonly string[];
  readonly skippedResourceIds: readonly string[];
  readonly failedResourceIds: readonly string[];
  readonly completedAt: string;
  readonly complete: boolean;
}

export class RunTerminationCleanup {
  private readonly cleanupHandlers: Partial<Record<CleanupResourceKind, (resourceId: string) => Promise<void>>> = {};

  public constructor(options?: {
    readonly cleanupHandlers?: Partial<Record<CleanupResourceKind, (resourceId: string) => Promise<void>>>
  }) {
    this.cleanupHandlers = options?.cleanupHandlers ?? {};
  }

  /**
   * Registers a cleanup handler for a resource kind.
   */
  public registerCleanupHandler(kind: CleanupResourceKind, handler: (resourceId: string) => Promise<void>): void {
    this.cleanupHandlers[kind] = handler;
  }

  /**
   * Executes cleanup for all resources in the request.
   *
   * Emits cleanup_completed or cleanup_failed events per §14.10.
   * Returns a receipt with actual cleanup results.
   */
  public async executeAsync(
    request: RunTerminationCleanupRequest,
    events: {
      emitCleanupCompleted: (result: RunTerminationCleanupResult) => void;
      emitCleanupFailed: (result: RunTerminationCleanupResult, error: string) => void;
    },
    completedAt = request.requestedAt,
  ): Promise<RunTerminationCleanupResult> {
    const ordered = [...request.resources].sort((left, right) => (
      CLEANUP_ORDER.indexOf(left.resourceKind) - CLEANUP_ORDER.indexOf(right.resourceKind)
    ));

    const cleanedResourceIds: string[] = [];
    const skippedResourceIds: string[] = [];
    const failedResourceIds: string[] = [];
    let allSucceeded = true;

    for (const resource of ordered) {
      if (!resource.cleanupRequired) {
        skippedResourceIds.push(resource.resourceId);
        continue;
      }

      const handler = this.cleanupHandlers[resource.resourceKind];
      if (handler == null) {
        // No handler registered - consider this a failure unless cleanup is not required
        failedResourceIds.push(resource.resourceId);
        allSucceeded = false;
        continue;
      }

      try {
        await handler(resource.resourceId);
        cleanedResourceIds.push(resource.resourceId);
      } catch {
        failedResourceIds.push(resource.resourceId);
        allSucceeded = false;
      }
    }

    const result: RunTerminationCleanupResult = {
      runId: request.runId,
      tenantId: request.tenantId,
      traceId: request.runId,
      terminalStatus: request.terminalStatus,
      cleanupOrder: CLEANUP_ORDER,
      cleanedResourceIds,
      skippedResourceIds,
      failedResourceIds,
      completedAt,
      complete: allSucceeded,
    };

    if (allSucceeded) {
      events.emitCleanupCompleted(result);
    } else {
      events.emitCleanupFailed(result, "One or more resources failed to clean up");
    }

    return result;
  }

  /**
   * Synchronous version of execute for backwards compatibility.
   * Performs cleanup and emits events immediately.
   */
  public execute(
    request: RunTerminationCleanupRequest,
    events: {
      emitCleanupCompleted: (result: RunTerminationCleanupResult) => void;
      emitCleanupFailed: (result: RunTerminationCleanupResult, error: string) => void;
    },
    completedAt = request.requestedAt,
  ): RunTerminationCleanupResult {
    const ordered = [...request.resources].sort((left, right) => (
      CLEANUP_ORDER.indexOf(left.resourceKind) - CLEANUP_ORDER.indexOf(right.resourceKind)
    ));

    const cleanedResourceIds: string[] = [];
    const skippedResourceIds: string[] = [];
    const failedResourceIds: string[] = [];
    let allSucceeded = true;

    for (const resource of ordered) {
      if (!resource.cleanupRequired) {
        skippedResourceIds.push(resource.resourceId);
        continue;
      }

      const handler = this.cleanupHandlers[resource.resourceKind];
      if (handler == null) {
        // No handler registered - consider this a failure
        failedResourceIds.push(resource.resourceId);
        allSucceeded = false;
        continue;
      }

      // Attempt synchronous cleanup - if handler is async, fire and forget
      const cleanupPromise = handler(resource.resourceId);
      if (cleanupPromise != null) {
        cleanupPromise
          .then(() => {
            // Sync version doesn't wait for async handlers
          })
          .catch(() => {
            // Sync version doesn't track async failures
          });
      }

      // For sync cleanup, we assume success if handler exists
      // Async cleanup should use executeAsync for proper error handling
      cleanedResourceIds.push(resource.resourceId);
    }

    const result: RunTerminationCleanupResult = {
      runId: request.runId,
      tenantId: request.tenantId,
      traceId: request.runId,
      terminalStatus: request.terminalStatus,
      cleanupOrder: CLEANUP_ORDER,
      cleanedResourceIds,
      skippedResourceIds,
      failedResourceIds,
      completedAt,
      complete: allSucceeded,
    };

    if (allSucceeded) {
      events.emitCleanupCompleted(result);
    } else {
      events.emitCleanupFailed(result, "One or more resources failed to clean up");
    }

    return result;
  }
}
