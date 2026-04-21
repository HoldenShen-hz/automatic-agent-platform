/**
 * Stalled Execution Detector
 *
 * Monitors active executions and detects those that may be stalled or unresponsive.
 * Uses heartbeat timestamps and progress indicators to identify executions
 * that require intervention (lease reclaim or restart/escalation).
 *
 * Detection criteria:
 * - An execution is considered stale if no progress has been made within a configurable threshold
 * - Missing heartbeat detection triggers lease reclaim recommendations
 * - No progress detection triggers restart/escalation recommendations
 *
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/architecture/00-platform-architecture.md | Architecture and Technical Design}
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/contracts/runtime_execution_contract.md | Runtime Execution Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/contracts/task_lease_and_fencing_contract.md | Task Lease and Fencing Contract}
 * @see {@link https://github.com/anomalyco/automatic-agent/tree/main/docs_zh/governance/glossary_and_terminology.md | Glossary and Terminology}
 */
function isoMinusMs(isoTimestamp, deltaMs) {
    return new Date(Date.parse(isoTimestamp) - deltaMs).toISOString();
}
function maxIso(left, right) {
    if (right == null) {
        return left;
    }
    return Date.parse(right) > Date.parse(left) ? right : left;
}
export class StalledExecutionDetector {
    store;
    constructor(store) {
        this.store = store;
    }
    detect(options = {}) {
        const now = options.now ?? new Date().toISOString();
        const staleAfterMs = options.staleAfterMs ?? 5 * 60 * 1000;
        const heartbeatGraceMs = options.heartbeatGraceMs ?? 2 * 60 * 1000;
        const staleBefore = isoMinusMs(now, staleAfterMs);
        const heartbeatMissingBefore = isoMinusMs(now, heartbeatGraceMs);
        return this.store.operations.listActiveExecutionActivity().flatMap((record) => {
            const lastProgressAt = maxIso(record.updatedAt, record.latestEventAt);
            if (Date.parse(lastProgressAt) > Date.parse(staleBefore)) {
                return [];
            }
            const hasRecentHeartbeat = record.latestHeartbeatAt != null && Date.parse(record.latestHeartbeatAt) > Date.parse(heartbeatMissingBefore);
            return [
                {
                    executionId: record.executionId,
                    taskId: record.taskId,
                    agentId: record.agentId,
                    status: record.status,
                    lastProgressAt,
                    lastHeartbeatAt: record.latestHeartbeatAt,
                    staleKind: hasRecentHeartbeat ? "no_progress" : "missing_heartbeat",
                    recommendedAction: hasRecentHeartbeat ? "restart_or_escalate" : "lease_reclaim",
                },
            ];
        });
    }
}
//# sourceMappingURL=stalled-execution-detector.js.map