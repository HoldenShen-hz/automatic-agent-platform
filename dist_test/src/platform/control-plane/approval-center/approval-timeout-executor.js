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
import { nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
/** Default timeout per policy in milliseconds (24 hours). */
const DEFAULT_TIMEOUT_MS = 24 * 60 * 60 * 1000;
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
    approvalService;
    store;
    approvalRepo;
    logger = new StructuredLogger({ retentionLimit: 50 });
    defaultTimeoutMs;
    constructor(approvalService, store, approvalRepo, options = {}) {
        this.approvalService = approvalService;
        this.store = store;
        this.approvalRepo = approvalRepo;
        this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    }
    /**
     * Sweep all pending approvals, applying timeout policies for any that have expired.
     *
     * @returns Summary of the sweep: how many processed, rejected, approved, skipped, and errors.
     */
    sweep() {
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
            }
            catch (err) {
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
    /**
     * Check if an approval has expired based on its timeout policy.
     *
     * Uses `timeout_at` column when present (migration 38+), otherwise
     * computes expiration from `createdAt` + default timeout per policy.
     */
    isExpired(approval, now) {
        if (approval.respondedAt != null)
            return false;
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
    getTimeoutForPolicy(_policy) {
        return this.defaultTimeoutMs;
    }
}
//# sourceMappingURL=approval-timeout-executor.js.map