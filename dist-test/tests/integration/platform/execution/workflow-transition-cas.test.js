/**
 * [SYS-REL-2.7] Workflow Transition CAS Tests
 *
 * Verifies workflow transitions reject conflicting concurrent updates.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { WorkflowTransitionService } from "../../../../src/platform/execution/state-transition/transition-service.js";
import { runConcurrentInvariant } from "../../../helpers/concurrent-runner.js";
function createWorkflowRepository(initial, staleReadsRemaining = 0) {
    let current = { ...initial };
    const staleSnapshot = { ...initial };
    let staleReads = staleReadsRemaining;
    return {
        updateTaskStatus() { },
        updateTaskStatusCas() { return 0; },
        updateTaskOutput() { },
        updateWorkflowState() { },
        updateWorkflowStateCas(taskId, expectedVersion, expectedStatus, status, currentStepIndex, outputsJson, updatedAt, resumableFromStep = null) {
            if (taskId !== current.taskId || expectedVersion !== current.currentStepIndex || expectedStatus !== current.status) {
                return 0;
            }
            current = {
                ...current,
                status: status,
                currentStepIndex,
                outputsJson,
                updatedAt,
                resumableFromStep,
            };
            return 1;
        },
        getWorkflowState(taskId) {
            if (taskId !== current.taskId) {
                return null;
            }
            if (staleReads > 0) {
                staleReads -= 1;
                return { ...staleSnapshot };
            }
            return { ...current };
        },
        updateSessionStatus() { },
        updateSessionStatusCas() { return 0; },
        updateExecutionStatus() { },
        updateExecutionStatusCas() { return 0; },
        createTier1StatusEvent() {
            throw new Error("unused");
        },
        insertApproval() { },
        getApproval() { return null; },
        listApprovalsByTask() { return []; },
        updateApprovalDecision() { },
        updateApprovalDecisionCas() { return 0; },
        updateApprovalRequest() { },
        insertEvent() {
            throw new Error("unused");
        },
    };
}
test("[SYS-REL-2.7] concurrent workflow transitions detect conflict", async () => {
    const now = new Date().toISOString();
    const repository = createWorkflowRepository({
        taskId: "workflow-cas-test-001",
        divisionId: "general_ops",
        workflowId: "multi_step_v1",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
    }, 2);
    const service = new WorkflowTransitionService(repository);
    const results = await Promise.allSettled([
        Promise.resolve().then(() => service.transition({
            entityKind: "workflow",
            entityId: "workflow-cas-test-001",
            fromStatus: "running",
            toStatus: "completed",
            currentStepIndex: 1,
            outputsJson: "{\"result\":\"success\"}",
            traceId: "trace-cas-1",
            correlationId: "workflow-cas-test-001",
            idempotencyKey: "",
            metadataJson: "",
            reasonCode: "",
            reasonDetail: "",
            actorType: "system",
            actorId: "",
            occurredAt: now,
        })),
        Promise.resolve().then(() => service.transition({
            entityKind: "workflow",
            entityId: "workflow-cas-test-001",
            fromStatus: "running",
            toStatus: "failed",
            currentStepIndex: 0,
            outputsJson: "{\"error\":\"failed\"}",
            traceId: "trace-cas-2",
            correlationId: "workflow-cas-test-001",
            idempotencyKey: "",
            metadataJson: "",
            reasonCode: "WF_FAILED",
            reasonDetail: "Workflow failed",
            actorType: "system",
            actorId: "",
            occurredAt: now,
        })),
    ]);
    const succeeded = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    assert.equal(succeeded.length, 1);
    assert.equal(rejected.length, 1);
    assert.match(String(rejected[0]?.reason), /workflow\.transition_cas_failed/);
});
test("[SYS-REL-2.7] workflow CAS error thrown when fromStatus doesn't match", () => {
    const now = new Date().toISOString();
    const repository = createWorkflowRepository({
        taskId: "workflow-cas-error-001",
        divisionId: "general_ops",
        workflowId: "multi_step_v1",
        currentStepIndex: 1,
        status: "completed",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
    });
    const service = new WorkflowTransitionService(repository);
    assert.throws(() => {
        service.transition({
            entityKind: "workflow",
            entityId: "workflow-cas-error-001",
            fromStatus: "running",
            toStatus: "failed",
            currentStepIndex: 0,
            outputsJson: "{}",
            traceId: "trace-error",
            correlationId: "workflow-cas-error-001",
            idempotencyKey: "",
            metadataJson: "",
            reasonCode: "",
            reasonDetail: "",
            actorType: "system",
            actorId: "",
            occurredAt: now,
        });
    }, /fromStatus/);
});
test("[SYS-REL-2.7] multiple concurrent transitions on same workflow", async () => {
    const now = new Date().toISOString();
    const repository = createWorkflowRepository({
        taskId: "workflow-multi-001",
        divisionId: "general_ops",
        workflowId: "multi_step_v1",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
    }, 5);
    const service = new WorkflowTransitionService(repository);
    const result = await runConcurrentInvariant(async (workerId) => {
        try {
            service.transition({
                entityKind: "workflow",
                entityId: "workflow-multi-001",
                fromStatus: "running",
                toStatus: "completed",
                currentStepIndex: workerId,
                outputsJson: JSON.stringify({ workerId }),
                traceId: `trace-${workerId}`,
                correlationId: "workflow-multi-001",
                idempotencyKey: "",
                metadataJson: "",
                reasonCode: "",
                reasonDetail: "",
                actorType: "system",
                actorId: "",
                occurredAt: now,
            });
            return { success: true, workerId };
        }
        catch (error) {
            return { success: false, workerId, error };
        }
    }, { concurrency: 5 });
    const successfulTransitions = result.values.filter((value) => value.success);
    const failedTransitions = result.values.filter((value) => !value.success);
    assert.equal(successfulTransitions.length, 1);
    assert.equal(failedTransitions.length, 4);
    assert.ok(failedTransitions.every((value) => String(value.error).includes("workflow.transition_cas_failed")));
});
//# sourceMappingURL=workflow-transition-cas.test.js.map