import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { provideContext, getContext, getContextOrNull, getTenantId, getWorkspaceId } from "../../../../../src/platform/execution/execution-engine/runtime-context.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("authoritative task store applies tenant context to task lifecycle queries", () => {
  const workspace = createTempWorkspace("aa-tenant-scope-");
  const dbPath = join(workspace, "tenant-scope.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: "task-tenant-a",
        parentId: null,
        rootId: "task-tenant-a",
        divisionId: "general_ops",
        tenantId: "tenant-a",
        title: "Tenant A task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      store.insertTask({
        id: "task-tenant-b",
        parentId: null,
        rootId: "task-tenant-b",
        divisionId: "general_ops",
        tenantId: "tenant-b",
        title: "Tenant B task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      store.insertExecution({
        id: "exec-tenant-a",
        taskId: "task-tenant-a",
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-a",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-tenant-a",
        attempt: 1,
        timeoutMs: 1000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      store.insertExecution({
        id: "exec-tenant-b",
        taskId: "task-tenant-b",
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-b",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-tenant-b",
        attempt: 1,
        timeoutMs: 1000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      store.insertWorkflowState({
        taskId: "task-tenant-a",
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
      store.insertWorkflowState({
        taskId: "task-tenant-b",
        divisionId: "general_ops",
        workflowId: "single_agent_minimal",
        currentStepIndex: 0,
        status: "running",
        outputsJson: "{}",
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
      store.insertSession({
        id: "sess-tenant-a",
        taskId: "task-tenant-a",
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
      store.insertSession({
        id: "sess-tenant-b",
        taskId: "task-tenant-b",
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
      store.insertApproval({
        id: "approval-tenant-a",
        taskId: "task-tenant-a",
        executionId: "exec-tenant-a",
        status: "requested",
        requestJson: "{\"tenant\":\"a\"}",
        responseJson: null,
        timeoutPolicy: "reject",
        createdAt: now,
        respondedAt: null,
      });
      store.insertApproval({
        id: "approval-tenant-b",
        taskId: "task-tenant-b",
        executionId: "exec-tenant-b",
        status: "requested",
        requestJson: "{\"tenant\":\"b\"}",
        responseJson: null,
        timeoutPolicy: "reject",
        createdAt: now,
        respondedAt: null,
      });
      store.insertExecutionPrecheck({
        id: "precheck-tenant-a",
        executionId: "exec-tenant-a",
        allowed: 1,
        reasonCode: "ok",
        resolvedBudgetUsd: 1,
        resolvedTimeoutMs: 1000,
        resolvedSandboxMode: "workspace_write",
        resolvedToolsJson: "[]",
        resolvedPathsJson: "[]",
        checkedAt: now,
      });
      store.insertExecutionPrecheck({
        id: "precheck-tenant-b",
        executionId: "exec-tenant-b",
        allowed: 1,
        reasonCode: "ok",
        resolvedBudgetUsd: 1,
        resolvedTimeoutMs: 1000,
        resolvedSandboxMode: "workspace_write",
        resolvedToolsJson: "[]",
        resolvedPathsJson: "[]",
        checkedAt: now,
      });
      store.insertCostEvent({
        id: "cost-tenant-a",
        taskId: "task-tenant-a",
        sessionId: "sess-tenant-a",
        executionId: "exec-tenant-a",
        agentId: "agent-a",
        provider: "openai",
        model: "gpt-5.2",
        inputTokens: 10,
        outputTokens: 5,
        costUsd: 0.12,
        budgetScope: "task_execution",
        providerRequestId: "req-a",
        pricingVersion: "v1",
        createdAt: now,
      });
      store.insertCostEvent({
        id: "cost-tenant-b",
        taskId: "task-tenant-b",
        sessionId: "sess-tenant-b",
        executionId: "exec-tenant-b",
        agentId: "agent-b",
        provider: "openai",
        model: "gpt-5.2",
        inputTokens: 10,
        outputTokens: 5,
        costUsd: 0.34,
        budgetScope: "task_execution",
        providerRequestId: "req-b",
        pricingVersion: "v1",
        createdAt: now,
      });
      store.insertEvent({
        id: newId("evt"),
        taskId: "task-tenant-a",
        executionId: "exec-tenant-a",
        eventType: "task:status_changed",
        payloadJson: "{\"tenant\":\"a\"}",
        traceId: "trace-tenant-a",
        createdAt: now,
      });
      store.insertEvent({
        id: newId("evt"),
        taskId: "task-tenant-b",
        executionId: "exec-tenant-b",
        eventType: "task:status_changed",
        payloadJson: "{\"tenant\":\"b\"}",
        traceId: "trace-tenant-b",
        createdAt: now,
      });
      store.insertMessage({
        id: "msg-tenant-a",
        sessionId: "sess-tenant-a",
        direction: "system",
        messageType: "status",
        content: "tenant-a message",
        partsJson: null,
        attachmentsJson: null,
        createdAt: now,
      });
      store.insertMessage({
        id: "msg-tenant-b",
        sessionId: "sess-tenant-b",
        direction: "system",
        messageType: "status",
        content: "tenant-b message",
        partsJson: null,
        attachmentsJson: null,
        createdAt: now,
      });
      store.insertCompactionRecord({
        id: "compact-tenant-a",
        sessionId: "sess-tenant-a",
        taskId: "task-tenant-a",
        stage: "summarize",
        sourceMessageIdsJson: "[\"msg-tenant-a\"]",
        summaryText: "tenant a summary",
        summaryRef: null,
        compactionReason: "token_budget",
        overflowTriggered: 0,
        autoTriggered: 1,
        tokenReductionEstimate: 20,
        createdAt: now,
      });
      store.insertCompactionRecord({
        id: "compact-tenant-b",
        sessionId: "sess-tenant-b",
        taskId: "task-tenant-b",
        stage: "summarize",
        sourceMessageIdsJson: "[\"msg-tenant-b\"]",
        summaryText: "tenant b summary",
        summaryRef: null,
        compactionReason: "token_budget",
        overflowTriggered: 0,
        autoTriggered: 1,
        tokenReductionEstimate: 20,
        createdAt: now,
      });
      store.insertRemoteLog({
        id: "rlog-tenant-a",
        taskId: "task-tenant-a",
        executionId: "exec-tenant-a",
        workerId: "worker-a",
        runtimeInstanceId: "runtime-a",
        level: "info",
        message: "tenant a remote log",
        contextJson: "{}",
        createdAt: now,
      });
      store.insertRemoteLog({
        id: "rlog-tenant-b",
        taskId: "task-tenant-b",
        executionId: "exec-tenant-b",
        workerId: "worker-b",
        runtimeInstanceId: "runtime-b",
        level: "info",
        message: "tenant b remote log",
        contextJson: "{}",
        createdAt: now,
      });
      store.upsertAgentExecutionRecord({
        executionId: "exec-tenant-a",
        taskId: "task-tenant-a",
        agentId: "agent-a",
        workflowId: "single_agent_minimal",
        roleId: "general_executor",
        runKind: "task_run",
        runtimeInstanceId: "runtime-a",
        restartedFromRuntimeInstanceId: null,
        restartGeneration: 0,
        status: "executing",
        planJson: "{}",
        currentStepId: "step-a",
        lastToolName: "bash",
        toolCallCount: 1,
        lastDecisionJson: null,
        lastErrorCode: null,
        retryCount: 0,
        progressMessage: "tenant a running",
        startedAt: now,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      store.upsertAgentExecutionRecord({
        executionId: "exec-tenant-b",
        taskId: "task-tenant-b",
        agentId: "agent-b",
        workflowId: "single_agent_minimal",
        roleId: "general_executor",
        runKind: "task_run",
        runtimeInstanceId: "runtime-b",
        restartedFromRuntimeInstanceId: null,
        restartGeneration: 0,
        status: "executing",
        planJson: "{}",
        currentStepId: "step-b",
        lastToolName: "bash",
        toolCallCount: 1,
        lastDecisionJson: null,
        lastErrorCode: null,
        retryCount: 0,
        progressMessage: "tenant b running",
        startedAt: now,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
      store.insertHeartbeatSnapshot({
        id: "hb-tenant-a",
        executionId: "exec-tenant-a",
        agentId: "agent-a",
        runtimeInstanceId: "runtime-a",
        restartGeneration: 0,
        status: "executing",
        progressMessage: "tenant a beat",
        cpuPct: 10,
        memoryMb: 128,
        sampledAt: now,
      });
      store.insertHeartbeatSnapshot({
        id: "hb-tenant-b",
        executionId: "exec-tenant-b",
        agentId: "agent-b",
        runtimeInstanceId: "runtime-b",
        restartGeneration: 0,
        status: "executing",
        progressMessage: "tenant b beat",
        cpuPct: 10,
        memoryMb: 128,
        sampledAt: now,
      });
      store.insertDeadLetter({
        id: "dead-tenant-a",
        executionId: "exec-tenant-a",
        taskId: "task-tenant-a",
        finalReasonCode: "runtime.timeout",
        retryCount: 1,
        lastErrorMessage: "tenant a dead letter",
        movedAt: now,
      });
      store.insertDeadLetter({
        id: "dead-tenant-b",
        executionId: "exec-tenant-b",
        taskId: "task-tenant-b",
        finalReasonCode: "runtime.timeout",
        retryCount: 1,
        lastErrorMessage: "tenant b dead letter",
        movedAt: now,
      });
      store.insertTakeoverSession({
        id: "takeover-tenant-a",
        taskId: "task-tenant-a",
        executionId: "exec-tenant-a",
        operatorId: "operator-a",
        status: "open",
        reasonCode: "manual.review",
        startedAt: now,
        closedAt: null,
      });
      store.insertTakeoverSession({
        id: "takeover-tenant-b",
        taskId: "task-tenant-b",
        executionId: "exec-tenant-b",
        operatorId: "operator-b",
        status: "open",
        reasonCode: "manual.review",
        startedAt: now,
        closedAt: null,
      });
      store.insertOperatorAction({
        id: "opact-tenant-a",
        takeoverSessionId: "takeover-tenant-a",
        taskId: "task-tenant-a",
        executionId: "exec-tenant-a",
        operatorId: "operator-a",
        actionType: "write_step_output",
        reasonCode: "manual.review",
        actionPayloadJson: "{}",
        beforeStateJson: "{}",
        afterStateJson: "{}",
        createdAt: now,
      });
      store.insertOperatorAction({
        id: "opact-tenant-b",
        takeoverSessionId: "takeover-tenant-b",
        taskId: "task-tenant-b",
        executionId: "exec-tenant-b",
        operatorId: "operator-b",
        actionType: "write_step_output",
        reasonCode: "manual.review",
        actionPayloadJson: "{}",
        beforeStateJson: "{}",
        afterStateJson: "{}",
        createdAt: now,
      });
      store.insertFileLock({
        id: "lock-tenant-a",
        taskId: "task-tenant-a",
        executionId: "exec-tenant-a",
        lockScope: "workspace_file",
        resourcePath: "/tmp/a.txt",
        lockMode: "exclusive",
        ownerId: "agent-a",
        expiresAt: "2099-01-01T00:00:00.000Z",
        createdAt: now,
        updatedAt: now,
      });
      store.insertFileLock({
        id: "lock-tenant-b",
        taskId: "task-tenant-b",
        executionId: "exec-tenant-b",
        lockScope: "workspace_file",
        resourcePath: "/tmp/b.txt",
        lockMode: "exclusive",
        ownerId: "agent-b",
        expiresAt: "2099-01-01T00:00:00.000Z",
        createdAt: now,
        updatedAt: now,
      });
      store.insertArtifact({
        artifactId: "artifact-tenant-a",
        taskId: "task-tenant-a",
        executionId: "exec-tenant-a",
        stepId: "step-a",
        kind: "json",
        storagePath: "/tmp/artifact-a.json",
        fileName: "artifact-a.json",
        mimeType: "application/json",
        sizeBytes: 2,
        checksum: "sha256:a",
        lineageJson: "{}",
        createdAt: now,
      });
      store.insertArtifact({
        artifactId: "artifact-tenant-b",
        taskId: "task-tenant-b",
        executionId: "exec-tenant-b",
        stepId: "step-b",
        kind: "json",
        storagePath: "/tmp/artifact-b.json",
        fileName: "artifact-b.json",
        mimeType: "application/json",
        sizeBytes: 2,
        checksum: "sha256:b",
        lineageJson: "{}",
        createdAt: now,
      });
    });

    provideContext({
      traceId: "trace-request",
      taskId: "req-tenant-a",
      tenantId: "tenant-a",
      requestId: "req-tenant-a",
    }, () => {
      assert.deepEqual(
        store.listTasks().map((task) => task.id),
        ["task-tenant-a"],
      );
      assert.equal(store.getTask("task-tenant-a")?.tenantId, "tenant-a");
      assert.equal(store.getTask("task-tenant-b"), null);
      assert.equal(store.listEventsForTask("task-tenant-a").length, 1);
      assert.equal(store.listEventsForTask("task-tenant-b").length, 0);
      assert.equal(store.listApprovalsByTask("task-tenant-a").length, 1);
      assert.equal(store.listApprovalsByTask("task-tenant-b").length, 0);
      assert.equal(store.listExecutionsByTask("task-tenant-a").length, 1);
      assert.equal(store.listExecutionsByTask("task-tenant-b").length, 0);
      assert.equal(store.getApproval("approval-tenant-a")?.taskId, "task-tenant-a");
      assert.equal(store.getApproval("approval-tenant-b"), null);
      assert.equal(store.getExecution("exec-tenant-a")?.taskId, "task-tenant-a");
      assert.equal(store.getExecution("exec-tenant-b"), null);
      assert.equal(store.listCostEventsByTask("task-tenant-a").length, 1);
      assert.equal(store.listCostEventsByTask("task-tenant-b").length, 0);
      assert.equal(store.sumCostByTask("task-tenant-a"), 0.12);
      assert.equal(store.sumCostByTask("task-tenant-b"), 0);
      assert.equal(store.getWorkflowState("task-tenant-a")?.taskId, "task-tenant-a");
      assert.equal(store.getWorkflowState("task-tenant-b"), null);
      assert.equal(store.getExecutionPrecheck("exec-tenant-a")?.executionId, "exec-tenant-a");
      assert.equal(store.getExecutionPrecheck("exec-tenant-b"), null);
      assert.equal(store.getDeadLetterByExecutionId("exec-tenant-a")?.taskId, "task-tenant-a");
      assert.equal(store.getDeadLetterByExecutionId("exec-tenant-b"), null);
      assert.equal(store.listDeadLettersByTask("task-tenant-a").length, 1);
      assert.equal(store.listDeadLettersByTask("task-tenant-b").length, 0);
      assert.equal(store.getSession("sess-tenant-a")?.taskId, "task-tenant-a");
      assert.equal(store.getSession("sess-tenant-b"), null);
      assert.equal(store.listMessagesBySession("sess-tenant-a").length, 1);
      assert.equal(store.listMessagesBySession("sess-tenant-b").length, 0);
      assert.equal(store.listCompactionRecordsBySession("sess-tenant-a").length, 1);
      assert.equal(store.listCompactionRecordsBySession("sess-tenant-b").length, 0);
      assert.equal(store.listRemoteLogsByTask("task-tenant-a").length, 1);
      assert.equal(store.listRemoteLogsByTask("task-tenant-b").length, 0);
      assert.equal(store.listRemoteLogsByExecution("exec-tenant-a").length, 1);
      assert.equal(store.listRemoteLogsByExecution("exec-tenant-b").length, 0);
      assert.equal(store.getAgentExecutionRecord("exec-tenant-a")?.taskId, "task-tenant-a");
      assert.equal(store.getAgentExecutionRecord("exec-tenant-b"), null);
      assert.equal(store.listAgentExecutionRecordsByTask("task-tenant-a").length, 1);
      assert.equal(store.listAgentExecutionRecordsByTask("task-tenant-b").length, 0);
      assert.equal(store.listHeartbeatSnapshotsByExecution("exec-tenant-a").length, 1);
      assert.equal(store.listHeartbeatSnapshotsByExecution("exec-tenant-b").length, 0);
      assert.equal(store.listTakeoverSessionsByTask("task-tenant-a").length, 1);
      assert.equal(store.listTakeoverSessionsByTask("task-tenant-b").length, 0);
      assert.equal(store.getTakeoverSession("takeover-tenant-a")?.taskId, "task-tenant-a");
      assert.equal(store.getTakeoverSession("takeover-tenant-b"), null);
      assert.equal(store.listOperatorActionsByTask("task-tenant-a").length, 1);
      assert.equal(store.listOperatorActionsByTask("task-tenant-b").length, 0);
      assert.equal(store.buildRuntimeRecoveryView("task-tenant-a").length, 1);
      assert.equal(store.buildRuntimeRecoveryView("task-tenant-b").length, 0);
      assert.deepEqual(
        store.listTaskBoardItems(10).map((item) => item.taskId),
        ["task-tenant-a"],
      );
      assert.deepEqual(
        store.listActiveTasksWithoutWorkflow().map((item) => item.taskId),
        [],
      );
      assert.deepEqual(
        store.listWorkflowStates().map((workflow) => workflow.taskId),
        ["task-tenant-a"],
      );
      assert.deepEqual(
        store.listStaleExecutions("9999-12-31T23:59:59.999Z").map((execution) => execution.executionId),
        ["exec-tenant-a"],
      );
      assert.deepEqual(
        store.listRecoverableExecutingRuns("9999-12-31T23:59:59.999Z").map((record) => record.executionId),
        ["exec-tenant-a"],
      );
      assert.deepEqual(
        store.listBlockedRunsAwaitingApproval().map((record) => record.executionId),
        [],
      );
      assert.deepEqual(
        store.listStaleRuns("9999-12-31T23:59:59.999Z").map((record) => record.executionId),
        ["exec-tenant-a"],
      );
      assert.deepEqual(
        store.listOrphanSessions().map((record) => record.sessionId),
        [],
      );
      assert.deepEqual(
        store.listWorkflowTerminalMismatches().map((record) => record.taskId),
        [],
      );
      assert.deepEqual(
        store.listActiveTasksWithTerminalSessions().map((record) => record.taskId),
        [],
      );
      assert.equal(store.loadExecutionAuthoritativeView("exec-tenant-a")?.task?.id, "task-tenant-a");
      assert.equal(store.loadExecutionAuthoritativeView("exec-tenant-b"), null);
      assert.equal(store.listFileLocksByTask("task-tenant-a").length, 1);
      assert.equal(store.listFileLocksByTask("task-tenant-b").length, 0);
      assert.equal(store.listArtifactsByTask("task-tenant-a").length, 1);
      assert.equal(store.listArtifactsByTask("task-tenant-b").length, 0);
      assert.equal(store.loadTaskSnapshot("task-tenant-a").task.id, "task-tenant-a");
      assert.throws(() => store.loadTaskSnapshot("task-tenant-b"), /Task not found: task-tenant-b/);
    });

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtime context functions throw when called outside provideContext scope", () => {
  // getContext should throw when called outside provideContext
  assert.throws(
    () => getContext(),
    /runtime_context.missing/,
  );

  // getTenantId and getWorkspaceId return null outside context
  assert.equal(getTenantId(), null);
  assert.equal(getWorkspaceId(), null);
});

test("runtime context functions return values inside provideContext scope", () => {
  provideContext({
    traceId: "trace-test",
    taskId: "task-test",
    tenantId: "tenant-test",
    workspaceId: "workspace-test",
    requestId: "req-test",
  }, () => {
    const ctx = getContext();
    assert.equal(ctx.traceId, "trace-test");
    assert.equal(ctx.taskId, "task-test");
    assert.equal(ctx.tenantId, "tenant-test");
    assert.equal(ctx.workspaceId, "workspace-test");

    assert.equal(getTenantId(), "tenant-test");
    assert.equal(getWorkspaceId(), "workspace-test");
    assert.ok(getContextOrNull() !== null);
  });

  // After provideContext, these should throw or return null again
  assert.throws(
    () => getContext(),
    /runtime_context.missing/,
  );
  assert.equal(getTenantId(), null);
});
