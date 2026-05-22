/**
 * ApprovalTimeoutExecutor - Sweeps expired approvals and applies timeout policies.
 *
 * This executor periodically scans for pending approvals that have exceeded
 * their timeout window and applies the configured timeout policy:
 * - "reject": Auto-reject the approval
 * - "approve": Auto-approve the approval
 * - "remain_pending": Leave pending (no action)
 *
 * The timeout is computed from the approval's `createdAt` + default timeout per policy.
 * A `timeout_at` column in the `approvals` table (added in migration 38) will be
 * used when available for more precise expiration tracking.
 */

import { ApprovalService } from "./approval-service.js";
import { nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import type { ApprovalRecord } from "../../contracts/types/domain.js";
import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import { ApprovalRepository } from "../../five-plane-state-evidence/truth/sqlite/repositories/approval-repository.js";

/** Default timeout per policy in milliseconds (24 hours). */
const DEFAULT_TIMEOUT_MS = 24 * 60 * 60 * 1000;

export interface ApprovalTimeoutResult {
  processed: number;
  rejected: number;
  approved: number;
  skipped: number;
  errors: number;
}

export interface ApprovalTimeoutExecutorOptions {
  /** Timeout in milliseconds per policy when no timeout_at column is available. */
  defaultTimeoutMs?: number;
}

export interface ApprovalTimeoutExecutionInput {
  approvalId: string;
  expiredAt?: string;
}

export interface ApprovalTimeoutExecutionResult {
  approvalId: string;
  status: ApprovalRecord["status"];
  decisionType: "expired";
  respondedAt: string;
}

type ApprovalTimeoutExecutorApprovalService = Pick<ApprovalService, "applyDecision">;
type ApprovalTimeoutExecutorApprovalRepository = Pick<ApprovalRepository, "listApprovalsByStatus" | "getApproval">;

function isApprovalRepositoryLike(value: unknown): value is ApprovalTimeoutExecutorApprovalRepository {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.listApprovalsByStatus === "function"
    && typeof candidate.getApproval === "function";
}

function isApprovalServiceLike(value: unknown): value is ApprovalTimeoutExecutorApprovalService {
  if (value == null || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return typeof candidate.applyDecision === "function";
}

/**
 * Scans for expired pending approvals and applies their timeout policy.
 *
 * Usage:
 * ```typescript
 * const executor = new ApprovalTimeoutExecutor(approvalService, store, approvalRepo);
 * const result = executor.sweep();
 * ```
 */
export class ApprovalTimeoutExecutor {
  private readonly logger = new StructuredLogger({ retentionLimit: 50 });
  private readonly defaultTimeoutMs: number;

  private readonly approvalService: ApprovalTimeoutExecutorApprovalService;
  private readonly store: AuthoritativeTaskStore;
  private readonly approvalRepo: ApprovalTimeoutExecutorApprovalRepository;

  public constructor(
    approvalServiceOrDb: ApprovalService | AuthoritativeSqlDatabase,
    store: AuthoritativeTaskStore,
    approvalRepoOrOptions?: ApprovalRepository | ApprovalTimeoutExecutorOptions,
    options: ApprovalTimeoutExecutorOptions = {},
  ) {
    if (approvalServiceOrDb instanceof ApprovalService || isApprovalServiceLike(approvalServiceOrDb)) {
      this.approvalService = approvalServiceOrDb;
      this.store = store;
      this.approvalRepo = approvalRepoOrOptions instanceof ApprovalRepository || isApprovalRepositoryLike(approvalRepoOrOptions)
        ? approvalRepoOrOptions
        : (() => {
          throw new Error("approval_timeout_executor.repository_required");
        })();
      this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
      return;
    }

    this.approvalService = new ApprovalService(approvalServiceOrDb, store);
    this.store = store;
    this.approvalRepo = new ApprovalRepository(approvalServiceOrDb.connection);
    const legacyOptions = approvalRepoOrOptions instanceof ApprovalRepository ? options : approvalRepoOrOptions;
    this.defaultTimeoutMs = legacyOptions?.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Sweep all pending approvals, applying timeout policies for any that have expired.
   *
   * @returns Summary of the sweep: how many processed, rejected, approved, skipped, and errors.
   */
  public sweep(): ApprovalTimeoutResult {
    const now = nowIso();
    const pendingApprovals = this.approvalRepo.listApprovalsByStatus("requested");
    let rejected = 0;
    let approved = 0;
    let skipped = 0;
    let errors = 0;

    for (const approval of pendingApprovals) {
      try {
        if (!this.isExpired(approval, now)) {
          skipped++;
          continue;
        }

        switch (approval.timeoutPolicy) {
          case "reject":
            this.approvalService.applyDecision({
              approvalId: approval.id,
              decisionType: "expired",
              respondedBy: "system:timeout_executor",
              respondedAt: now,
            });
            rejected++;
            break;

          case "approve":
            // APPR-01: timeoutPolicy="approve" must record a confirmed
            // decision. Previously "expired" was passed, which approval-service
            // maps to the rejected terminal state — silently inverting the
            // policy from approve-on-timeout to deny.
            this.approvalService.applyDecision({
              approvalId: approval.id,
              decisionType: "confirmed",
              confirmed: true,
              respondedBy: "system:timeout_executor",
              respondedAt: now,
            });
            approved++;
            break;

          case "remain_pending":
            skipped++;
            break;
        }
      } catch (err) {
        this.logger.warn("ApprovalTimeoutExecutor: error processing approval", {
          approvalId: approval.id,
          error: err instanceof Error ? err.message : String(err),
        });
        errors++;
      }
    }

    this.logger.info("Approval timeout sweep completed", {
      processed: pendingApprovals.length,
      rejected,
      approved,
      skipped,
      errors,
    });

    return { processed: pendingApprovals.length, rejected, approved, skipped, errors };
  }

  public executeTimeout(input: ApprovalTimeoutExecutionInput): ApprovalTimeoutExecutionResult {
    const approval = this.approvalRepo.getApproval(input.approvalId);
    if (!approval) {
      throw new Error(`approval.not_found:${input.approvalId}`);
    }

    const respondedAt = input.expiredAt ?? nowIso();
    switch (approval.timeoutPolicy) {
      case "reject":
        this.approvalService.applyDecision({
          approvalId: approval.id,
          decisionType: "expired",
          respondedBy: "system:timeout_executor",
          respondedAt,
        });
        return {
          approvalId: approval.id,
          status: "rejected",
          decisionType: "expired",
          respondedAt,
        };

      case "approve":
        this.approvalService.applyDecision({
          approvalId: approval.id,
          decisionType: "confirmed",
          confirmed: true,
          respondedBy: "system:timeout_executor",
          respondedAt,
        });
        return {
          approvalId: approval.id,
          status: "approved",
          decisionType: "expired",
          respondedAt,
        };

      case "remain_pending":
        return {
          approvalId: approval.id,
          status: "requested",
          decisionType: "expired",
          respondedAt,
        };
    }
    throw new Error(`approval_timeout_executor.unsupported_policy:${approval.timeoutPolicy}`);
  }

  /**
   * Check if an approval has expired based on its timeout policy.
   *
   * Uses `timeout_at` column when present (migration 38+), otherwise
   * computes expiration from `createdAt` + default timeout per policy.
   */
  public isExpired(approval: ApprovalRecord, now: string): boolean {
    if (approval.respondedAt != null) return false;

    // If timeout_at is available in the record, use it directly
    if ("timeoutAt" in approval && approval.timeoutAt != null) {
      return approval.timeoutAt <= now;
    }

    // Otherwise compute from createdAt + policy-based timeout
    const createdAtMs = new Date(approval.createdAt).getTime();
    const timeoutMs = this.getTimeoutForPolicy(approval.timeoutPolicy);
    const expiresAtMs = createdAtMs + timeoutMs;
    const nowMs = new Date(now).getTime();

    return nowMs >= expiresAtMs;
  }

  /**
   * Returns the default timeout duration for a given policy.
   * Subclasses or configuration can override this.
   */
  protected getTimeoutForPolicy(_policy: string): number {
    return this.defaultTimeoutMs;
  }
}
