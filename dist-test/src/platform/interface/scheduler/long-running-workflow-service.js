import { newId, nowIso } from "../../contracts/types/ids.js";
import { toWorkflowResumeWindow, toWorkflowSleepLease } from "./workflow-sleep-contracts.js";
function parseOutputs(outputsJson) {
    try {
        const parsed = JSON.parse(outputsJson);
        return parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
            ? parsed
            : {};
    }
    catch {
        return {};
    }
}
function isTerminal(status) {
    return status === "completed" || status === "failed" || status === "cancelled";
}
export class LongRunningWorkflowService {
    store;
    suspensions = new Map();
    constructor(store) {
        this.store = store;
    }
    suspend(request) {
        const workflow = this.requireWorkflow(request.taskId);
        if (isTerminal(workflow.status)) {
            throw new Error(`workflow_sleep.terminal_workflow:${request.taskId}`);
        }
        const suspendedAt = nowIso();
        const record = {
            suspensionId: newId("workflow_sleep"),
            taskId: request.taskId,
            executionId: request.executionId ?? null,
            workflowId: workflow.workflowId,
            divisionId: workflow.divisionId,
            reasonCode: request.reasonCode,
            waitKind: request.waitKind,
            status: "active",
            suspendedAt,
            resumeAfter: request.resumeAfter ?? null,
            expiresAt: request.expiresAt ?? null,
            checkpointArtifactId: request.checkpointArtifactId ?? null,
            resumableFromStep: request.resumableFromStep,
            timeoutPolicy: request.timeoutPolicy,
            metadata: request.metadata ?? {},
        };
        this.suspensions.set(record.suspensionId, record);
        this.writeWorkflowStatus(workflow, "paused", record.resumableFromStep, {
            __workflow_suspension: record,
        }, suspendedAt);
        this.emitWorkflowEvent("workflow:suspended", record.taskId, record.executionId, record);
        return record;
    }
    markDue(now = nowIso()) {
        const due = [];
        for (const record of this.suspensions.values()) {
            if (record.status !== "active" || record.resumeAfter == null || record.resumeAfter > now) {
                continue;
            }
            const updated = { ...record, status: "resumable" };
            this.suspensions.set(record.suspensionId, updated);
            this.emitWorkflowEvent("workflow:resume_due", updated.taskId, updated.executionId, updated);
            due.push(updated);
        }
        return due;
    }
    resume(suspensionId, now = nowIso()) {
        const record = this.requireSuspension(suspensionId);
        if (record.expiresAt != null && record.expiresAt <= now) {
            return this.expire(record, now);
        }
        if (record.resumeAfter != null && record.resumeAfter > now) {
            return {
                suspensionId,
                taskId: record.taskId,
                workflowId: record.workflowId,
                allowed: false,
                reasonCode: "workflow_sleep.resume_not_due",
                nextWorkflowStatus: null,
                resumableFromStep: record.resumableFromStep,
            };
        }
        const workflow = this.requireWorkflow(record.taskId);
        const updated = { ...record, status: "resumable" };
        this.suspensions.set(suspensionId, updated);
        this.writeWorkflowStatus(workflow, "resuming", record.resumableFromStep, {
            __workflow_resume: {
                suspensionId,
                resumedAt: now,
            },
        }, now);
        this.emitWorkflowEvent("workflow:resume_requested", record.taskId, record.executionId, updated);
        return {
            suspensionId,
            taskId: record.taskId,
            workflowId: record.workflowId,
            allowed: true,
            reasonCode: "workflow_sleep.resume_allowed",
            nextWorkflowStatus: "resuming",
            resumableFromStep: record.resumableFromStep,
        };
    }
    sweepExpired(now = nowIso()) {
        const decisions = [];
        for (const record of this.suspensions.values()) {
            if (record.status === "active" && record.expiresAt != null && record.expiresAt <= now) {
                decisions.push(this.expire(record, now));
            }
        }
        return decisions;
    }
    getSuspension(suspensionId) {
        return this.suspensions.get(suspensionId) ?? null;
    }
    listSuspensions() {
        return [...this.suspensions.values()];
    }
    buildSleepLease(suspensionId) {
        return toWorkflowSleepLease(this.requireSuspension(suspensionId));
    }
    buildResumeWindow(suspensionId, now = nowIso()) {
        return toWorkflowResumeWindow(this.requireSuspension(suspensionId), now);
    }
    listResumeWindows(now = nowIso()) {
        return this.listSuspensions().map((record) => toWorkflowResumeWindow(record, now));
    }
    expire(record, now) {
        const workflow = this.requireWorkflow(record.taskId);
        const expired = { ...record, status: "expired" };
        this.suspensions.set(record.suspensionId, expired);
        const nextStatus = record.timeoutPolicy === "fail_workflow" ? "failed" : null;
        if (nextStatus != null) {
            this.writeWorkflowStatus(workflow, nextStatus, record.resumableFromStep, {
                __workflow_timeout: {
                    suspensionId: record.suspensionId,
                    expiredAt: now,
                    reasonCode: record.reasonCode,
                },
            }, now);
        }
        this.emitWorkflowEvent("workflow:suspension_expired", record.taskId, record.executionId, expired);
        return {
            suspensionId: record.suspensionId,
            taskId: record.taskId,
            workflowId: record.workflowId,
            allowed: false,
            reasonCode: record.timeoutPolicy === "fail_workflow"
                ? "workflow_sleep.expired_failed"
                : "workflow_sleep.expired_remain_pending",
            nextWorkflowStatus: nextStatus,
            resumableFromStep: record.resumableFromStep,
        };
    }
    writeWorkflowStatus(workflow, status, resumableFromStep, outputPatch, updatedAt) {
        this.store.workflow.updateWorkflowState(workflow.taskId, status, workflow.currentStepIndex, JSON.stringify({
            ...parseOutputs(workflow.outputsJson),
            ...outputPatch,
        }), updatedAt, resumableFromStep);
    }
    requireWorkflow(taskId) {
        const workflow = this.store.workflow.getWorkflowState(taskId);
        if (workflow == null) {
            throw new Error(`workflow_sleep.workflow_not_found:${taskId}`);
        }
        return workflow;
    }
    requireSuspension(suspensionId) {
        const suspension = this.suspensions.get(suspensionId);
        if (suspension == null) {
            throw new Error(`workflow_sleep.suspension_not_found:${suspensionId}`);
        }
        return suspension;
    }
    emitWorkflowEvent(eventType, taskId, executionId, payload) {
        this.store.event.insertEvent({
            id: newId("evt"),
            taskId,
            executionId,
            eventType,
            eventTier: "tier_1",
            payloadJson: JSON.stringify(payload),
            traceId: null,
            createdAt: nowIso(),
        });
    }
}
//# sourceMappingURL=long-running-workflow-service.js.map