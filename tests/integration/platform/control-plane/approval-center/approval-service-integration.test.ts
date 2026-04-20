/**
 * Integration Test: Approval Service Lifecycle
 *
 * Verifies the full approval lifecycle: createRequest → applyDecision → status changes.
 * Uses real SQLite database for integration-level verification.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { ApprovalService } from "../../../../../src/platform/control-plane/approval-center/approval-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("approval service: createRequest creates approval and emits event", () => {
  const workspace = createTempWorkspace("approval-integration-");

  try {
    const dbPath = join(workspace, "approval-test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-1", executionId: "exec-1" });

    const approval = approvalService.createRequest({
      taskId: "task-1",
      executionId: "exec-1",
      sourceAgentId: "test-agent",
      reason: "Test approval request",
      riskLevel: "low",
      options: ["approve", "reject"],
      context: { source: "integration-test" },
      timeoutPolicy: "remain_pending",
    });

    assert.ok(approval.approvalId.startsWith("approval_"));
    assert.strictEqual(approval.taskId, "task-1");
    assert.strictEqual(approval.executionId, "exec-1");
    assert.strictEqual(approval.sourceAgentId, "test-agent");
    assert.strictEqual(approval.reason, "Test approval request");
    assert.strictEqual(approval.riskLevel, "low");
    assert.deepStrictEqual(approval.options, ["approve", "reject"]);

    const events = store.listEventsForTask("task-1");
    assert.ok(events.length >= 1, "Should have at least one event");
    const decisionEvent = events.find((e) => e.eventType === "decision:requested");
    assert.ok(decisionEvent, "Should have decision:requested event");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("approval service: applyDecision confirms pending request", () => {
  const workspace = createTempWorkspace("approval-confirm-");

  try {
    const dbPath = join(workspace, "approval-confirm.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-2", executionId: "exec-2" });

    const approval = approvalService.createRequest({
      taskId: "task-2",
      executionId: "exec-2",
      sourceAgentId: "test-agent",
      reason: "Test confirm",
      riskLevel: "low",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "remain_pending",
    });

    approvalService.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "test-operator",
      respondedAt: nowIso(),
    });

    const events = store.listEventsForTask("task-2");
    const respondedEvent = events.find((e) => e.eventType === "decision:responded");
    assert.ok(respondedEvent, "Should have decision:responded event");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("approval service: applyDecision rejects pending request", () => {
  const workspace = createTempWorkspace("approval-reject-");

  try {
    const dbPath = join(workspace, "approval-reject.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-3", executionId: "exec-3" });

    const approval = approvalService.createRequest({
      taskId: "task-3",
      executionId: "exec-3",
      sourceAgentId: "test-agent",
      reason: "Test reject",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: {},
      timeoutPolicy: "remain_pending",
    });

    approvalService.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "rejected",
      respondedBy: "test-operator",
      respondedAt: nowIso(),
    });

    const events = store.listEventsForTask("task-3");
    const respondedEvent = events.find((e) => e.eventType === "decision:responded");
    assert.ok(respondedEvent, "Should have decision:responded event");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("approval service: applyDecision throws for non-existent approval", () => {
  const workspace = createTempWorkspace("approval-notfound-");

  try {
    const dbPath = join(workspace, "approval-notfound.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-4", executionId: "exec-4" });

    let error: Error | null = null;
    try {
      approvalService.applyDecision({
        approvalId: "non-existent-approval",
        decisionType: "confirmed",
        confirmed: true,
        respondedBy: "test-operator",
        respondedAt: nowIso(),
      });
    } catch (e) {
      error = e as Error;
    }
    assert.ok(error, "Should throw an error for non-existent approval");
    assert.ok(error.message.includes("Approval not found"), `Error message: ${error.message}`);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("approval service: applyDecision is idempotent for non-pending approval", () => {
  const workspace = createTempWorkspace("approval-idempotent-");

  try {
    const dbPath = join(workspace, "approval-idempotent.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-5", executionId: "exec-5" });

    const approval = approvalService.createRequest({
      taskId: "task-5",
      executionId: "exec-5",
      sourceAgentId: "test-agent",
      reason: "Test idempotent",
      riskLevel: "low",
      options: ["approve"],
      context: {},
      timeoutPolicy: "remain_pending",
    });

    // First decision - confirm
    approvalService.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "operator-1",
      respondedAt: nowIso(),
    });

    // Second decision on already-answered - should be no-op (idempotent)
    approvalService.applyDecision({
      approvalId: approval.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "operator-2",
      respondedAt: nowIso(),
    });

    const events = store.listEventsForTask("task-5");
    const respondedEvents = events.filter((e) => e.eventType === "decision:responded");
    assert.strictEqual(respondedEvents.length, 1, "Should only have one decision:responded event (idempotent)");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("approval service: createRequest with executionId associates with execution", () => {
  const workspace = createTempWorkspace("approval-exec-");

  try {
    const dbPath = join(workspace, "approval-exec.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-6", executionId: "exec-6" });

    const approval = approvalService.createRequest({
      taskId: "task-6",
      executionId: "exec-6",
      sourceAgentId: "test-agent",
      reason: "Test with execution",
      riskLevel: "medium",
      options: ["approve", "reject", "escalate"],
      context: { workflowStep: 2 },
      timeoutPolicy: "approve",
    });

    assert.strictEqual(approval.executionId, "exec-6");
    assert.strictEqual(approval.riskLevel, "medium");
    assert.deepStrictEqual(approval.options, ["approve", "reject", "escalate"]);
    assert.strictEqual(approval.context.workflowStep, 2);

    const events = store.listEventsForTask("task-6");
    const decisionEvent = events.find((e) => e.eventType === "decision:requested");
    assert.ok(decisionEvent, "Should have decision:requested event");
    const eventPayload = JSON.parse(decisionEvent!.payloadJson);
    assert.strictEqual(eventPayload.executionId, "exec-6");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("approval service: high risk approvals have appropriate options", () => {
  const workspace = createTempWorkspace("approval-risk-");

  try {
    const dbPath = join(workspace, "approval-risk.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-7", executionId: "exec-7" });

    const approval = approvalService.createRequest({
      taskId: "task-7",
      executionId: "exec-7",
      sourceAgentId: "test-agent",
      reason: "High risk operation - database migration",
      riskLevel: "critical",
      options: ["proceed", "cancel", "modify"],
      context: { operation: "schema_migration", estimatedImpact: "high" },
      timeoutPolicy: "reject",
    });

    assert.strictEqual(approval.riskLevel, "critical");
    assert.strictEqual(approval.timeoutPolicy, "reject");
    assert.ok(approval.options.length >= 2, "High risk should have multiple options");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
