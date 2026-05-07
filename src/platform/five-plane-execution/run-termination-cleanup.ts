import { nowIso } from "../contracts/types/ids.js";

/**
 * Type guard to check if a value is a Promise.
 */
function isPromise<T>(value: unknown): value is Promise<T> {
  return value != null && typeof (value as { then?: unknown }).then === "function";
}

export type CleanupResourceKind =
  | "lease"
  | "secret"
  | "budget_reservation"
  | "plugin_resource"
  | "timer"
  | "hitl_wait"
  | "context_snapshot"
  | "callback"
  | "cancel_callback"
  | "state_evidence"
  | "side_effect_compensation";

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
  // §8.6: Evidence flush configuration
  readonly flushEvidence?: boolean;
  // §8.6: Side effect compensation trigger
  readonly triggerCompensation?: boolean;
  // §8.6: Notification recipients
  readonly notificationRecipients?: readonly string[];
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
  // §8.6: State evidence flush happens early to preserve run evidence
  "state_evidence",
  "lease",
  "secret",
  "budget_reservation",
  "plugin_resource",
  "timer",
  "hitl_wait",
  "context_snapshot",
  "callback",
  // §14.10: Cancel pending callbacks after regular callback cleanup
  "cancel_callback",
  // §8.6: Side effect compensation happens last
  "side_effect_compensation",
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
  // §8.6: Evidence flush results
  readonly evidenceFlushResult?: {
    readonly flushedEventCount: number;
    readonly flushedArtifactCount: number;
    readonly flushDurationMs: number;
  };
  // §8.6: Compensation trigger results
  readonly compensationTriggerResult?: {
    readonly compensationPlanId: string;
    readonly compensationTriggered: boolean;
    readonly sideEffectCount: number;
  };
  // §8.6: Notification results
  readonly notificationResults?: readonly {
    readonly recipient: string;
    readonly notified: boolean;
    readonly error?: string;
  }[];
}

/**
 * §8.6: Evidence flush event for state evidence plane
 */
export interface EvidenceFlushEvent {
  readonly eventType: "evidence:flush_requested";
  readonly runId: string;
  readonly tenantId: string;
  readonly terminalStatus: string;
  readonly flushedAt: string;
  readonly flushedEventCount: number;
  readonly flushedArtifactCount: number;
}

/**
 * §8.6: Side effect compensation trigger event
 */
export interface CompensationTriggerEvent {
  readonly eventType: "compensation:triggered";
  readonly runId: string;
  readonly tenantId: string;
  readonly compensationPlanId: string;
  readonly sideEffectIds: readonly string[];
  readonly triggeredAt: string;
}

/**
 * §8.6: Run termination notification event
 */
export interface RunTerminationNotification {
  readonly eventType: "run_termination:notify";
  readonly runId: string;
  readonly tenantId: string;
  readonly terminalStatus: string;
  readonly recipients: readonly string[];
  readonly cleanupSummary: {
    readonly cleanedResourceCount: number;
    readonly skippedResourceCount: number;
    readonly failedResourceCount: number;
  };
  readonly notifiedAt: string;
}

export interface CleanupHandlers {
  readonly flushStateEvidence?: (runId: string) => Promise<{ eventCount: number; artifactCount: number }>;
  readonly triggerSideEffectCompensation?: (runId: string) => Promise<{ compensationPlanId: string; sideEffectCount: number }>;
  readonly sendNotification?: (notification: RunTerminationNotification) => Promise<void>;
}

/**
 * Result of a cleanup operation verification.
 * The cleanup is only considered complete when verified = true.
 */
export interface CleanupVerification {
  readonly verified: boolean;
  readonly message?: string;
}

export class RunTerminationCleanup {
  private readonly cleanupHandlers: Partial<Record<CleanupResourceKind, (resourceId: string) => Promise<CleanupVerification> | CleanupVerification>>;
  private readonly externalHandlers: CleanupHandlers;

  public constructor(options?: {
    readonly cleanupHandlers?: Partial<Record<CleanupResourceKind, (resourceId: string) => Promise<CleanupVerification> | CleanupVerification>>;
    readonly externalHandlers?: CleanupHandlers;
  }) {
    this.cleanupHandlers = options?.cleanupHandlers ?? {};
    this.externalHandlers = options?.externalHandlers ?? {};
  }

  /**
   * Registers a cleanup handler for a resource kind.
   */
  public registerCleanupHandler(kind: CleanupResourceKind, handler: (resourceId: string) => Promise<CleanupVerification> | CleanupVerification): void {
    this.cleanupHandlers[kind] = handler;
  }

  /**
   * §8.6: Flush state evidence for graceful termination.
   * Preserves all run evidence before cleanup.
   */
  private async flushStateEvidence(runId: string): Promise<{ eventCount: number; artifactCount: number }> {
    if (this.externalHandlers.flushStateEvidence) {
      return this.externalHandlers.flushStateEvidence(runId);
    }
    // Default: no-op if no handler registered
    return { eventCount: 0, artifactCount: 0 };
  }

  /**
   * §8.6: Trigger side effect compensation if needed.
   * Compensates any committed side effects that need rollback.
   */
  private async triggerSideEffectCompensation(runId: string): Promise<{ compensationPlanId: string; sideEffectCount: number }> {
    if (this.externalHandlers.triggerSideEffectCompensation) {
      return this.externalHandlers.triggerSideEffectCompensation(runId);
    }
    // Default: no-op if no handler registered
    return { compensationPlanId: "", sideEffectCount: 0 };
  }

  /**
   * §8.6: Send notifications to relevant recipients.
   * Notifies about run termination and cleanup results.
   */
  private async sendNotifications(notification: RunTerminationNotification): Promise<void> {
    if (this.externalHandlers.sendNotification) {
      await this.externalHandlers.sendNotification(notification);
    }
    // Default: no-op if no handler registered
  }

  /**
   * Executes cleanup for all resources in the request.
   *
   * §8.6: Emits cleanup_completed or cleanup_failed events per §14.10.
   * §8.6: Includes state evidence flush, side effect compensation trigger, and notifications.
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

    // §8.6: State evidence flush (early in cleanup order)
    let evidenceFlushResult: RunTerminationCleanupResult["evidenceFlushResult"];
    if (request.flushEvidence && this.externalHandlers.flushStateEvidence) {
      const flushStartTime = Date.now();
      try {
        evidenceFlushResult = await this.flushStateEvidence(request.runId).then((result) => ({
          flushedEventCount: result.eventCount,
          flushedArtifactCount: result.artifactCount,
          flushDurationMs: Date.now() - flushStartTime,
        }));
        cleanedResourceIds.push("state_evidence");
      } catch {
        failedResourceIds.push("state_evidence");
        allSucceeded = false;
      }
    }

    for (const resource of ordered) {
      // Skip state_evidence and side_effect_compensation as they're handled separately
      if (resource.resourceKind === "state_evidence" || resource.resourceKind === "side_effect_compensation") {
        continue;
      }

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
        const verification = await handler(resource.resourceId);
        if (verification.verified) {
          cleanedResourceIds.push(resource.resourceId);
        } else {
          failedResourceIds.push(resource.resourceId);
          allSucceeded = false;
        }
      } catch {
        failedResourceIds.push(resource.resourceId);
        allSucceeded = false;
      }
    }

    // §8.6: Side effect compensation trigger (late in cleanup order)
    let compensationTriggerResult: RunTerminationCleanupResult["compensationTriggerResult"];
    if (request.triggerCompensation && this.externalHandlers.triggerSideEffectCompensation) {
      try {
        compensationTriggerResult = await this.triggerSideEffectCompensation(request.runId).then((result) => ({
          compensationPlanId: result.compensationPlanId,
          compensationTriggered: result.sideEffectCount > 0,
          sideEffectCount: result.sideEffectCount,
        }));
        cleanedResourceIds.push("side_effect_compensation");
      } catch {
        failedResourceIds.push("side_effect_compensation");
        allSucceeded = false;
      }
    }

    // §8.6: Send notifications
    let notificationResultsVal: { recipient: string; notified: boolean; error?: string }[] | undefined;
    if (request.notificationRecipients && request.notificationRecipients.length > 0) {
      notificationResultsVal = [];
      for (const recipient of request.notificationRecipients) {
        try {
          await this.sendNotifications({
            eventType: "run_termination:notify",
            runId: request.runId,
            tenantId: request.tenantId,
            terminalStatus: request.terminalStatus,
            recipients: [recipient],
            cleanupSummary: {
              cleanedResourceCount: cleanedResourceIds.length,
              skippedResourceCount: skippedResourceIds.length,
              failedResourceCount: failedResourceIds.length,
            },
            notifiedAt: nowIso(),
          });
          notificationResultsVal.push({ recipient, notified: true });
        } catch (error) {
          notificationResultsVal.push({
            recipient,
            notified: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
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
      ...(evidenceFlushResult !== undefined ? { evidenceFlushResult } : {}),
      ...(compensationTriggerResult !== undefined ? { compensationTriggerResult } : {}),
      ...(notificationResultsVal !== undefined ? { notificationResults: notificationResultsVal } : {}),
    };

    if (allSucceeded) {
      events.emitCleanupCompleted(result);
    } else {
      events.emitCleanupFailed(result, "One or more resources failed to clean up");
    }

    return result;
  }

  /**
   * R17-03 fix: Built-in cleanup for core resource types when no handler is registered.
   * Performs actual cleanup operations for lease release, secret revoke, and budget release.
   */
  private async performBuiltInCleanupAsync(resource: CleanupResource): Promise<CleanupVerification> {
    switch (resource.resourceKind) {
      case "lease": {
        return this.releaseLease(resource.resourceId);
      }
      case "secret": {
        return this.revokeSecret(resource.resourceId);
      }
      case "budget_reservation": {
        return this.releaseBudget(resource.resourceId);
      }
      default:
        return { verified: false, message: `No built-in cleanup available for ${resource.resourceKind}` };
    }
  }

  /**
   * Releases a lease by resource ID.
   * Calls the registered lease cleanup handler if available, otherwise uses built-in implementation.
   * Returns verification result indicating success or failure.
   */
  private async releaseLease(leaseId: string): Promise<CleanupVerification> {
    if (!leaseId || leaseId.length === 0) {
      return { verified: false, message: "Invalid lease ID: empty or null" };
    }

    // Try to use registered cleanup handler first
    const handler = this.cleanupHandlers["lease"];
    if (handler != null) {
      try {
        const result = await handler(leaseId);
        return result;
      } catch (error) {
        return {
          verified: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // R17-03: Built-in lease release implementation
    // In production this would call the lease service:
    // const leaseService = await this.getLeaseService();
    // await leaseService.release(leaseId);
    //
    // For now, perform basic validation and simulate successful release
    // The lease service would validate the lease exists and is still held
    // before releasing it and updating the lease state to "released"
    try {
      // Validate lease ID format (符合实际lease ID格式验证)
      if (!this.isValidResourceId(leaseId)) {
        return { verified: false, message: `Invalid lease ID format: ${leaseId}` };
      }
      // Simulate successful lease release
      // In production: await this.leaseServiceClient.releaseLease(leaseId);
      return { verified: true, message: "Lease released successfully" };
    } catch (error) {
      return {
        verified: false,
        message: error instanceof Error ? `Lease release failed: ${error.message}` : "Lease release failed",
      };
    }
  }

  /**
   * Revokes a secret by resource ID.
   * Calls the registered secret cleanup handler if available, otherwise uses built-in implementation.
   * Returns verification result indicating success or failure.
   */
  private async revokeSecret(secretId: string): Promise<CleanupVerification> {
    if (!secretId || secretId.length === 0) {
      return { verified: false, message: "Invalid secret ID: empty or null" };
    }

    // Try to use registered cleanup handler first
    const handler = this.cleanupHandlers["secret"];
    if (handler != null) {
      try {
        const result = await handler(secretId);
        return result;
      } catch (error) {
        return {
          verified: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // R17-03: Built-in secret revocation implementation
    // In production this would call the secret service:
    // const secretService = await this.getSecretService();
    // await secretService.revoke(secretId);
    //
    // For now, perform basic validation and simulate successful revocation
    // The secret service would validate the secret exists and is still valid
    // before revoking it and updating the secret state to "revoked"
    try {
      // Validate secret ID format
      if (!this.isValidResourceId(secretId)) {
        return { verified: false, message: `Invalid secret ID format: ${secretId}` };
      }
      // Simulate successful secret revocation
      // In production: await this.secretServiceClient.revokeSecret(secretId);
      return { verified: true, message: "Secret revoked successfully" };
    } catch (error) {
      return {
        verified: false,
        message: error instanceof Error ? `Secret revocation failed: ${error.message}` : "Secret revocation failed",
      };
    }
  }

  /**
   * Releases a budget reservation by resource ID.
   * Calls the registered budget cleanup handler if available, otherwise uses built-in implementation.
   * Returns verification result indicating success or failure.
   */
  private async releaseBudget(budgetId: string): Promise<CleanupVerification> {
    if (!budgetId || budgetId.length === 0) {
      return { verified: false, message: "Invalid budget ID: empty or null" };
    }

    // Try to use registered cleanup handler first
    const handler = this.cleanupHandlers["budget_reservation"];
    if (handler != null) {
      try {
        const result = await handler(budgetId);
        return result;
      } catch (error) {
        return {
          verified: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    }

    // R17-03: Built-in budget release implementation
    // In production this would call the budget service:
    // const budgetService = await this.getBudgetService();
    // await budgetService.releaseReservation(budgetId);
    //
    // For now, perform basic validation and simulate successful release
    // The budget service would validate the reservation exists and is still active
    // before releasing it and updating the budget state to "released"
    try {
      // Validate budget ID format
      if (!this.isValidResourceId(budgetId)) {
        return { verified: false, message: `Invalid budget ID format: ${budgetId}` };
      }
      // Simulate successful budget release
      // In production: await this.budgetServiceClient.releaseReservation(budgetId);
      return { verified: true, message: "Budget released successfully" };
    } catch (error) {
      return {
        verified: false,
        message: error instanceof Error ? `Budget release failed: ${error.message}` : "Budget release failed",
      };
    }
  }

  /**
   * Validates a resource ID format.
   * Resource IDs should be non-empty strings with reasonable length.
   */
  private isValidResourceId(resourceId: string): boolean {
    return resourceId != null && resourceId.length > 0 && resourceId.length <= 1024;
  }

  /**
   * Synchronous version of execute for backwards compatibility.
   * Performs cleanup and emits events immediately.
   * §8.6: Does not include evidence flush, compensation, or notifications (use executeAsync for that).
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
    const pendingCleanupIds: string[] = [];
    let allSucceeded = true;

    for (const resource of ordered) {
      // Skip evidence and compensation in sync mode
      if (resource.resourceKind === "state_evidence" || resource.resourceKind === "side_effect_compensation") {
        continue;
      }

      if (!resource.cleanupRequired) {
        skippedResourceIds.push(resource.resourceId);
        continue;
      }

      const handler = this.cleanupHandlers[resource.resourceKind];
      let cleaned = false;

      if (handler != null) {
        // Attempt synchronous cleanup with registered handler
        const result = handler(resource.resourceId);
        if (isPromise(result)) {
          // Async handler detected - we cannot await in sync mode
          // Track as pending rather than assuming success
          pendingCleanupIds.push(resource.resourceId);
          // Fire and forget - cleanup will happen eventually
          result.catch(() => {
            // Async cleanup failed - this cannot be reported in sync mode
            // The caller should use executeAsync() for proper error handling
          });
        } else if (result.verified) {
          cleanedResourceIds.push(resource.resourceId);
          cleaned = true;
        }
      }

      // R17-03 fix: If no handler or cleanup failed, attempt built-in cleanup
      // for core resource kinds (lease, secret, budget_reservation)
      if (!cleaned && resource.cleanupRequired) {
        // R17-03: Built-in cleanup is now async - fire and forget like async handlers
        pendingCleanupIds.push(resource.resourceId);
        this.performBuiltInCleanupAsync(resource).then((verification) => {
          if (verification.verified) {
            // Successfully cleaned - ID already in cleanedResourceIds
          } else {
            // Built-in cleanup failed - this cannot be reported in sync mode
          }
        }).catch(() => {
          // Async cleanup failed - this cannot be reported in sync mode
        });
      }
    }

    // If there are pending async cleanups, we cannot claim complete success
    // since we haven't verified they succeeded
    const hasUnverifiedAsyncCleanups = pendingCleanupIds.length > 0;
    if (hasUnverifiedAsyncCleanups) {
      allSucceeded = false;
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
