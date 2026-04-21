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
import type { ApprovalRecord } from "../../contracts/types/domain.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { ApprovalRepository } from "../../state-evidence/truth/sqlite/repositories/approval-repository.js";
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
/**
 * Scans for expired pending approvals and applies their timeout policy.
 *
 * Usage:
 * ```typescript
 * const executor = new ApprovalTimeoutExecutor(approvalService, store, approvalRepo);
 * const result = executor.sweep();
 * ```
 */
export declare class ApprovalTimeoutExecutor {
    private readonly approvalService;
    private readonly store;
    private readonly approvalRepo;
    private readonly logger;
    private readonly defaultTimeoutMs;
    constructor(approvalService: ApprovalService, store: AuthoritativeTaskStore, approvalRepo: ApprovalRepository, options?: ApprovalTimeoutExecutorOptions);
    /**
     * Sweep all pending approvals, applying timeout policies for any that have expired.
     *
     * @returns Summary of the sweep: how many processed, rejected, approved, skipped, and errors.
     */
    sweep(): ApprovalTimeoutResult;
    /**
     * Check if an approval has expired based on its timeout policy.
     *
     * Uses `timeout_at` column when present (migration 38+), otherwise
     * computes expiration from `createdAt` + default timeout per policy.
     */
    isExpired(approval: ApprovalRecord, now: string): boolean;
    /**
     * Returns the default timeout duration for a given policy.
     * Subclasses or configuration can override this.
     */
    protected getTimeoutForPolicy(_policy: string): number;
}
