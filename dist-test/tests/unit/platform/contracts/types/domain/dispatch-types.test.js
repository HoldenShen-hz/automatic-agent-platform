import assert from "node:assert/strict";
import test from "node:test";
test("ExecutionTicketRecord structure is correct", () => {
    const record = {
        id: "ticket_123",
        executionId: "exec_456",
        taskId: "task_789",
        priority: "normal",
        queueName: "default",
        dispatchTarget: "any",
        requiredIsolationLevel: "standard",
        requiredRepoVersion: "v1.0.0",
        requiredCapabilitiesJson: '{"tools":["bash","edit"]}',
        dispatchAfter: null,
        attempt: 1,
        status: "pending",
        assignedWorkerId: null,
        leaseId: null,
        claimedAt: null,
        consumedAt: null,
        invalidatedAt: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.id, "ticket_123");
    assert.equal(record.priority, "normal");
    assert.equal(record.status, "pending");
});
test("ExecutionTicketRecord allows claimed state", () => {
    const record = {
        id: "ticket_claimed",
        executionId: "exec_abc",
        taskId: "task_def",
        priority: "high",
        queueName: null,
        dispatchTarget: "prefer_remote",
        requiredIsolationLevel: null,
        requiredRepoVersion: null,
        requiredCapabilitiesJson: "{}",
        dispatchAfter: null,
        attempt: 2,
        status: "claimed",
        assignedWorkerId: "worker_xyz",
        leaseId: "lease_123",
        claimedAt: "2026-04-14T00:01:00.000Z",
        consumedAt: null,
        invalidatedAt: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:01:00.000Z",
    };
    assert.equal(record.status, "claimed");
    assert.equal(record.assignedWorkerId, "worker_xyz");
    assert.ok(record.claimedAt !== null);
});
test("ExecutionTicketRecord allows consumed state", () => {
    const record = {
        id: "ticket_consumed",
        executionId: "exec_consumed",
        taskId: "task_consumed",
        priority: "low",
        queueName: "background",
        requiredCapabilitiesJson: "{}",
        dispatchAfter: null,
        attempt: 1,
        status: "consumed",
        assignedWorkerId: "worker_abc",
        leaseId: "lease_456",
        claimedAt: "2026-04-14T00:00:30.000Z",
        consumedAt: "2026-04-14T00:01:00.000Z",
        invalidatedAt: null,
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:01:00.000Z",
    };
    assert.equal(record.status, "consumed");
    assert.ok(record.consumedAt !== null);
});
test("ExecutionTicketStatus accepts all valid values", () => {
    const statuses = ["pending", "claimed", "consumed", "cancelled", "expired"];
    assert.equal(statuses.length, 5);
});
test("TaskPriority accepts all valid values", () => {
    const priorities = ["low", "normal", "high", "urgent"];
    assert.equal(priorities.length, 4);
});
test("DispatchTarget accepts all valid values", () => {
    const targets = ["any", "local_only", "prefer_remote", "require_remote"];
    assert.equal(targets.length, 4);
});
test("DispatchWorkerEvaluation structure is correct", () => {
    const evaluation = {
        workerId: "worker_123",
        status: "idle",
        schedulingStatus: "healthy",
        placement: "local",
        isolationLevel: "standard",
        repoVersion: "v1.0.0",
        remoteSessionStatus: null,
        queueAffinity: "region-us-east",
        availableSlots: 3,
        accepted: true,
        rejectionReason: null,
        missingCapabilities: [],
        affinityMatched: true,
        activeLeaseCount: 2,
        runningExecutionCount: 1,
        saturation: 0.3,
        toolBacklogCount: 0,
        loadScore: 0.4,
    };
    assert.equal(evaluation.workerId, "worker_123");
    assert.equal(evaluation.accepted, true);
    assert.equal(evaluation.availableSlots, 3);
});
test("DispatchWorkerEvaluation allows rejected worker", () => {
    const evaluation = {
        workerId: "worker_rejected",
        status: "busy",
        schedulingStatus: "degraded",
        placement: "remote",
        isolationLevel: "hardened",
        repoVersion: "v0.9.0",
        remoteSessionStatus: "connected",
        sessionConsistencyCheckStatus: "passed",
        workspaceSyncStatus: "aligned",
        queueAffinity: null,
        availableSlots: 0,
        accepted: false,
        rejectionReason: "worker_capacity_full",
        missingCapabilities: ["file_write"],
        affinityMatched: false,
        activeLeaseCount: 10,
        runningExecutionCount: 8,
        saturation: 0.95,
        toolBacklogCount: 15,
        loadScore: 0.9,
        loadSkewPenaltyApplied: true,
    };
    assert.equal(evaluation.accepted, false);
    assert.equal(evaluation.rejectionReason, "worker_capacity_full");
    assert.equal(evaluation.missingCapabilities.length, 1);
});
test("DispatchWorkerRejectionReason accepts all valid values", () => {
    const reasons = [
        "worker_unavailable",
        "worker_quarantined",
        "worker_offline",
        "worker_draining",
        "worker_degraded_filtered",
        "worker_untrusted",
        "worker_capacity_full",
        "queue_affinity_mismatch",
        "missing_capabilities",
        "worker_placement_mismatch",
        "worker_isolation_mismatch",
        "worker_repo_version_mismatch",
        "worker_remote_session_unready",
    ];
    assert.equal(reasons.length, 13);
});
test("DispatchDecisionTrace structure is correct", () => {
    const trace = {
        ticketId: "ticket_123",
        executionId: "exec_456",
        taskId: "task_789",
        queueName: "default",
        dispatchTarget: "any",
        remoteAvailability: "healthy",
        requiredIsolationLevel: null,
        requiredRepoVersion: null,
        preferredWorkerId: "worker_abc",
        requiredCapabilities: ["bash", "edit"],
        outcome: "dispatched",
        reasonCode: null,
        selectedWorkerId: "worker_abc",
        leaseId: "lease_xyz",
        fallbackApplied: false,
        evaluations: [],
    };
    assert.equal(trace.ticketId, "ticket_123");
    assert.equal(trace.outcome, "dispatched");
    assert.equal(trace.selectedWorkerId, "worker_abc");
    assert.equal(trace.preferredWorkerId, "worker_abc");
});
test("DispatchDecisionTrace allows no_worker outcome", () => {
    const trace = {
        ticketId: "ticket_no_worker",
        executionId: "exec_no_worker",
        taskId: "task_no_worker",
        queueName: "special",
        preferredWorkerId: null,
        requiredCapabilities: ["nonexistent_tool"],
        outcome: "no_worker",
        reasonCode: "no_matching_worker",
        selectedWorkerId: null,
        leaseId: null,
        evaluations: [],
    };
    assert.equal(trace.outcome, "no_worker");
    assert.equal(trace.selectedWorkerId, null);
    assert.equal(trace.reasonCode, "no_matching_worker");
});
test("DispatchDecisionTrace allows blocked outcome with preemption", () => {
    const trace = {
        ticketId: "ticket_blocked",
        executionId: "exec_blocked",
        taskId: "task_blocked",
        queueName: null,
        preferredWorkerId: null,
        requiredCapabilities: [],
        outcome: "blocked",
        reasonCode: "preemption_required",
        selectedWorkerId: null,
        leaseId: null,
        fallbackApplied: true,
        preemption: {
            applied: true,
            triggerPriority: "urgent",
            preemptedExecutionId: "exec_preempted",
            preemptedTaskId: "task_preempted",
            preemptedWorkerId: "worker_preempted",
            previousTicketId: "ticket_preempted",
            replacementTicketId: "ticket_replacement",
            recoveryStepId: "step_recover",
            reasonCode: "priority_preemption",
        },
        evaluations: [],
    };
    assert.equal(trace.outcome, "blocked");
    assert.ok(trace.preemption?.applied);
    assert.equal(trace.preemption?.triggerPriority, "urgent");
});
test("DispatchDecisionTrace allows with evaluations", () => {
    const workerEval = {
        workerId: "worker_eval_1",
        status: "idle",
        schedulingStatus: "healthy",
        placement: "local",
        queueAffinity: null,
        availableSlots: 5,
        accepted: true,
        rejectionReason: null,
        missingCapabilities: [],
    };
    const trace = {
        ticketId: "ticket_with_evals",
        executionId: "exec_with_evals",
        taskId: "task_with_evals",
        queueName: "default",
        preferredWorkerId: "worker_eval_1",
        requiredCapabilities: ["bash"],
        outcome: "dispatched",
        reasonCode: null,
        selectedWorkerId: "worker_eval_1",
        leaseId: "lease_new",
        evaluations: [workerEval],
    };
    assert.equal(trace.evaluations.length, 1);
    assert.equal(trace.evaluations[0]?.workerId, "worker_eval_1");
});
test("RemoteAvailability accepts all valid values", () => {
    const avail = ["healthy", "partial_available", "degraded", "unavailable"];
    assert.equal(avail.length, 4);
});
//# sourceMappingURL=dispatch-types.test.js.map