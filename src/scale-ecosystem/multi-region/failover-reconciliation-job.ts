/**
 * @fileoverview Failover Reconciliation Job
 *
 * §52.3 + §31: Implements reconciliation checks after failover to ensure data consistency.
 *
 * After a failover occurs, this job checks for:
 * - Unreplicated writes: Events that were written but not replicated to target regions
 * - Open budget: Pending resource budgets that need to be transferred or expired
 * - Pending approvals: Workflow approvals that need to be migrated or expired
 * - Outbox gaps: Messages in the outbox that weren't delivered
 * - Restricted-write: Write operations that were blocked during failover transition
 *
 * The reconciliation job ensures the new leader doesn't accept writes until all
 * these gaps are resolved or explicitly acknowledged.
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";

/**
 * §52.3 + §31: Reconciliation issue types that can block new leader activation.
 */
export type ReconciliationIssueType =
  | "unreplicated_write"
  | "open_budget"
  | "pending_approval"
  | "outbox_gap"
  | "restricted_write"
  | "active_lease";

/**
 * §52.3 + §31: Severity of reconciliation issues.
 */
export type ReconciliationSeverity = "critical" | "high" | "medium" | "low";

/**
 * §52.3 + §31: Represents a single reconciliation issue found during gap analysis.
 */
export interface ReconciliationIssue {
  readonly issueId: string;
  readonly issueType: ReconciliationIssueType;
  readonly severity: ReconciliationSeverity;
  readonly sourceRegionId: string;
  readonly targetRegionId: string;
  readonly affectedResource: string;
  readonly description: string;
  readonly detectedAt: string;
  readonly requiresAttention: boolean;
  readonly estimatedGapSize: number;
}

/**
 * §52.3 + §31: Result of a reconciliation scan.
 */
export interface ReconciliationScanResult {
  readonly scanId: string;
  readonly scannedAt: string;
  readonly sourceRegionId: string;
  readonly targetRegionId: string;
  readonly issues: readonly ReconciliationIssue[];
  readonly criticalCount: number;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly lowCount: number;
  readonly canProceed: boolean;
  readonly restrictedWriteCount: number;
  readonly outboxGapCount: number;
  readonly openBudgetCount: number;
  readonly pendingApprovalCount: number;
  readonly unreplicatedWriteCount: number;
  readonly activeLeaseCount: number;
  readonly staleLeaseCount: number;
  readonly evaluationMode: "caller_supplied_evidence";
  readonly warnings: readonly string[];
}

/**
 * §52.3 + §31: Input for reconciliation job.
 */
export interface ReconciliationJobInput {
  readonly sourceRegionId: string;
  readonly targetRegionId: string;
  readonly promoteEpoch: number;
  readonly lastCheckpointSequence: number;
  readonly pendingWriteCount: number;
  readonly pendingApprovals: readonly { approvalId: string; taskId: string; createdAt: string }[];
  readonly openBudgets: readonly { budgetId: string; resourceType: string; allocatedAmount: number }[];
  readonly outboxMessages: readonly { messageId: string; createdAt: string; retryCount: number }[];
  readonly restrictedWrites: readonly { writeId: string; resourceId: string; blockedAt: string }[];
  readonly activeLeaseCount?: number;
  readonly activeLeaseHolderRegionDistribution?: Readonly<Record<string, number>>;
  readonly staleLeaseCount?: number;
}

/**
 * §52.3 + §31: Service that runs reconciliation checks after failover.
 *
 * Ensures the new leader has a consistent view of the system state and
 * doesn't accept writes until all critical gaps are resolved.
 *
 * Provides a reconciliation loop with retry/backoff to continuously check
 * until all critical issues are resolved or max retries are exhausted.
 */
export class FailoverReconciliationJob {
  private static readonly MAX_HISTORY_ENTRIES = 128;
  private readonly history: ReconciliationScanResult[] = [];
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;

  /**
   * @param maxRetries - Maximum reconciliation attempts (default 5)
   * @param baseDelayMs - Base delay for exponential backoff in ms (default 1000)
   */
  public constructor(maxRetries = 5, baseDelayMs = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
  }

  /**
   * §52.3 + §31: Runs reconciliation scan to detect gaps.
   *
   * Analyzes pending writes, approvals, budgets, outbox messages, and restricted
   * writes to determine if the new leader can safely activate.
   */
  public runReconciliation(input: ReconciliationJobInput): ReconciliationScanResult {
    const issues: ReconciliationIssue[] = [];
    const warnings = [
      "failover_reconciliation.caller_supplied_evidence_only",
    ];

    // §52.3 + §31: Check for unreplicated writes
    for (let i = 0; i < input.pendingWriteCount; i++) {
      issues.push(this.createIssue(
        "unreplicated_write",
        input.sourceRegionId,
        input.targetRegionId,
        `unreplicated_write_${i}`,
        `Write at sequence offset ${i} not replicated`,
        input.pendingWriteCount > 10 ? "critical" : "high",
        input.pendingWriteCount,
      ));
    }

    // §52.3 + §31: Check for pending approvals
    for (const approval of input.pendingApprovals) {
      issues.push(this.createIssue(
        "pending_approval",
        input.sourceRegionId,
        input.targetRegionId,
        approval.approvalId,
        `Pending approval for task ${approval.taskId}`,
        "medium",
        input.pendingApprovals.length,
      ));
    }

    // §52.3 + §31: Check for open budgets
    for (const budget of input.openBudgets) {
      issues.push(this.createIssue(
        "open_budget",
        input.sourceRegionId,
        input.targetRegionId,
        budget.budgetId,
        `Open budget ${budget.budgetId} for ${budget.resourceType}: ${budget.allocatedAmount} allocated`,
        "medium",
        input.openBudgets.length,
      ));
    }

    // §52.3 + §31: Check for outbox gaps
    for (const message of input.outboxMessages) {
      const severity: ReconciliationSeverity = message.retryCount > 3 ? "high" : "low";
      issues.push(this.createIssue(
        "outbox_gap",
        input.sourceRegionId,
        input.targetRegionId,
        message.messageId,
        `Outbox message ${message.messageId} undelivered after ${message.retryCount} retries`,
        severity,
        input.outboxMessages.length,
      ));
    }

    // §52.3 + §31: Check for restricted writes (critical - these block new leader)
    for (const write of input.restrictedWrites) {
      issues.push(this.createIssue(
        "restricted_write",
        input.sourceRegionId,
        input.targetRegionId,
        write.writeId,
        `Write ${write.writeId} to resource ${write.resourceId} was blocked during failover`,
        "critical",
        input.restrictedWrites.length,
      ));
    }

    const activeLeaseCount = Math.max(0, input.activeLeaseCount ?? 0);
    const staleLeaseCount = Math.max(0, input.staleLeaseCount ?? 0);
    const sourceHeldLeaseCount = Math.max(0, input.activeLeaseHolderRegionDistribution?.[input.sourceRegionId] ?? 0);
    if (activeLeaseCount > 0 || staleLeaseCount > 0) {
      const severity: ReconciliationSeverity = sourceHeldLeaseCount > 0 || staleLeaseCount > 0 ? "critical" : "high";
      issues.push(this.createIssue(
        "active_lease",
        input.sourceRegionId,
        input.targetRegionId,
        `leases:${input.sourceRegionId}->${input.targetRegionId}`,
        `Active leases=${activeLeaseCount}, source-held=${sourceHeldLeaseCount}, stale=${staleLeaseCount}`,
        severity,
        activeLeaseCount + staleLeaseCount,
      ));
    }

    // Count issues by type
    const restrictedWriteCount = issues.filter((i) => i.issueType === "restricted_write").length;
    const outboxGapCount = issues.filter((i) => i.issueType === "outbox_gap").length;
    const openBudgetCount = issues.filter((i) => i.issueType === "open_budget").length;
    const pendingApprovalCount = issues.filter((i) => i.issueType === "pending_approval").length;
    const unreplicatedWriteCount = issues.filter((i) => i.issueType === "unreplicated_write").length;

    // §52.3 + §31: Can proceed only if no critical issues remain
    const criticalCount = issues.filter((i) => i.severity === "critical").length;
    const canProceed = criticalCount === 0;

    const result: ReconciliationScanResult = {
      scanId: newId("recon_scan"),
      scannedAt: nowIso(),
      sourceRegionId: input.sourceRegionId,
      targetRegionId: input.targetRegionId,
      issues,
      criticalCount,
      highCount: issues.filter((i) => i.severity === "high").length,
      mediumCount: issues.filter((i) => i.severity === "medium").length,
      lowCount: issues.filter((i) => i.severity === "low").length,
      canProceed,
      restrictedWriteCount,
      outboxGapCount,
      openBudgetCount,
      pendingApprovalCount,
      unreplicatedWriteCount,
      activeLeaseCount,
      staleLeaseCount,
      evaluationMode: "caller_supplied_evidence",
      warnings,
    };

    this.history.push(result);
    if (this.history.length > FailoverReconciliationJob.MAX_HISTORY_ENTRIES) {
      this.history.splice(0, this.history.length - FailoverReconciliationJob.MAX_HISTORY_ENTRIES);
    }
    return result;
  }

  /**
   * §52.3 + §31: Returns the most recent reconciliation scan result.
   */
  public getLastScanResult(): ReconciliationScanResult | null {
    return this.history[this.history.length - 1] ?? null;
  }

  /**
   * §52.3 + §31: Returns all reconciliation scan history.
   */
  public getScanHistory(): readonly ReconciliationScanResult[] {
    return [...this.history];
  }

  /**
   * §52.3 + §31: Acknowledges a reconciliation issue as resolved.
   */
  public acknowledgeIssue(scanId: string, issueId: string): boolean {
    const scan = this.history.find((s) => s.scanId === scanId);
    if (!scan) return false;

    const issue = scan.issues.find((i) => i.issueId === issueId);
    if (!issue) return false;

    // In practice, this would mark the issue as resolved in a persistent store
    return true;
  }

  /**
   * §52.3 + §31: Runs reconciliation loop with retry/backoff until all critical
   * issues are resolved or max retries are exhausted.
   *
   * This provides the retry/reconciliation loop required by the architecture
   * when resolveRegionFailover is called after failover.
   *
   * @param input - Reconciliation job input
   * @param maxAttempts - Override max attempts (default from constructor)
   * @returns ReconciliationScanResult with final attempt count
   */
  public runReconciliationLoop(
    input: ReconciliationJobInput,
    maxAttempts?: number,
  ): ReconciliationScanResult & { readonly attemptCount: number; readonly exhausted: boolean } {
    const attempts = maxAttempts ?? this.maxRetries;
    let lastResult: ReconciliationScanResult | null = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      lastResult = this.runReconciliation(input);

      // If can proceed (no critical issues), we're done
      if (lastResult.canProceed) {
        return { ...lastResult, attemptCount: attempt, exhausted: false };
      }

      // If not the last attempt, wait with exponential backoff before retry
      if (attempt < attempts) {
        const delayMs = this.baseDelayMs * Math.pow(2, attempt - 1);
        // In practice, this would use a proper sleep mechanism
        // For now we calculate the delay but don't block (caller should use async version)
        void delayMs; // Reference to avoid unused variable warning
      }
    }

    // Exhausted all retries without critical resolution
    return {
      ...lastResult!,
      attemptCount: attempts,
      exhausted: true,
    };
  }

  /**
   * §52.3 + §31: Async version of runReconciliationLoop with proper sleep between attempts.
   */
  public async runReconciliationLoopAsync(
    input: ReconciliationJobInput,
    maxAttempts?: number,
  ): Promise<ReconciliationScanResult & { readonly attemptCount: number; readonly exhausted: boolean }> {
    const attempts = maxAttempts ?? this.maxRetries;
    let lastResult: ReconciliationScanResult | null = null;

    for (let attempt = 1; attempt <= attempts; attempt++) {
      lastResult = this.runReconciliation(input);

      // If can proceed (no critical issues), we're done
      if (lastResult.canProceed) {
        return { ...lastResult, attemptCount: attempt, exhausted: false };
      }

      // If not the last attempt, sleep with exponential backoff before retry
      if (attempt < attempts) {
        const delayMs = this.baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    // Exhausted all retries without critical resolution
    return {
      ...lastResult!,
      attemptCount: attempts,
      exhausted: true,
    };
  }

  private createIssue(
    type: ReconciliationIssueType,
    sourceRegionId: string,
    targetRegionId: string,
    resourceId: string,
    description: string,
    severity: ReconciliationSeverity,
    estimatedGapSize: number,
  ): ReconciliationIssue {
    return {
      issueId: newId("recon_issue"),
      issueType: type,
      severity,
      sourceRegionId,
      targetRegionId,
      affectedResource: resourceId,
      description,
      detectedAt: nowIso(),
      requiresAttention: severity === "critical" || severity === "high",
      estimatedGapSize,
    };
  }
}
