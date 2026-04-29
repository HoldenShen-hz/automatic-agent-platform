/**
 * Billing Admin Service
 *
 * Per §53.3: Provides administrative operations for billing with read-only mode support.
 * Operations that modify billing data are blocked when read-only mode is enabled,
 * ensuring audit trails are not mixed with write transactions.
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { MonetizationError } from "../../platform/contracts/errors.js";

/**
 * Read-only mode configuration for billing admin operations.
 */
export interface BillingAdminOptions {
  readonly readOnlyMode?: boolean;
}

/**
 * Billing admin operations result.
 */
export interface BillingAdminResult<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly errorMessage: string | null;
}

/**
 * Audit log entry for admin operations.
 */
export interface BillingAdminAuditEntry {
  readonly auditId: string;
  readonly operation: string;
  readonly performedBy: string;
  readonly performedAt: string;
  readonly targetAccountId: string | null;
  readonly details: Record<string, unknown>;
  readonly readOnlyMode: boolean;
}

/**
 * Billing Admin Service
 *
 * Per §53.3: Provides read-only mode to prevent write operations during audit reviews.
 * All mutating operations are blocked when readOnlyMode is true.
 */
export class BillingAdminService {
  private readonly readOnlyMode: boolean;
  private readonly auditLog: BillingAdminAuditEntry[] = [];

  public constructor(options: BillingAdminOptions = {}) {
    this.readOnlyMode = options.readOnlyMode ?? false;
  }

  /**
   * Check if read-only mode is enabled.
   */
  public isReadOnlyMode(): boolean {
    return this.readOnlyMode;
  }

  /**
   * Generic method to execute admin operations with read-only guard.
   * §53.3: All write operations are blocked when readOnlyMode is true.
   */
  public executeReadOnlyOperation<T>(
    operation: () => T,
    operationName: string,
    targetAccountId: string | null = null,
  ): BillingAdminResult<T> {
    // §53.3: Block write operations in read-only mode
    if (this.readOnlyMode) {
      const auditEntry: BillingAdminAuditEntry = {
        auditId: newId("audit"),
        operation: operationName,
        performedBy: "system",
        performedAt: nowIso(),
        targetAccountId,
        details: { blocked: true, reason: "read_only_mode_enabled" },
        readOnlyMode: true,
      };
      this.auditLog.push(auditEntry);

      return {
        success: false,
        data: null,
        errorMessage: `Operation '${operationName}' blocked: billing admin is in read-only mode`,
      };
    }

    try {
      const result = operation();
      const auditEntry: BillingAdminAuditEntry = {
        auditId: newId("audit"),
        operation: operationName,
        performedBy: "admin",
        performedAt: nowIso(),
        targetAccountId,
        details: { success: true },
        readOnlyMode: false,
      };
      this.auditLog.push(auditEntry);

      return {
        success: true,
        data: result,
        errorMessage: null,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const auditEntry: BillingAdminAuditEntry = {
        auditId: newId("audit"),
        operation: operationName,
        performedBy: "admin",
        performedAt: nowIso(),
        targetAccountId,
        details: { success: false, error: errorMessage },
        readOnlyMode: false,
      };
      this.auditLog.push(auditEntry);

      return {
        success: false,
        data: null,
        errorMessage,
      };
    }
  }

  /**
   * Get audit log entries for review.
   */
  public getAuditLog(limit = 100): readonly BillingAdminAuditEntry[] {
    return [...this.auditLog]
      .sort((left, right) => right.performedAt.localeCompare(left.performedAt))
      .slice(0, Math.max(0, limit));
  }

  /**
   * Clear audit log (requires explicit action, respects read-only mode for data but not for log management).
   */
  public clearAuditLog(): BillingAdminResult<void> {
    return this.executeReadOnlyOperation(
      () => {
        this.auditLog.length = 0;
      },
      "clear_audit_log",
      null,
    );
  }
}
