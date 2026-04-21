import { getTenantIdOrNull, hasTenantContext } from "../../../execution/execution-engine/runtime-context.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
const authoritativeTaskStoreLogger = new StructuredLogger({ retentionLimit: 50 });
export function resolveTenantScope(tenantId) {
    if (tenantId !== undefined) {
        return tenantId ?? undefined;
    }
    if (!hasTenantContext()) {
        return undefined;
    }
    return getTenantIdOrNull() ?? undefined;
}
/**
 * Parses a dispatch decision trace from JSON string.
 * Validates the structure before returning.
 * @param raw - Raw JSON string to parse
 * @returns Parsed DispatchDecisionTrace or null if invalid
 */
export function parseDispatchDecisionTrace(raw) {
    try {
        const parsed = JSON.parse(raw);
        if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
            return null;
        }
        const candidate = parsed;
        if (typeof candidate.ticketId !== "string" ||
            typeof candidate.executionId !== "string" ||
            typeof candidate.taskId !== "string" ||
            (candidate.queueName !== null && typeof candidate.queueName !== "string") ||
            (candidate.preferredWorkerId !== null && typeof candidate.preferredWorkerId !== "string") ||
            !Array.isArray(candidate.requiredCapabilities) ||
            !Array.isArray(candidate.evaluations)) {
            return null;
        }
        return parsed;
    }
    catch (err) {
        authoritativeTaskStoreLogger.log({ level: "debug", message: "Failed to parse dispatch decision trace", data: { error: err instanceof Error ? err.message : String(err) } });
        return null;
    }
}
/**
 * Phase 1a store providing database access for all core entities.
 * This is the main data access layer for the SQLite database.
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/storage_schema_contract.md | Storage Schema Contract}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 */
export function mapRuntimeRecoveryRecord(row) {
    const hasPrecheck = row.precheckId != null;
    return {
        executionId: String(row.executionId),
        taskId: String(row.taskId),
        divisionId: row.divisionId ?? null,
        taskStatus: row.taskStatus,
        status: row.status,
        attempt: Number(row.attempt),
        traceId: String(row.traceId),
        workflowId: row.workflowId ?? null,
        latestErrorCode: row.latestErrorCode ?? null,
        updatedAt: String(row.updatedAt),
        lastHeartbeatAt: row.lastHeartbeatAt ?? null,
        pendingApprovalId: row.pendingApprovalId ?? null,
        latestPrecheck: hasPrecheck
            ? {
                id: String(row.precheckId),
                executionId: String(row.precheckExecutionId),
                allowed: Number(row.precheckAllowed) === 1 ? 1 : 0,
                reasonCode: row.precheckReasonCode ?? null,
                resolvedBudgetUsd: row.precheckResolvedBudgetUsd == null ? null : Number(row.precheckResolvedBudgetUsd),
                resolvedTimeoutMs: Number(row.precheckResolvedTimeoutMs),
                resolvedSandboxMode: String(row.precheckResolvedSandboxMode),
                resolvedToolsJson: row.precheckResolvedToolsJson ?? null,
                resolvedPathsJson: row.precheckResolvedPathsJson ?? null,
                checkedAt: String(row.precheckCheckedAt),
            }
            : null,
    };
}
//# sourceMappingURL=authoritative-task-store-types.js.map