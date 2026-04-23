import { newId } from "../../../contracts/types/ids.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
export function parseJsonArray(value) {
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    }
    catch (err) {
        logger.log({
            level: "warn",
            message: "Failed to parse JSON array",
            data: { error: err instanceof Error ? err.message : String(err), value: value.substring(0, 100) },
        });
        return [];
    }
}
export function removeExecutionId(existing, executionId) {
    return existing.filter((value) => value !== executionId).sort();
}
export function toWorkerStatus(snapshot, runningExecutionIds) {
    if (snapshot.status === "unavailable")
        return "unavailable";
    if (snapshot.status === "quarantined")
        return "quarantined";
    if (snapshot.status === "offline")
        return "offline";
    if (snapshot.status === "draining")
        return "draining";
    if (snapshot.status === "degraded")
        return "degraded";
    return runningExecutionIds.length > 0 ? "busy" : "idle";
}
export function toExecutionTerminalStatus(terminalStatus) {
    return terminalStatus === "done" ? "succeeded" : terminalStatus;
}
export function buildAgentExecutionRecord(store, execution, executionId, occurredAt, updates) {
    const existing = store.worker.getAgentExecutionRecord(executionId);
    return {
        executionId,
        taskId: execution.taskId,
        agentId: updates.agentId,
        workflowId: execution.workflowId,
        roleId: execution.roleId,
        runKind: execution.runKind,
        runtimeInstanceId: updates.runtimeInstanceId,
        restartedFromRuntimeInstanceId: updates.restartedFromRuntimeInstanceId,
        restartGeneration: updates.restartGeneration,
        status: updates.status,
        planJson: existing?.planJson ??
            JSON.stringify({
                workflowId: execution.workflowId,
                roleId: execution.roleId,
                runKind: execution.runKind,
            }),
        currentStepId: updates.currentStepId,
        lastToolName: updates.lastToolName,
        toolCallCount: Math.max(0, Math.trunc(updates.toolCallCount)),
        lastDecisionJson: existing?.lastDecisionJson ?? null,
        lastErrorCode: updates.lastErrorCode,
        retryCount: existing?.retryCount ?? Math.max(execution.attempt - 1, 0),
        progressMessage: updates.progressMessage,
        startedAt: existing?.startedAt ?? execution.startedAt ?? occurredAt,
        createdAt: existing?.createdAt ?? occurredAt,
        updatedAt: occurredAt,
        completedAt: updates.completedAt,
    };
}
export function persistRemoteLogs(store, taskId, executionId, traceId, workerId, runtimeInstanceId, remoteLogs, defaultOccurredAt) {
    for (const entry of remoteLogs ?? []) {
        const message = entry.message.trim();
        if (message.length === 0)
            continue;
        store.worker.insertRemoteLog({
            id: newId("rlog"),
            taskId,
            executionId,
            workerId,
            runtimeInstanceId,
            level: entry.level,
            message,
            contextJson: JSON.stringify({
                taskId,
                executionId,
                workerId,
                traceId,
                correlationId: taskId,
                ...(runtimeInstanceId ? { runtimeInstanceId } : {}),
                ...(entry.context ?? {}),
            }),
            createdAt: entry.occurredAt ?? defaultOccurredAt,
        });
    }
}
//# sourceMappingURL=execution-worker-writeback-support.js.map