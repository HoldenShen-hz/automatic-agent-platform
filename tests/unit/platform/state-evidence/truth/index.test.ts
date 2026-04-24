import assert from "node:assert/strict";
import test from "node:test";

// Re-export test for barrel file
import {
  openAuthoritativeStorageBackend,
  type StorageDriver,
  StorageBackendConfigValidationOptions,
  PostgresStorageBackendRuntimeProfile,
  StorageBackendRuntimeProfile,
  AuthoritativeTaskStore,
  Phase1aStore,
  parseDispatchDecisionTrace,
  mapRuntimeRecoveryRecord,
  resolveTenantScope,
  type TaskSnapshot,
  type PendingAckEvent,
  type ActiveTaskWithoutWorkflow,
  type InvalidWorkflowState,
  type StaleExecutionRecord,
  type OrphanSessionRecord,
  type GatewaySessionTargetCandidate,
  type WorkflowTerminalMismatchRecord,
  type ActiveTaskTerminalSessionRecord,
  type PendingTier1AckRecord,
  type ActiveExecutionConflictRecord,
  type RuntimeRecoveryRecord,
  type Tier1EventRegistryCoverageRecord,
  type Tier1AuditIntegrityVerificationRow,
  type TaskBoardItem,
  type ExecutionAuthoritativeView,
} from "../../../../../src/platform/state-evidence/truth/index.js";

test("StorageDriver type accepts valid values", () => {
  const drivers: StorageDriver[] = ["sqlite", "postgres"];
  assert.equal(drivers.length, 2);
});

test("StorageBackendConfigValidationOptions structure is correct", () => {
  const options: StorageBackendConfigValidationOptions = {
    environment: "test",
  };
  assert.equal(options.environment, "test");
});

test("PostgresStorageBackendRuntimeProfile structure is correct", () => {
  const profile: PostgresStorageBackendRuntimeProfile = {
    dsnConfigured: true,
    dsnSource: "env",
    dsnValue: "postgresql://agent:secret@postgres.internal/testdb?sslmode=require",
    host: "localhost",
    database: "testdb",
    sslmode: "require",
    poolMin: 2,
    poolMax: 10,
    dualRun: false,
    shadowSqlitePath: null,
    schema: "public",
  };
  assert.equal(profile.dsnConfigured, true);
  assert.equal(profile.host, "localhost");
  assert.equal(profile.poolMin, 2);
});

test("StorageBackendRuntimeProfile structure is correct", () => {
  const profile: StorageBackendRuntimeProfile = {
    environment: "development",
    driver: "sqlite",
    issues: [],
    postgres: null,
  };
  assert.equal(profile.environment, "development");
  assert.equal(profile.driver, "sqlite");
  assert.deepEqual(profile.issues, []);
});

test("StorageBackendRuntimeProfile with postgres", () => {
  const profile: StorageBackendRuntimeProfile = {
    environment: "production",
    driver: "postgres",
    issues: [],
    postgres: {
      dsnConfigured: true,
      dsnSource: "env",
      dsnValue: "postgresql://agent:secret@db.example.com/prod?sslmode=require",
      host: "db.example.com",
      database: "prod",
      sslmode: "require",
      poolMin: 5,
      poolMax: 20,
      dualRun: true,
      shadowSqlitePath: "/tmp/shadow.db",
      schema: "public",
    },
  };
  assert.equal(profile.driver, "postgres");
  assert.ok(profile.postgres !== null);
  assert.equal(profile.postgres!.host, "db.example.com");
});

test("storage barrel exports backend opener", () => {
  assert.equal(typeof openAuthoritativeStorageBackend, "function");
});

test("AuthoritativeTaskStore and Phase1aStore are exported and are the same class", () => {
  assert.equal(AuthoritativeTaskStore, Phase1aStore);
});

test("parseDispatchDecisionTrace returns null for invalid input", () => {
  assert.equal(parseDispatchDecisionTrace("invalid json"), null);
  assert.equal(parseDispatchDecisionTrace("null"), null);
  assert.equal(parseDispatchDecisionTrace("[]"), null);
  assert.equal(parseDispatchDecisionTrace('{"ticketId":1}'), null);
  assert.equal(parseDispatchDecisionTrace('{"ticketId":"t1","executionId":1}'), null);
});

test("parseDispatchDecisionTrace returns parsed object for valid input", () => {
  const valid = '{"ticketId":"t1","executionId":"e1","taskId":"task1","queueName":null,"preferredWorkerId":null,"requiredCapabilities":[],"evaluations":[]}';
  const result = parseDispatchDecisionTrace(valid);
  assert.notEqual(result, null);
  assert.equal(result!.ticketId, "t1");
  assert.equal(result!.executionId, "e1");
  assert.equal(result!.taskId, "task1");
});

test("resolveTenantScope returns undefined when no tenant context", () => {
  const result = resolveTenantScope(undefined);
  assert.equal(result, undefined);
});

test("resolveTenantScope returns tenantId when provided", () => {
  const result = resolveTenantScope("tenant-123");
  assert.equal(result, "tenant-123");
});

test("resolveTenantScope returns null as undefined", () => {
  const result = resolveTenantScope(null);
  assert.equal(result, undefined);
});

test("mapRuntimeRecoveryRecord transforms database row correctly", () => {
  const row: Record<string, unknown> = {
    executionId: "exec-1",
    taskId: "task-1",
    divisionId: "div-1",
    taskStatus: "pending",
    status: "executing",
    attempt: 3,
    traceId: "trace-abc",
    workflowId: "wf-1",
    latestErrorCode: "ERR_TIMEOUT",
    updatedAt: "2024-01-01T00:00:00Z",
    lastHeartbeatAt: "2024-01-01T00:01:00Z",
    pendingApprovalId: "approval-1",
    precheckId: "precheck-1",
    precheckExecutionId: "exec-1",
    precheckAllowed: 1,
    precheckReasonCode: null,
    precheckResolvedBudgetUsd: 100.50,
    precheckResolvedTimeoutMs: 30000,
    precheckResolvedSandboxMode: "ephemeral",
    precheckResolvedToolsJson: null,
    precheckResolvedPathsJson: null,
    precheckCheckedAt: "2024-01-01T00:00:00Z",
  };

  const result = mapRuntimeRecoveryRecord(row);

  assert.equal(result.executionId, "exec-1");
  assert.equal(result.taskId, "task-1");
  assert.equal(result.divisionId, "div-1");
  assert.equal(result.taskStatus, "pending");
  assert.equal(result.status, "executing");
  assert.equal(result.attempt, 3);
  assert.equal(result.traceId, "trace-abc");
  assert.equal(result.workflowId, "wf-1");
  assert.equal(result.latestErrorCode, "ERR_TIMEOUT");
  assert.equal(result.pendingApprovalId, "approval-1");
  assert.notEqual(result.latestPrecheck, null);
  assert.equal(result.latestPrecheck!.id, "precheck-1");
  assert.equal(result.latestPrecheck!.allowed, 1);
});

test("mapRuntimeRecoveryRecord handles null precheck", () => {
  const row: Record<string, unknown> = {
    executionId: "exec-1",
    taskId: "task-1",
    divisionId: null,
    taskStatus: "pending",
    status: "executing",
    attempt: 1,
    traceId: "trace-abc",
    workflowId: null,
    latestErrorCode: null,
    updatedAt: "2024-01-01T00:00:00Z",
    lastHeartbeatAt: null,
    pendingApprovalId: null,
  };

  const result = mapRuntimeRecoveryRecord(row);

  assert.equal(result.divisionId, null);
  assert.equal(result.workflowId, null);
  assert.equal(result.latestErrorCode, null);
  assert.equal(result.lastHeartbeatAt, null);
  assert.equal(result.pendingApprovalId, null);
  assert.equal(result.latestPrecheck, null);
});

test("TaskSnapshot interface structure", () => {
  const snapshot: TaskSnapshot = {
    task: {
      id: "task-1",
      parentId: null,
      rootId: "task-1",
      divisionId: "general_ops",
      tenantId: "tenant-1",
      title: "Test Task",
      status: "pending",
      source: "user",
      priority: "normal",
      inputJson: "{\"request\":\"test\"}",
      normalizedInputJson: "{\"request\":\"test\"}",
      outputJson: null,
      estimatedCostUsd: null,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      completedAt: null,
    },
    workflow: null,
    execution: null,
    session: null,
    stepOutputs: [],
    artifacts: [],
    events: [],
    consistency: "authoritative",
    observedAt: "2024-01-01T00:00:00Z",
  };

  assert.equal(snapshot.task.id, "task-1");
  assert.equal(snapshot.consistency, "authoritative");
});

test("RuntimeRecoveryRecord interface structure", () => {
  const record: RuntimeRecoveryRecord = {
    executionId: "exec-1",
    taskId: "task-1",
    divisionId: "div-1",
    taskStatus: "pending",
    status: "executing",
    attempt: 1,
    traceId: "trace-abc",
    workflowId: "wf-1",
    latestErrorCode: null,
    updatedAt: "2024-01-01T00:00:00Z",
    lastHeartbeatAt: null,
    pendingApprovalId: null,
    latestPrecheck: null,
  };

  assert.equal(record.executionId, "exec-1");
  assert.equal(record.taskStatus, "pending");
});

test("ExecutionAuthoritativeView interface structure", () => {
  const view: ExecutionAuthoritativeView = {
    execution: {
      id: "exec-1",
      taskId: "task-1",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "task_run",
      status: "executing",
      inputRef: null,
      traceId: "trace-exec-1",
      attempt: 1,
      timeoutMs: 60_000,
      budgetUsdLimit: null,
      requiresApproval: 0,
      sandboxMode: null,
      allowedToolsJson: null,
      allowedPathsJson: null,
      maxRetries: 0,
      retryBackoff: "none",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: "2024-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
    },
    task: null,
    workflow: null,
    session: null,
    consistency: "authoritative",
    observedAt: "2024-01-01T00:00:00Z",
  };

  assert.equal(view.execution.id, "exec-1");
  assert.equal(view.consistency, "authoritative");
});
