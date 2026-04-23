import { nowIso } from "../platform/contracts/types/ids.js";
export class WorkflowHibernationService {
    records = new Map();
    hibernate(workflowId, taskId, ttlHours = 24 * 7, now = nowIso()) {
        const normalizedTtlHours = Math.min(24 * 30, Math.max(1, Math.trunc(ttlHours)));
        const record = {
            workflowId,
            taskId,
            status: "hibernated",
            hibernatedAt: now,
            expiresAt: new Date(new Date(now).getTime() + normalizedTtlHours * 3600 * 1000).toISOString(),
            heartbeatEvents: [],
        };
        this.records.set(workflowId, record);
        return record;
    }
    emitStillHibernated(workflowId, emittedAt = nowIso()) {
        const record = this.requireRecord(workflowId);
        if (record.status !== "hibernated") {
            throw new Error(`workflow_hibernation.not_hibernated:${workflowId}`);
        }
        this.records.set(workflowId, {
            ...record,
            heartbeatEvents: [...record.heartbeatEvents, emittedAt],
        });
        return {
            workflowId,
            eventType: "still_hibernated",
            emittedAt,
        };
    }
    resume(workflowId, resumedAt = nowIso()) {
        const record = this.requireRecord(workflowId);
        this.records.set(workflowId, {
            ...record,
            status: "resumed",
        });
        return {
            workflowId,
            eventType: "resumed",
            emittedAt: resumedAt,
        };
    }
    getRecord(workflowId) {
        return this.records.get(workflowId) ?? null;
    }
    emitDueStillHibernatedEvents(asOf = nowIso(), intervalHours = 24) {
        const emittedAt = new Date(asOf);
        const intervalMs = Math.max(1, Math.trunc(intervalHours)) * 3600 * 1000;
        return [...this.records.values()]
            .filter((record) => record.status === "hibernated")
            .filter((record) => {
            const anchor = record.heartbeatEvents[record.heartbeatEvents.length - 1] ?? record.hibernatedAt;
            if (anchor == null) {
                return false;
            }
            return emittedAt.getTime() - new Date(anchor).getTime() >= intervalMs;
        })
            .map((record) => this.emitStillHibernated(record.workflowId, asOf));
    }
    requireRecord(workflowId) {
        const record = this.records.get(workflowId);
        if (record == null) {
            throw new Error(`workflow_hibernation.not_found:${workflowId}`);
        }
        return record;
    }
}
//# sourceMappingURL=workflow-hibernation-service.js.map