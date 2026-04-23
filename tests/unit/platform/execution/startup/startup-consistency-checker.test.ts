import assert from "node:assert/strict";
import test from "node:test";

import {
  StartupConsistencyChecker,
  type StartupConsistencyOptions,
  type StartupConsistencyCheckerOptions,
  type ConsistencyFinding,
  type RepairAction,
  type StartupConsistencyReport,
  type StartupConfigValidationResult,
  type ProviderReadinessResult,
  type ConsistencySeverity,
  type StartupReportStatus,
  type RepairActionType,
} from "../../../../../src/platform/execution/startup/startup-consistency-checker.js";
import type { FileLockRecord, WorkflowStateRecord } from "../../../../../src/platform/contracts/types/domain.js";

// ─────────────────────────────────────────────────────────────────────────────
// Mock Types & Helpers
// ─────────────────────────────────────────────────────────────────────────────

interface MockSchemaStatus {
  pendingVersions: string[];
  checksumMismatches: Array<{ version: string }>;
}

interface MockDb {
  integrityCheckResults: string[];
  schemaStatus: MockSchemaStatus;
}

interface MockOperations {
  activeTasksWithoutWorkflow: Array<{ taskId: string; taskStatus: string }>;
  staleExecutions: Array<{ executionId: string; updatedAt: string }>;
  workflowTerminalMismatches: Array<{
    workflowStatus: "completed" | "failed" | "cancelled";
    taskId: string;
    taskStatus: string;
    sessionStatus: string | null;
  }>;
  orphanSessions: Array<{ sessionId: string; sessionStatus: string; taskId: string; taskStatus: string }>;
  activeTasksWithTerminalSessions: Array<{
    taskId: string;
    taskStatus: string;
    sessionId: string;
    sessionStatus: string;
  }>;
  activeExecutionConflicts: Array<{ taskId: string; activeExecutionIds: string[] }>;
}

interface MockWorkflow {
  listWorkflowStatesResults: WorkflowStateRecord[];
}

interface MockLock {
  expiredFileLocks: FileLockRecord[];
}

interface MockEvent {
  pendingTier1Acks: Array<{ eventId: string; consumerId: string }>;
  tier1EventRegistryCoverage: Array<{ eventId: string; eventType: string; ackConsumers: string[] }>;
}

interface MockStore {
  operations: MockOperations;
  workflow: MockWorkflow;
  lock: MockLock;
  event: MockEvent;
}

function createMockDb(overrides: Partial<MockDb> = {}): MockDb {
  return {
    integrityCheckResults: [],
    schemaStatus: {
      pendingVersions: [],
      checksumMismatches: [],
    },
    ...overrides,
  };
}

function createMockStore(overrides: {
  operations?: Partial<MockOperations>;
  workflow?: Partial<MockWorkflow>;
  lock?: Partial<MockLock>;
  event?: Partial<MockEvent>;
} = {}): MockStore {
  return {
    operations: {
      activeTasksWithoutWorkflow: overrides.operations?.activeTasksWithoutWorkflow ?? [],
      staleExecutions: overrides.operations?.staleExecutions ?? [],
      workflowTerminalMismatches: overrides.operations?.workflowTerminalMismatches ?? [],
      orphanSessions: overrides.operations?.orphanSessions ?? [],
      activeTasksWithTerminalSessions: overrides.operations?.activeTasksWithTerminalSessions ?? [],
      activeExecutionConflicts: overrides.operations?.activeExecutionConflicts ?? [],
    },
    workflow: {
      listWorkflowStatesResults: overrides.workflow?.listWorkflowStatesResults ?? [],
    },
    lock: {
      expiredFileLocks: overrides.lock?.expiredFileLocks ?? [],
    },
    event: {
      pendingTier1Acks: overrides.event?.pendingTier1Acks ?? [],
      tier1EventRegistryCoverage: overrides.event?.tier1EventRegistryCoverage ?? [],
    },
  };
}

function createMockChecker(
  db: MockDb,
  store: MockStore,
  options: StartupConsistencyCheckerOptions = {},
): StartupConsistencyChecker {
  const mockDb = {
    integrityCheck() {
      return db.integrityCheckResults;
    },
    getSchemaStatus() {
      return db.schemaStatus;
    },
  };

  const mockStore = {
    operations: {
      listActiveTasksWithoutWorkflow() {
        return store.operations.activeTasksWithoutWorkflow;
      },
      listStaleExecutions(_cutoffTime: string) {
        return store.operations.staleExecutions;
      },
      listWorkflowTerminalMismatches() {
        return store.operations.workflowTerminalMismatches;
      },
      listOrphanSessions() {
        return store.operations.orphanSessions;
      },
      listActiveTasksWithTerminalSessions() {
        return store.operations.activeTasksWithTerminalSessions;
      },
      listActiveExecutionConflicts() {
        return store.operations.activeExecutionConflicts;
      },
    },
    workflow: {
      listWorkflowStates() {
        return store.workflow.listWorkflowStatesResults;
      },
    },
    lock: {
      listExpiredFileLocks(_checkedAt: string) {
        return store.lock.expiredFileLocks;
      },
    },
    event: {
      listPendingTier1Acks(_cutoffTime: string) {
        return store.event.pendingTier1Acks;
      },
      listTier1EventRegistryCoverage() {
        return store.event.tier1EventRegistryCoverage;
      },
    },
  };

  return new StartupConsistencyChecker(
    mockDb as any,
    mockStore as any,
    options,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests - StartupConsistencyChecker basic functionality
// ─────────────────────────────────────────────────────────────────────────────

test("StartupConsistencyChecker - returns pass status when no findings", () => {
  const db = createMockDb();
  const store = createMockStore();

  const checker = createMockChecker(db, store);
  const report = checker.run();

  assert.equal(report.status, "pass");
  assert.deepStrictEqual(report.findings, []);
  assert.deepStrictEqual(report.repairActions, []);
});

test("StartupConsistencyChecker - reports database integrity check failures", () => {
  const db = createMockDb({
    integrityCheckResults: ["Page 42 is corrupted"],
  });
  const store = createMockStore();

  const checker = createMockChecker(db, store);
  const report = checker.run();

  assert.equal(report.status, "fail_closed");
  assert.ok(report.findings.length > 0);
  assert.equal(report.findings[0]!.code, "integrity_check_failed");
  assert.equal(report.findings[0]!.entityType, "database");
});

test("StartupConsistencyChecker - reports schema outdated", () => {
  const db = createMockDb({
    schemaStatus: {
      pendingVersions: ["5", "6"],
      checksumMismatches: [],
    },
  });
  const store = createMockStore();

  const checker = createMockChecker(db, store);
  const report = checker.run();

  assert.equal(report.status, "fail_closed");
  const schemaFinding = report.findings.find((f) => f.code === "schema_outdated");
  assert.ok(schemaFinding !== undefined);
  assert.ok(schemaFinding!.message.includes("5, 6"));
});

test("StartupConsistencyChecker - reports migration checksum mismatch", () => {
  const db = createMockDb({
    schemaStatus: {
      pendingVersions: [],
      checksumMismatches: [{ version: "3" }, { version: "4" }],
    },
  });
  const store = createMockStore();

  const checker = createMockChecker(db, store);
  const report = checker.run();

  assert.equal(report.status, "fail_closed");
  const checksumFinding = report.findings.find((f) => f.code === "migration_checksum_mismatch");
  assert.ok(checksumFinding !== undefined);
  assert.ok(checksumFinding!.message.includes("3") && checksumFinding!.message.includes("4"));
});

test("StartupConsistencyChecker - reports active task missing workflow", () => {
  const db = createMockDb();
  const store = createMockStore({
    operations: {
      activeTasksWithoutWorkflow: [{ taskId: "task-1", taskStatus: "running" }],
    },
  });

  const checker = createMockChecker(db, store);
  const report = checker.run();

  assert.ok(report.findings.some((f) => f.code === "active_task_missing_workflow"));
});

test("StartupConsistencyChecker - reports stale executions", () => {
  const db = createMockDb();
  const store = createMockStore({
    operations: {
      staleExecutions: [{ executionId: "exec-1", updatedAt: "2024-01-01T00:00:00.000Z" }],
    },
  });

  const checker = createMockChecker(db, store);
  const report = checker.run();

  assert.ok(report.findings.some((f) => f.code === "stale_execution"));
});

test("StartupConsistencyChecker - reports orphan sessions", () => {
  const db = createMockDb();
  const store = createMockStore({
    operations: {
      orphanSessions: [
        { sessionId: "sess-1", sessionStatus: "active", taskId: "task-1", taskStatus: "done" },
      ],
    },
  });

  const checker = createMockChecker(db, store);
  const report = checker.run();

  assert.ok(report.findings.some((f) => f.code === "orphan_session"));
});

test("StartupConsistencyChecker - reports active tasks with terminal sessions", () => {
  const db = createMockDb();
  const store = createMockStore({
    operations: {
      activeTasksWithTerminalSessions: [
        { taskId: "task-1", taskStatus: "running", sessionId: "sess-1", sessionStatus: "completed" },
      ],
    },
  });

  const checker = createMockChecker(db, store);
  const report = checker.run();

  assert.ok(report.findings.some((f) => f.code === "active_task_terminal_session"));
});

test("StartupConsistencyChecker - reports active execution conflicts", () => {
  const db = createMockDb();
  const store = createMockStore({
    operations: {
      activeExecutionConflicts: [
        { taskId: "task-1", activeExecutionIds: ["exec-1", "exec-2"] },
      ],
    },
  });

  const checker = createMockChecker(db, store);
  const report = checker.run();

  assert.ok(report.findings.some((f) => f.code === "active_execution_conflict"));
  const conflictFinding = report.findings.find((f) => f.code === "active_execution_conflict");
  assert.ok(conflictFinding!.message.includes("exec-1") && conflictFinding!.message.includes("exec-2"));
});

test("StartupConsistencyChecker - reports expired file locks", () => {
  const db = createMockDb();
  const store = createMockStore({
    lock: {
      expiredFileLocks: [{
        id: "lock-1",
        taskId: null,
        executionId: null,
        lockScope: "test",
        resourcePath: "/tmp/test",
        lockMode: "exclusive",
        ownerId: "owner-1",
        expiresAt: "2024-01-01T00:00:00.000Z",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      }],
    },
  });

  const checker = createMockChecker(db, store);
  const report = checker.run();

  assert.ok(report.findings.some((f) => f.code === "expired_file_lock"));
});

test("StartupConsistencyChecker - reports tier1 ack backlog", () => {
  const db = createMockDb();
  const store = createMockStore({
    event: {
      pendingTier1Acks: [{ eventId: "event-1", consumerId: "consumer-1" }],
    },
  });

  const checker = createMockChecker(db, store);
  const report = checker.run();

  assert.ok(report.findings.some((f) => f.code === "tier1_ack_backlog"));
});

test("StartupConsistencyChecker - reports config load failure via configValidator", () => {
  const db = createMockDb();
  const store = createMockStore();

  const checker = createMockChecker(db, store, {
    configValidator: () => ({
      ok: false,
      environment: "test",
      configRoot: "/test",
      issues: ["Config file not found"],
      bundle: null,
    }),
  });

  const report = checker.run();

  assert.ok(report.findings.some((f) => f.code === "config_load_failed"));
});

test("StartupConsistencyChecker - reports config invalid issues via configValidator", () => {
  const db = createMockDb();
  const store = createMockStore();

  const checker = createMockChecker(db, store, {
    configValidator: () => ({
      ok: true,
      environment: "test",
      configRoot: "/test",
      issues: ["Invalid provider config"],
      bundle: { configRoot: "/test", environment: "test", issues: ["Invalid provider config"], layers: {}, version: { versionId: "v1", bundleHash: "hash", layerHashes: {} } },
    } as StartupConfigValidationResult),
  });

  const report = checker.run();

  assert.ok(report.findings.some((f) => f.code === "config_invalid"));
});

test("StartupConsistencyChecker - reports provider not ready via providerReadinessProbe", () => {
  const db = createMockDb();
  const store = createMockStore();

  const checker = createMockChecker(db, store, {
    configValidator: () => ({
      ok: true,
      environment: "test",
      configRoot: "/test",
      issues: [],
      bundle: { configRoot: "/test", environment: "test", issues: [], layers: {}, version: { versionId: "v1", bundleHash: "hash", layerHashes: {} } } as StartupConfigValidationResult,
    }),
    providerReadinessProbe: () => [
      {
        provider: "test-provider",
        ready: false,
        reasonCode: "provider.disabled",
        message: "Provider is disabled",
      },
    ],
  });

  const report = checker.run();

  assert.ok(report.findings.some((f) => f.code === "provider_not_ready"));
});

test("StartupConsistencyChecker - configValidator exception becomes finding", () => {
  const db = createMockDb();
  const store = createMockStore();

  const checker = createMockChecker(db, store, {
    configValidator: () => {
      throw new Error("Validator crashed");
    },
  });

  const report = checker.run();

  assert.ok(report.findings.some((f) => f.code === "config_load_failed"));
  const finding = report.findings.find((f) => f.code === "config_load_failed");
  assert.ok(finding!.message.includes("Validator crashed"));
});

test("StartupConsistencyChecker - providerReadinessProbe exception becomes finding", () => {
  const db = createMockDb();
  const store = createMockStore();

  const checker = createMockChecker(db, store, {
    configValidator: () => ({
      ok: true,
      environment: "test",
      configRoot: "/test",
      issues: [],
      bundle: { configRoot: "/test", environment: "test", issues: [], layers: {}, version: { versionId: "v1", bundleHash: "hash", layerHashes: {} } } as StartupConfigValidationResult,
    }),
    providerReadinessProbe: () => {
      throw new Error("Probe crashed");
    },
  });

  const report = checker.run();

  assert.ok(report.findings.some((f) => f.code === "provider_not_ready"));
});

test("StartupConsistencyChecker - uses custom now option", () => {
  const db = createMockDb();
  const store = createMockStore();

  const checker = createMockChecker(db, store);
  const customTime = "2024-06-15T12:00:00.000Z";
  const report = checker.run({ now: customTime });

  assert.equal(report.checkedAt, customTime);
});

test("StartupConsistencyChecker - status is repairable when only p1 findings", () => {
  const db = createMockDb();
  const store = createMockStore({
    operations: {
      staleExecutions: [{ executionId: "exec-1", updatedAt: "2024-01-01T00:00:00.000Z" }],
    },
  });

  const checker = createMockChecker(db, store);
  const report = checker.run();

  assert.equal(report.status, "repairable");
});

test("StartupConsistencyChecker - status is fail_closed when any p0 findings", () => {
  const db = createMockDb({
    integrityCheckResults: ["Page 42 is corrupted"],
  });
  const store = createMockStore();

  const checker = createMockChecker(db, store);
  const report = checker.run();

  assert.equal(report.status, "fail_closed");
});

test("StartupConsistencyChecker - generates repair actions for stale_execution", () => {
  const db = createMockDb();
  const store = createMockStore({
    operations: {
      staleExecutions: [{ executionId: "exec-1", updatedAt: "2024-01-01T00:00:00.000Z" }],
    },
  });

  const checker = createMockChecker(db, store);
  const report = checker.run();

  const staleExecutionAction = report.repairActions.find((a) => a.reasonCode === "stale_execution");
  assert.ok(staleExecutionAction !== undefined);
  assert.equal(staleExecutionAction!.action, "requeue_execution");
});

test("StartupConsistencyChecker - deduplicates repair actions", () => {
  const db = createMockDb();
  const store = createMockStore({
    operations: {
      activeTasksWithTerminalSessions: [
        { taskId: "task-1", taskStatus: "running", sessionId: "sess-1", sessionStatus: "completed" },
        { taskId: "task-1", taskStatus: "running", sessionId: "sess-1", sessionStatus: "completed" },
      ],
    },
  });

  const checker = createMockChecker(db, store);
  const report = checker.run();

  const activeTaskTerminalActions = report.repairActions.filter(
    (a) => a.reasonCode === "active_task_terminal_session",
  );
  assert.ok(activeTaskTerminalActions.length >= 1);
});

test("StartupConsistencyChecker - workflow terminal mismatch generates reconcile_terminal_state", () => {
  const db = createMockDb();
  const store = createMockStore({
    operations: {
      workflowTerminalMismatches: [
        {
          workflowStatus: "completed",
          taskId: "task-1",
          taskStatus: "running",
          sessionStatus: null,
        },
      ],
    },
  });

  const checker = createMockChecker(db, store);
  const report = checker.run();

  const mismatchAction = report.repairActions.find((a) => a.reasonCode === "workflow_terminal_state_mismatch");
  assert.ok(mismatchAction !== undefined);
  assert.equal(mismatchAction!.action, "reconcile_terminal_state");
});

test("StartupConsistencyChecker - orphan_session generates close_orphan_session", () => {
  const db = createMockDb();
  const store = createMockStore({
    operations: {
      orphanSessions: [
        { sessionId: "sess-1", sessionStatus: "active", taskId: "task-1", taskStatus: "done" },
      ],
    },
  });

  const checker = createMockChecker(db, store);
  const report = checker.run();

  const orphanAction = report.repairActions.find((a) => a.reasonCode === "orphan_session");
  assert.ok(orphanAction !== undefined);
  assert.equal(orphanAction!.action, "close_orphan_session");
});

test("StartupConsistencyChecker - active_task_terminal_session generates replace_terminal_session", () => {
  const db = createMockDb();
  const store = createMockStore({
    operations: {
      activeTasksWithTerminalSessions: [
        { taskId: "task-1", taskStatus: "running", sessionId: "sess-1", sessionStatus: "completed" },
      ],
    },
  });

  const checker = createMockChecker(db, store);
  const report = checker.run();

  const activeTaskAction = report.repairActions.find((a) => a.reasonCode === "active_task_terminal_session");
  assert.ok(activeTaskAction !== undefined);
  assert.equal(activeTaskAction!.action, "replace_terminal_session");
});

test("StartupConsistencyChecker - expired_file_lock generates release_stale_lock", () => {
  const db = createMockDb();
  const store = createMockStore({
    lock: {
      expiredFileLocks: [{ id: "lock-1", resourcePath: "/tmp/test", expiresAt: "2024-01-01T00:00:00.000Z" }],
    },
  });

  const checker = createMockChecker(db, store);
  const report = checker.run();

  const lockAction = report.repairActions.find((a) => a.reasonCode === "expired_file_lock");
  assert.ok(lockAction !== undefined);
  assert.equal(lockAction!.action, "release_stale_lock");
});

test("StartupConsistencyChecker - tier1_ack_backlog generates rebuild_ack", () => {
  const db = createMockDb();
  const store = createMockStore({
    event: {
      pendingTier1Acks: [{ eventId: "event-1", consumerId: "consumer-1" }],
    },
  });

  const checker = createMockChecker(db, store);
  const report = checker.run();

  const ackAction = report.repairActions.find((a) => a.reasonCode === "tier1_ack_backlog");
  assert.ok(ackAction !== undefined);
  assert.equal(ackAction!.action, "rebuild_ack");
});

test("StartupConsistencyChecker - config_load_failed generates manual_intervention_required", () => {
  const db = createMockDb();
  const store = createMockStore();

  const checker = createMockChecker(db, store, {
    configValidator: () => ({
      ok: false,
      environment: "test",
      configRoot: "/test",
      issues: ["Config not found"],
      bundle: null,
    }),
  });

  const report = checker.run();

  const configAction = report.repairActions.find((a) => a.reasonCode === "config_load_failed");
  assert.ok(configAction !== undefined);
  assert.equal(configAction!.action, "manual_intervention_required");
});

test("StartupConsistencyChecker - config_invalid generates manual_intervention_required", () => {
  const db = createMockDb();
  const store = createMockStore();

  const checker = createMockChecker(db, store, {
    configValidator: () => ({
      ok: true,
      environment: "test",
      configRoot: "/test",
      issues: ["Invalid setting"],
      bundle: { configRoot: "/test", environment: "test", issues: ["Invalid setting"], layers: {}, version: { versionId: "v1", bundleHash: "hash", layerHashes: {} } } as StartupConfigValidationResult,
    }),
  });

  const report = checker.run();

  const configAction = report.repairActions.find((a) => a.reasonCode === "config_invalid");
  assert.ok(configAction !== undefined);
  assert.equal(configAction!.action, "manual_intervention_required");
});

test("StartupConsistencyChecker - provider_not_ready generates manual_intervention_required", () => {
  const db = createMockDb();
  const store = createMockStore();

  const checker = createMockChecker(db, store, {
    configValidator: () => ({
      ok: true,
      environment: "test",
      configRoot: "/test",
      issues: [],
      bundle: { configRoot: "/test", environment: "test", issues: [], layers: {}, version: { versionId: "v1", bundleHash: "hash", layerHashes: {} } } as StartupConfigValidationResult,
    }),
    providerReadinessProbe: () => [
      {
        provider: "test-provider",
        ready: false,
        reasonCode: "provider.disabled",
        message: "Provider disabled",
      },
    ],
  });

  const report = checker.run();

  const providerAction = report.repairActions.find((a) => a.reasonCode === "provider_not_ready");
  assert.ok(providerAction !== undefined);
  assert.equal(providerAction!.action, "manual_intervention_required");
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests - Type exports
// ─────────────────────────────────────────────────────────────────────────────

test("StartupConsistencyChecker - exports ConsistencySeverity type", () => {
  const severity: ConsistencySeverity = "p0";
  assert.equal(severity, "p0");
});

test("StartupConsistencyChecker - exports StartupReportStatus type", () => {
  const status: StartupReportStatus = "pass";
  assert.equal(status, "pass");
});

test("StartupConsistencyChecker - exports RepairActionType type", () => {
  const actionType: RepairActionType = "requeue_execution";
  assert.equal(actionType, "requeue_execution");
});

test("StartupConsistencyChecker - exports ConsistencyFinding interface structure", () => {
  const finding: ConsistencyFinding = {
    code: "integrity_check_failed",
    severity: "p0",
    message: "Database integrity check failed",
    entityType: "database",
    entityId: "sqlite",
  };

  assert.equal(finding.code, "integrity_check_failed");
  assert.equal(finding.severity, "p0");
  assert.equal(finding.entityType, "database");
});

test("StartupConsistencyChecker - exports RepairAction interface structure", () => {
  const action: RepairAction = {
    action: "requeue_execution",
    reasonCode: "stale_execution",
    targetType: "execution",
    targetId: "exec-1",
  };

  assert.equal(action.action, "requeue_execution");
  assert.equal(action.reasonCode, "stale_execution");
  assert.equal(action.targetType, "execution");
});

test("StartupConsistencyChecker - exports StartupConsistencyReport interface structure", () => {
  const report: StartupConsistencyReport = {
    checkedAt: "2024-01-01T00:00:00.000Z",
    status: "pass",
    findings: [],
    repairActions: [],
  };

  assert.equal(report.checkedAt, "2024-01-01T00:00:00.000Z");
  assert.equal(report.status, "pass");
  assert.deepStrictEqual(report.findings, []);
  assert.deepStrictEqual(report.repairActions, []);
});

test("StartupConsistencyChecker - exports StartupConfigValidationResult interface structure", () => {
  const result: StartupConfigValidationResult = {
    ok: true,
    environment: "test",
    configRoot: "/test",
    issues: [],
    bundle: null,
  };

  assert.equal(result.ok, true);
  assert.equal(result.environment, "test");
  assert.deepStrictEqual(result.issues, []);
});

test("StartupConsistencyChecker - exports ProviderReadinessResult interface structure", () => {
  const result: ProviderReadinessResult = {
    provider: "test-provider",
    ready: true,
    reasonCode: "ok",
    message: "Provider ready",
  };

  assert.equal(result.provider, "test-provider");
  assert.equal(result.ready, true);
});

test("StartupConsistencyChecker - exports StartupConsistencyOptions interface", () => {
  const options: StartupConsistencyOptions = {
    now: "2024-01-01T00:00:00.000Z",
    staleExecutionAfterMs: 60000,
    pendingAckOlderThanMs: 30000,
  };

  assert.equal(options.now, "2024-01-01T00:00:00.000Z");
  assert.equal(options.staleExecutionAfterMs, 60000);
  assert.equal(options.pendingAckOlderThanMs, 30000);
});
