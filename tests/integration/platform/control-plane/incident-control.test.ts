/**
 * Integration Test: Incident Control
 *
 * Tests the core incident control services including:
 * - HumanTakeoverService: session management, task takeover, input modification
 * - AutoStopLossService: anomaly response and stop-loss playbooks
 * - TenantExecutionIsolationService: tenant quota tracking and isolation
 *
 * Uses createIntegrationContext() with SQLite for integration testing.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext, createSeededIntegrationContext } from "../../../helpers/integration-context.js";
import { HumanTakeoverService } from "../../../../src/platform/five-plane-control-plane/incident-control/human-takeover-service.js";
import {
  AutoStopLossService,
  type EscalationLevel,
  type StopLossAction,
  type StopLossPlaybook,
} from "../../../../src/platform/five-plane-control-plane/incident-control/auto-stop-loss-service.js";
import {
  TenantExecutionIsolationService,
  TENANT_ISOLATION_DDL,
  type QuotaKind,
  type EnforcementAction,
} from "../../../../src/platform/five-plane-control-plane/incident-control/tenant-execution-isolation-service.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";

function ensureTenantIsolationSchema(ctx: ReturnType<typeof createIntegrationContext>): void {
  ctx.db.connection.exec(`
    DROP TABLE IF EXISTS tenant_quotas;
    DROP TABLE IF EXISTS quota_usage_samples;
    DROP TABLE IF EXISTS execution_resource_usage;
    DROP TABLE IF EXISTS noisy_neighbor_signals;
  `);
  ctx.db.connection.exec(TENANT_ISOLATION_DDL);
}

test("HumanTakeoverService: openSession creates takeover session", () => {
  const ctx = createSeededIntegrationContext("aa-takeover-open-");
  try {
    const service = new HumanTakeoverService(ctx.db, ctx.store);

    const result = service.openSession({
      taskId: "task-seeded-001",
      operatorId: "operator-001",
      reasonCode: "test_takeover",
      tenantId: null,
    });

    assert.ok(result.takeoverSessionId.startsWith("takeover_"));
    assert.strictEqual(result.taskId, "task-seeded-001");
    assert.ok(result.operatorActionId.startsWith("opact_"));

    // Verify session was created
    const session = ctx.store.approval.getTakeoverSession(result.takeoverSessionId, null);
    assert.ok(session, "Session should be created");
    assert.strictEqual(session.status, "open");
    assert.strictEqual(session.operatorId, "operator-001");
  } finally {
    ctx.cleanup();
  }
});

test("HumanTakeoverService: openSession emits tier_2 event", () => {
  const ctx = createSeededIntegrationContext("aa-takeover-event-");
  try {
    const service = new HumanTakeoverService(ctx.db, ctx.store);

    const result = service.openSession({
      taskId: "task-seeded-001",
      operatorId: "operator-001",
      reasonCode: "test_takeover",
      tenantId: null,
    });

    const events = ctx.store.listEventsForTask("task-seeded-001");
    const takeoverEvent = events.find((e) => e.eventType === "takeover:session_opened");
    assert.ok(takeoverEvent, "Should have takeover:session_opened event");
    const payload = JSON.parse(takeoverEvent.payloadJson);
    assert.strictEqual(payload.takeoverSessionId, result.takeoverSessionId);
    assert.strictEqual(payload.operatorId, "operator-001");
  } finally {
    ctx.cleanup();
  }
});

test("HumanTakeoverService: modifyInput updates task input", () => {
  const ctx = createSeededIntegrationContext("aa-takeover-input-");
  try {
    const service = new HumanTakeoverService(ctx.db, ctx.store);

    const session = service.openSession({
      taskId: "task-seeded-001",
      operatorId: "operator-001",
      reasonCode: "test_takeover",
      tenantId: null,
    });

    const result = service.modifyInput({
      takeoverSessionId: session.takeoverSessionId,
      inputJson: '{"prompt": "modified prompt", "context": {"updated": true}}',
      reasonCode: "test_modify_input",
      tenantId: null,
    });

    assert.ok(result.operatorActionId.startsWith("opact_"));
    assert.strictEqual(result.taskId, "task-seeded-001");

    // Verify the task input was updated
    const task = ctx.store.getTask("task-seeded-001", null);
    assert.ok(task, "Task should exist");
    const input = JSON.parse(task.inputJson);
    assert.strictEqual(input.prompt, "modified prompt");
  } finally {
    ctx.cleanup();
  }
});

test("HumanTakeoverService: completeTask with done status", () => {
  const ctx = createSeededIntegrationContext("aa-takeover-complete-");
  try {
    const service = new HumanTakeoverService(ctx.db, ctx.store);

    const session = service.openSession({
      taskId: "task-seeded-001",
      operatorId: "operator-001",
      reasonCode: "test_takeover",
      tenantId: null,
    });

    const result = service.completeTask({
      takeoverSessionId: session.takeoverSessionId,
      terminalStatus: "done",
      reasonCode: "test_complete",
      outputJson: '{"result": "completed by operator"}',
      tenantId: null,
    });

    assert.ok(result.operatorActionId.startsWith("opact_"));

    // Verify task is done
    const task = ctx.store.getTask("task-seeded-001", null);
    assert.ok(task, "Task should exist");
    assert.strictEqual(task.status, "done");
    assert.ok(task.completedAt, "Task should have completedAt");
  } finally {
    ctx.cleanup();
  }
});

test("HumanTakeoverService: completeTask with failed status", () => {
  const ctx = createSeededIntegrationContext("aa-takeover-fail-");
  try {
    const service = new HumanTakeoverService(ctx.db, ctx.store);

    const session = service.openSession({
      taskId: "task-seeded-001",
      operatorId: "operator-001",
      reasonCode: "test_takeover",
      tenantId: null,
    });

    service.completeTask({
      takeoverSessionId: session.takeoverSessionId,
      terminalStatus: "failed",
      reasonCode: "operator_failed",
      tenantId: null,
    });

    // Verify task is failed
    const task = ctx.store.getTask("task-seeded-001", null);
    assert.ok(task, "Task should exist");
    assert.strictEqual(task.status, "failed");
    assert.strictEqual(task.errorCode, "operator_failed");
  } finally {
    ctx.cleanup();
  }
});

test("HumanTakeoverService: openSession throws for non-existent task", () => {
  const ctx = createIntegrationContext("aa-takeover-notfound-");
  try {
    const service = new HumanTakeoverService(ctx.db, ctx.store);

    let error: Error | null = null;
    try {
      service.openSession({
        taskId: "non-existent-task",
        operatorId: "operator-001",
        reasonCode: "test",
        tenantId: null,
      });
    } catch (e) {
      error = e as Error;
    }
    assert.ok(error, "Should throw for non-existent task");
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: creates service instance with explicit config", () => {
  const ctx = createIntegrationContext("aa-autostop-basic-");
  try {
    const service = new AutoStopLossService({
      config: {
        enabled: true,
        defaultCooldownMs: 60000,
        maxEventsPerHour: 10,
        enableAutoExecution: true,
        enableHumanEscalation: true,
        healthCheckIntervalMs: 30000,
      },
    });

    assert.ok(service, "Service should be created");
    assert.strictEqual(service.isEnabled(), true);
    assert.strictEqual(service.getConfig().maxEventsPerHour, 10);
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: updateHealthCheck stores latest health snapshot", () => {
  const ctx = createIntegrationContext("aa-autostop-health-");
  try {
    const service = new AutoStopLossService();

    service.updateHealthCheck({
      status: "degraded",
      anomalySeverity: "warning",
      activeExecutions: 3,
      queuedTasks: 8,
      memoryUsageMb: 768,
      eventLoopLagMs: 22,
      providerHealth: "degraded",
    });

    const health = service.getLastHealthCheck();
    assert.ok(health, "Should store health snapshot");
    assert.strictEqual(health?.status, "degraded");
    assert.strictEqual(health?.memoryUsageMb, 768);
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: registerPlaybook stores playbook and appears in listing", () => {
  const ctx = createIntegrationContext("aa-autostop-playbook-");
  try {
    const service = new AutoStopLossService();

    const playbook: StopLossPlaybook = {
      id: "playbook-test-001",
      name: "Test Playbook",
      description: "A test stop-loss playbook",
      triggerCondition: {
        type: "anomaly_severity",
        severityThreshold: "warning",
      },
      actions: ["circuit_break", "scale_down"],
      cooldownMs: 300000,
      maxExecutionsPerHour: 5,
      requireHumanApproval: false,
      enabled: true,
    };

    service.registerPlaybook(playbook);

    const retrieved = service.getPlaybook("playbook-test-001");
    const playbookIds = service.listPlaybooks().map((item) => item.id);
    assert.ok(retrieved, "Playbook should be retrievable");
    assert.strictEqual(retrieved?.name, "Test Playbook");
    assert.ok(playbookIds.includes("playbook-test-001"));
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: executePlaybook records execution history", async () => {
  const ctx = createIntegrationContext("aa-autostop-record-");
  try {
    const service = new AutoStopLossService();
    const playbook: StopLossPlaybook = {
      id: "playbook-001",
      name: "Test Playbook",
      description: "Executes one protective action",
      triggerCondition: { type: "anomaly_severity", severityThreshold: "warning" },
      actions: ["circuit_break"],
      cooldownMs: 60000,
      maxExecutionsPerHour: 5,
      requireHumanApproval: false,
      enabled: true,
    };

    const event = await service.executePlaybook(playbook, "High error rate detected");
    const events = service.getExecutionHistory(10);
    const lastEvent = events.at(-1);

    assert.strictEqual(event.playbookName, "Test Playbook");
    assert.ok(events.length > 0, "Should have recorded events");
    assert.strictEqual(lastEvent?.playbookName, "Test Playbook");
    assert.deepStrictEqual(lastEvent?.actionsExecuted, ["circuit_break"]);
    assert.strictEqual(lastEvent?.escalationLevel, "warn");
  } finally {
    ctx.cleanup();
  }
});

test("TenantExecutionIsolationService: creates tenant quota", () => {
  const ctx = createIntegrationContext("aa-tenant-quota-");
  try {
    ensureTenantIsolationSchema(ctx);
    const service = new TenantExecutionIsolationService(ctx.db);

    service.defineQuota({
      tenantId: "tenant-001",
      quotaKind: "executions_per_minute",
      limitValue: 100,
      windowSeconds: 60,
      enforcementAction: "throttle",
      enabled: true,
    });

    const quota = service.getQuota("tenant-001", "executions_per_minute");
    assert.ok(quota, "Quota should be created");
    assert.strictEqual(quota?.tenantId, "tenant-001");
    assert.strictEqual(quota?.limitValue, 100);
    assert.strictEqual(quota?.windowSeconds, 60);
  } finally {
    ctx.cleanup();
  }
});

test("TenantExecutionIsolationService: records compute-minute quota usage from resource samples", () => {
  const ctx = createIntegrationContext("aa-tenant-usage-");
  try {
    ensureTenantIsolationSchema(ctx);
    const service = new TenantExecutionIsolationService(ctx.db);

    service.defineQuota({
      tenantId: "tenant-002",
      quotaKind: "total_compute_minutes",
      limitValue: 30,
      windowSeconds: 60,
      enforcementAction: "reject",
      enabled: true,
    });

    service.recordResourceUsage({
      executionId: "exec-tenant-002",
      tenantId: "tenant-002",
      cpuMs: 1250,
      memoryBytes: 256 * 1024 * 1024,
      networkBytes: 2 * 1024 * 1024,
      durationMs: 25 * 60 * 1000,
      recordedAt: nowIso(),
    });

    const usage = service.getQuotaUsage("tenant-002", "total_compute_minutes");
    assert.ok(usage, "Should return quota usage");
    assert.strictEqual(usage?.currentValue, 25);
    assert.strictEqual(usage?.status, "warning");
  } finally {
    ctx.cleanup();
  }
});

test("TenantExecutionIsolationService: getIsolationStatus returns tenant status", () => {
  const ctx = createIntegrationContext("aa-tenant-status-");
  try {
    ensureTenantIsolationSchema(ctx);
    const service = new TenantExecutionIsolationService(ctx.db);

    service.defineQuota({
      tenantId: "tenant-003",
      quotaKind: "concurrent_executions",
      limitValue: 10,
      windowSeconds: 60,
      enforcementAction: "throttle",
      enabled: true,
    });

    const status = service.getIsolationStatus("tenant-003");

    assert.ok(status, "Should return isolation status");
    assert.strictEqual(status.tenantId, "tenant-003");
    assert.ok(["active", "quota_exceeded", "noisy_neighbor_detected", "disabled"].includes(status.overallStatus));
  } finally {
    ctx.cleanup();
  }
});

test("TenantExecutionIsolationService: different quota kinds are tracked separately", () => {
  const ctx = createIntegrationContext("aa-tenant-kinds-");
  try {
    ensureTenantIsolationSchema(ctx);
    const service = new TenantExecutionIsolationService(ctx.db);

    service.defineQuota({
      tenantId: "tenant-004",
      quotaKind: "executions_per_minute",
      limitValue: 100,
      windowSeconds: 60,
      enforcementAction: "throttle",
      enabled: true,
    });

    service.defineQuota({
      tenantId: "tenant-004",
      quotaKind: "concurrent_executions",
      limitValue: 5,
      windowSeconds: 60,
      enforcementAction: "reject",
      enabled: true,
    });

    service.defineQuota({
      tenantId: "tenant-004",
      quotaKind: "total_compute_minutes",
      limitValue: 1000,
      windowSeconds: 3600,
      enforcementAction: "log_only",
      enabled: true,
    });

    const epmQuota = service.getQuota("tenant-004", "executions_per_minute");
    const ceQuota = service.getQuota("tenant-004", "concurrent_executions");
    const tcmQuota = service.getQuota("tenant-004", "total_compute_minutes");

    assert.ok(epmQuota, "executions_per_minute quota should exist");
    assert.ok(ceQuota, "concurrent_executions quota should exist");
    assert.ok(tcmQuota, "total_compute_minutes quota should exist");
    assert.strictEqual(epmQuota?.limitValue, 100);
    assert.strictEqual(ceQuota?.limitValue, 5);
    assert.strictEqual(tcmQuota?.limitValue, 1000);
  } finally {
    ctx.cleanup();
  }
});

test("TenantExecutionIsolationService: recordResourceUsage contributes to active execution count", () => {
  const ctx = createIntegrationContext("aa-tenant-resources-");
  try {
    ensureTenantIsolationSchema(ctx);
    const service = new TenantExecutionIsolationService(ctx.db);

    service.recordResourceUsage({
      executionId: "exec-resource-001",
      tenantId: "tenant-005",
      cpuMs: 1500,
      memoryBytes: 512 * 1024 * 1024,
      networkBytes: 10 * 1024 * 1024,
      durationMs: 30000,
      recordedAt: nowIso(),
    });

    const activeExecutions = service.getActiveExecutionCount("tenant-005");
    assert.strictEqual(activeExecutions, 1);
  } finally {
    ctx.cleanup();
  }
});

test("HumanTakeoverService: multiple actions within same session are recorded", () => {
  const ctx = createSeededIntegrationContext("aa-takeover-multi-");
  try {
    const service = new HumanTakeoverService(ctx.db, ctx.store);

    const session = service.openSession({
      taskId: "task-seeded-001",
      operatorId: "operator-multi-001",
      reasonCode: "test_multi_action",
      tenantId: null,
    });

    // Perform multiple actions
    service.modifyInput({
      takeoverSessionId: session.takeoverSessionId,
      inputJson: '{"step": 1}',
      reasonCode: "action_1",
      tenantId: null,
    });

    service.modifyInput({
      takeoverSessionId: session.takeoverSessionId,
      inputJson: '{"step": 2}',
      reasonCode: "action_2",
      tenantId: null,
    });

    // Session should still be open
    const currentSession = ctx.store.approval.getTakeoverSession(session.takeoverSessionId, null);
    assert.ok(currentSession, "Session should still exist");
    assert.strictEqual(currentSession.status, "open");
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: updateHealthCheck preserves anomaly severity in latest snapshot", () => {
  const ctx = createIntegrationContext("aa-autostop-anomaly-");
  try {
    const service = new AutoStopLossService();

    service.updateHealthCheck({
      status: "unhealthy",
      anomalySeverity: "critical",
      activeExecutions: 12,
      queuedTasks: 40,
      memoryUsageMb: 2048,
      eventLoopLagMs: 90,
      providerHealth: "failed",
    });

    const health = service.getLastHealthCheck();
    assert.strictEqual(health?.anomalySeverity, "critical");
    assert.strictEqual(health?.status, "unhealthy");
  } finally {
    ctx.cleanup();
  }
});
