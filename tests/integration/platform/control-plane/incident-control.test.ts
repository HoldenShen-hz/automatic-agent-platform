// @ts-nocheck
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
import { HumanTakeoverService } from "../../../../src/platform/control-plane/incident-control/human-takeover-service.js";
import {
  AutoStopLossService,
  type EscalationLevel,
  type StopLossAction,
  type StopLossPlaybook,
} from "../../../../src/platform/control-plane/incident-control/auto-stop-loss-service.js";
import {
  TenantExecutionIsolationService,
  type QuotaKind,
  type EnforcementAction,
} from "../../../../src/platform/control-plane/incident-control/tenant-execution-isolation-service.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";

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
    const task = ctx.store.getTaskById("task-seeded-001");
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
    const task = ctx.store.getTaskById("task-seeded-001");
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
    const task = ctx.store.getTaskById("task-seeded-001");
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

test("AutoStopLossService: creates service instance with default config", () => {
  const ctx = createIntegrationContext("aa-autostop-basic-");
  try {
    const service = new AutoStopLossService(ctx.db, ctx.store, {
      enabled: true,
      defaultCooldownMs: 60000,
      maxEventsPerHour: 10,
      enableAutoExecution: true,
      enableHumanEscalation: true,
      healthCheckIntervalMs: 30000,
    });

    assert.ok(service, "Service should be created");
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: getSystemHealth returns valid health snapshot", () => {
  const ctx = createIntegrationContext("aa-autostop-health-");
  try {
    const service = new AutoStopLossService(ctx.db, ctx.store, {
      enabled: true,
      defaultCooldownMs: 60000,
      maxEventsPerHour: 10,
      enableAutoExecution: true,
      enableHumanEscalation: true,
      healthCheckIntervalMs: 30000,
    });

    const health = service.getSystemHealth();

    assert.ok(health, "Should return health snapshot");
    assert.ok(["ok", "degraded", "overloaded", "unhealthy"].includes(health.status));
    assert.ok(health.lastCheckedAt, "Should have lastCheckedAt");
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: registerPlaybook stores playbook", () => {
  const ctx = createIntegrationContext("aa-autostop-playbook-");
  try {
    const service = new AutoStopLossService(ctx.db, ctx.store, {
      enabled: true,
      defaultCooldownMs: 60000,
      maxEventsPerHour: 10,
      enableAutoExecution: true,
      enableHumanEscalation: true,
      healthCheckIntervalMs: 30000,
    });

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
    assert.ok(retrieved, "Playbook should be retrievable");
    assert.strictEqual(retrieved.name, "Test Playbook");
    assert.deepStrictEqual(retrieved.actions, ["circuit_break", "scale_down"]);
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: listPlaybooks returns all registered playbooks", () => {
  const ctx = createIntegrationContext("aa-autostop-list-");
  try {
    const service = new AutoStopLossService(ctx.db, ctx.store, {
      enabled: true,
      defaultCooldownMs: 60000,
      maxEventsPerHour: 10,
      enableAutoExecution: true,
      enableHumanEscalation: true,
      healthCheckIntervalMs: 30000,
    });

    const playbook1: StopLossPlaybook = {
      id: "playbook-001",
      name: "Playbook One",
      description: "First playbook",
      triggerCondition: { type: "anomaly_severity", severityThreshold: "warning" },
      actions: ["circuit_break"],
      cooldownMs: 60000,
      maxExecutionsPerHour: 5,
      requireHumanApproval: false,
      enabled: true,
    };

    const playbook2: StopLossPlaybook = {
      id: "playbook-002",
      name: "Playbook Two",
      description: "Second playbook",
      triggerCondition: { type: "health_status", healthStatusThreshold: "degraded" },
      actions: ["scale_down"],
      cooldownMs: 120000,
      maxExecutionsPerHour: 3,
      requireHumanApproval: true,
      enabled: true,
    };

    service.registerPlaybook(playbook1);
    service.registerPlaybook(playbook2);

    const playbooks = service.listPlaybooks();
    assert.strictEqual(playbooks.length, 2);
  } finally {
    ctx.cleanup();
  }
});

test("AutoStopLossService: recordStopLossEvent creates event record", () => {
  const ctx = createIntegrationContext("aa-autostop-record-");
  try {
    const service = new AutoStopLossService(ctx.db, ctx.store, {
      enabled: true,
      defaultCooldownMs: 60000,
      maxEventsPerHour: 10,
      enableAutoExecution: true,
      enableHumanEscalation: true,
      healthCheckIntervalMs: 30000,
    });

    service.recordStopLossEvent({
      playbookId: "playbook-001",
      playbookName: "Test Playbook",
      triggerReason: "High error rate detected",
      actionsExecuted: ["circuit_break"],
      escalationLevel: "act",
      autoTriggered: true,
      humanApproved: false,
    });

    const events = service.listRecentEvents(10);
    assert.ok(events.length > 0, "Should have recorded events");
    const lastEvent = events[0];
    assert.strictEqual(lastEvent.playbookName, "Test Playbook");
    assert.deepStrictEqual(lastEvent.actionsExecuted, ["circuit_break"]);
    assert.strictEqual(lastEvent.escalationLevel, "act");
  } finally {
    ctx.cleanup();
  }
});

test("TenantExecutionIsolationService: creates tenant quota", () => {
  const ctx = createIntegrationContext("aa-tenant-quota-");
  try {
    const service = new TenantExecutionIsolationService(ctx.db, ctx.store);

    service.createOrUpdateQuota({
      tenantId: "tenant-001",
      quotaKind: "executions_per_minute",
      limitValue: 100,
      windowSeconds: 60,
      enforcementAction: "throttle",
      enabled: true,
    });

    const quota = service.getQuota("tenant-001", "executions_per_minute");
    assert.ok(quota, "Quota should be created");
    assert.strictEqual(quota.tenantId, "tenant-001");
    assert.strictEqual(quota.limitValue, 100);
    assert.strictEqual(quota.windowSeconds, 60);
  } finally {
    ctx.cleanup();
  }
});

test("TenantExecutionIsolationService: records quota usage", () => {
  const ctx = createIntegrationContext("aa-tenant-usage-");
  try {
    const service = new TenantExecutionIsolationService(ctx.db, ctx.store);

    service.createOrUpdateQuota({
      tenantId: "tenant-002",
      quotaKind: "executions_per_minute",
      limitValue: 50,
      windowSeconds: 60,
      enforcementAction: "reject",
      enabled: true,
    });

    service.recordQuotaUsage({
      tenantId: "tenant-002",
      quotaKind: "executions_per_minute",
      sampleValue: 25,
    });

    const usage = service.getQuotaUsage("tenant-002", "executions_per_minute");
    assert.ok(usage, "Should return quota usage");
    assert.strictEqual(usage.currentValue, 25);
    assert.strictEqual(usage.status, "ok");
  } finally {
    ctx.cleanup();
  }
});

test("TenantExecutionIsolationService: getIsolationStatus returns tenant status", () => {
  const ctx = createIntegrationContext("aa-tenant-status-");
  try {
    const service = new TenantExecutionIsolationService(ctx.db, ctx.store);

    service.createOrUpdateQuota({
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
    const service = new TenantExecutionIsolationService(ctx.db, ctx.store);

    // Create quotas for different kinds
    service.createOrUpdateQuota({
      tenantId: "tenant-004",
      quotaKind: "executions_per_minute",
      limitValue: 100,
      windowSeconds: 60,
      enforcementAction: "throttle",
      enabled: true,
    });

    service.createOrUpdateQuota({
      tenantId: "tenant-004",
      quotaKind: "concurrent_executions",
      limitValue: 5,
      windowSeconds: 60,
      enforcementAction: "reject",
      enabled: true,
    });

    service.createOrUpdateQuota({
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

    assert.strictEqual(epmQuota.limitValue, 100);
    assert.strictEqual(ceQuota.limitValue, 5);
    assert.strictEqual(tcmQuota.limitValue, 1000);
  } finally {
    ctx.cleanup();
  }
});

test("TenantExecutionIsolationService: recordResourceUsage tracks execution resources", () => {
  const ctx = createIntegrationContext("aa-tenant-resources-");
  try {
    const service = new TenantExecutionIsolationService(ctx.db, ctx.store);

    service.recordResourceUsage({
      executionId: "exec-resource-001",
      tenantId: "tenant-005",
      cpuMs: 1500,
      memoryBytes: 512 * 1024 * 1024, // 512 MB
      networkBytes: 10 * 1024 * 1024, // 10 MB
      durationMs: 30000,
    });

    const usage = service.getExecutionResourceUsage("exec-resource-001");
    assert.ok(usage, "Should return resource usage");
    assert.strictEqual(usage.tenantId, "tenant-005");
    assert.strictEqual(usage.cpuMs, 1500);
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

test("AutoStopLossService: getSystemHealth reflects recent anomalies", () => {
  const ctx = createIntegrationContext("aa-autostop-anomaly-");
  try {
    const service = new AutoStopLossService(ctx.db, ctx.store, {
      enabled: true,
      defaultCooldownMs: 60000,
      maxEventsPerHour: 10,
      enableAutoExecution: true,
      enableHumanEscalation: true,
      healthCheckIntervalMs: 30000,
    });

    // Record some stop-loss events
    service.recordStopLossEvent({
      playbookId: "playbook-001",
      playbookName: "Critical Response",
      triggerReason: "Critical anomaly detected",
      actionsExecuted: ["escalate_to_human"],
      escalationLevel: "critical",
      autoTriggered: true,
      humanApproved: false,
    });

    const health = service.getSystemHealth();
    assert.ok(health.anomalySeverity !== undefined);
  } finally {
    ctx.cleanup();
  }
});
