/**
 * Integration Test: Escalation Manager
 *
 * Verifies escalation and delegation logic for approval workflows.
 * Tests escalation creation, delegation lifecycle, and notification channels.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  EscalationManager,
  EscalationReason,
  DelegationStatus,
  NotificationChannelType,
  NotificationPriority,
  type EscalationContext,
  type EscalationRule,
  type NotificationChannel,
} from "../../../../../src/platform/five-plane-control-plane/approval-center/escalation-manager.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

function createTestEscalationRule(): EscalationRule {
  return {
    escalateTo: { type: "role", identifier: "admin", can_delegate: true },
    maxEscalationDepth: 3,
    notificationChannels: [],
    escalationTimeoutMs: 30 * 60 * 1000,
  };
}

function createTestContext(approvalId: string, taskId: string, level: number): EscalationContext {
  return {
    approvalId,
    taskId,
    executionId: null,
    currentLevel: level,
    reason: EscalationReason.TIMEOUT,
  };
}

test("escalation manager: canEscalate returns true within max depth", () => {
  const manager = new EscalationManager();
  const result = manager.canEscalate(0, 3);

  assert.strictEqual(result, true);
});

test("escalation manager: canEscalate returns false at max depth", () => {
  const manager = new EscalationManager();
  const result = manager.canEscalate(3, 3);

  assert.strictEqual(result, false);
});

test("escalation manager: canEscalate returns false beyond max depth", () => {
  const manager = new EscalationManager();
  const result = manager.canEscalate(5, 3);

  assert.strictEqual(result, false);
});

test("escalation manager: createEscalation creates new escalation level", () => {
  const manager = new EscalationManager();
  const context = createTestContext("approval-1", "task-1", 0);
  const rule = createTestEscalationRule();

  const escalation = manager.createEscalation(context, rule);

  assert.strictEqual(escalation.level, 1);
  assert.strictEqual(escalation.sourceApprovalId, "approval-1");
  assert.strictEqual(escalation.escalateTo.identifier, "admin");
  assert.strictEqual(escalation.reason, EscalationReason.TIMEOUT);
});

test("escalation manager: createEscalation throws when max depth exceeded", () => {
  const manager = new EscalationManager();
  const context = createTestContext("approval-1", "task-1", 3);
  const rule = createTestEscalationRule();

  assert.throws(
    () => manager.createEscalation(context, rule),
    /max depth/,
  );
});

test("escalation manager: getEscalationHistory returns history for approval", () => {
  const manager = new EscalationManager();
  const context1 = createTestContext("approval-2", "task-2", 0);
  const context2 = createTestContext("approval-2", "task-2", 1);
  const rule = createTestEscalationRule();

  manager.createEscalation(context1, rule);
  manager.createEscalation(context2, rule);

  const history = manager.getEscalationHistory("approval-2");

  assert.strictEqual(history.length, 2);
  assert.strictEqual(history[0]!.level, 1);
  assert.strictEqual(history[1]!.level, 2);
});

test("escalation manager: getEscalationHistory returns empty for unknown approval", () => {
  const manager = new EscalationManager();

  const history = manager.getEscalationHistory("unknown-approval");

  assert.deepStrictEqual(history, []);
});

test("escalation manager: getCurrentEscalationLevel returns max level", () => {
  const manager = new EscalationManager();
  const context1 = createTestContext("approval-3", "task-3", 0);
  const context2 = createTestContext("approval-3", "task-3", 1);
  const rule = createTestEscalationRule();

  manager.createEscalation(context1, rule);
  manager.createEscalation(context2, rule);

  const level = manager.getCurrentEscalationLevel("approval-3");

  assert.strictEqual(level, 2);
});

test("escalation manager: getCurrentEscalationLevel returns 0 for unknown approval", () => {
  const manager = new EscalationManager();

  const level = manager.getCurrentEscalationLevel("unknown-approval");

  assert.strictEqual(level, 0);
});

test("escalation manager: createDelegation creates delegation", () => {
  const manager = new EscalationManager();

  const delegation = manager.createDelegation("approver-a", "approver-b", "approval-1");

  assert.ok(delegation.delegationId.startsWith("delegation_"));
  assert.strictEqual(delegation.fromApprover, "approver-a");
  assert.strictEqual(delegation.toApprover, "approver-b");
  assert.strictEqual(delegation.originalApprovalId, "approval-1");
  assert.strictEqual(delegation.status, DelegationStatus.ACTIVE);
  assert.strictEqual(delegation.ttlResetCount, 0);
});

test("escalation manager: createDelegation throws for self-delegation", () => {
  const manager = new EscalationManager();

  assert.throws(
    () => manager.createDelegation("approver-a", "approver-a", "approval-1"),
    /yourself/,
  );
});

test("escalation manager: isDelegationExpired returns false for active non-expired", () => {
  const manager = new EscalationManager();
  const delegation = manager.createDelegation("approver-a", "approver-b", "approval-1");

  const isExpired = manager.isDelegationExpired(delegation);

  assert.strictEqual(isExpired, false);
});

test("escalation manager: isDelegationExpired returns true for expired", () => {
  const manager = new EscalationManager();
  const delegation = manager.createDelegation("approver-a", "approver-b", "approval-1", 1); // 1ms TTL

  // Wait for expiration
  const start = Date.now();
  while (Date.now() - start < 10) {
    // busy wait
  }

  const isExpired = manager.isDelegationExpired(delegation);

  assert.strictEqual(isExpired, true);
});

test("escalation manager: isDelegationExpired returns true for expired TTL", () => {
  const manager = new EscalationManager();
  const delegation = manager.createDelegation("approver-a", "approver-b", "approval-1", 1); // 1ms TTL

  // Wait for expiration
  const start = Date.now();
  while (Date.now() - start < 10) {
    // busy wait
  }

  const isExpired = manager.isDelegationExpired(delegation);

  assert.strictEqual(isExpired, true);
});

test("escalation manager: isDelegationExpired returns false for revoked status", () => {
  const manager = new EscalationManager();
  const delegation = manager.createDelegation("approver-a", "approver-b", "approval-1");
  manager.revokeDelegation(delegation.delegationId);

  // isDelegationExpired checks the status of the passed delegation object,
  // so we need to get the updated delegation from the manager
  const updatedDelegation = manager.getDelegation(delegation.delegationId)!;
  const isExpired = manager.isDelegationExpired(updatedDelegation);

  // Revoked is not considered "expired" - expiration is time-based
  assert.strictEqual(isExpired, false);
});

test("escalation manager: resetDelegationTtl resets TTL", () => {
  const manager = new EscalationManager();
  const delegation = manager.createDelegation("approver-a", "approver-b", "approval-1", 60000);

  const originalExpires = delegation.expiresAt;
  const reset = manager.resetDelegationTtl(delegation, 120000);

  assert.strictEqual(reset.ttlResetCount, 1);
  assert.ok(new Date(reset.expiresAt) > new Date(originalExpires));
});

test("escalation manager: resetDelegationTtl throws when max resets exceeded", () => {
  const manager = new EscalationManager();
  const delegation = manager.createDelegation("approver-a", "approver-b", "approval-1", 60000, 2);

  let updated = manager.resetDelegationTtl(delegation, 60000);
  updated = manager.resetDelegationTtl(updated, 60000);

  assert.throws(
    () => manager.resetDelegationTtl(updated, 60000),
    /more than/,
  );
});

test("escalation manager: resetDelegationTtl throws for inactive delegation", () => {
  const manager = new EscalationManager();
  const delegation = manager.createDelegation("approver-a", "approver-b", "approval-1");
  manager.completeDelegation(delegation.delegationId);

  // After completion, get the updated delegation from the manager
  const completed = manager.getDelegation(delegation.delegationId)!;

  assert.throws(
    () => manager.resetDelegationTtl(completed, 60000),
    /inactive/,
  );
});

test("escalation manager: revokeDelegation sets status to revoked", () => {
  const manager = new EscalationManager();
  const delegation = manager.createDelegation("approver-a", "approver-b", "approval-1");

  manager.revokeDelegation(delegation.delegationId);

  const found = manager.getDelegation(delegation.delegationId);
  assert.strictEqual(found!.status, DelegationStatus.REVOKED);
});

test("escalation manager: completeDelegation sets status to completed", () => {
  const manager = new EscalationManager();
  const delegation = manager.createDelegation("approver-a", "approver-b", "approval-1");

  manager.completeDelegation(delegation.delegationId);

  const found = manager.getDelegation(delegation.delegationId);
  assert.strictEqual(found!.status, DelegationStatus.COMPLETED);
});

test("escalation manager: getDelegation returns delegation by id", () => {
  const manager = new EscalationManager();
  const delegation = manager.createDelegation("approver-a", "approver-b", "approval-1");

  const found = manager.getDelegation(delegation.delegationId);

  assert.ok(found);
  assert.strictEqual(found!.delegationId, delegation.delegationId);
});

test("escalation manager: getDelegation returns undefined for unknown id", () => {
  const manager = new EscalationManager();

  const found = manager.getDelegation("unknown-id");

  assert.strictEqual(found, undefined);
});

test("escalation manager: getActiveDelegationForApproval returns active delegation", () => {
  const manager = new EscalationManager();
  const delegation = manager.createDelegation("approver-a", "approver-b", "approval-active");

  const found = manager.getActiveDelegationForApproval("approval-active");

  assert.ok(found);
  assert.strictEqual(found!.delegationId, delegation.delegationId);
});

test("escalation manager: getActiveDelegationForApproval returns undefined for expired", () => {
  const manager = new EscalationManager();
  manager.createDelegation("approver-a", "approver-b", "approval-expired", 1);

  // Wait for expiration
  const start = Date.now();
  while (Date.now() - start < 10) {
    // busy wait
  }

  const found = manager.getActiveDelegationForApproval("approval-expired");

  assert.strictEqual(found, undefined);
});

test("escalation manager: createTimeoutContext creates correct context", () => {
  const manager = new EscalationManager();

  const context = manager.createTimeoutContext("approval-1", "task-1", "exec-1", 1);

  assert.strictEqual(context.approvalId, "approval-1");
  assert.strictEqual(context.taskId, "task-1");
  assert.strictEqual(context.executionId, "exec-1");
  assert.strictEqual(context.currentLevel, 1);
  assert.strictEqual(context.reason, EscalationReason.TIMEOUT);
});

test("escalation manager: createQuorumNotMetContext creates correct context", () => {
  const manager = new EscalationManager();

  const context = manager.createQuorumNotMetContext("approval-2", "task-2", null, 0);

  assert.strictEqual(context.approvalId, "approval-2");
  assert.strictEqual(context.taskId, "task-2");
  assert.strictEqual(context.executionId, null);
  assert.strictEqual(context.reason, EscalationReason.QUORUM_NOT_MET);
});

test("escalation manager: escalate creates escalation and returns success", async () => {
  const manager = new EscalationManager();
  const context = createTestContext("approval-escalate-1", "task-escalate-1", 0);
  const rule = createTestEscalationRule();

  const result = await manager.escalate(context, rule);

  assert.strictEqual(result.success, true);
  assert.ok(result.newLevel);
  assert.strictEqual(result.newLevel!.level, 1);
});

test("escalation manager: escalate fails when max depth exceeded", async () => {
  const manager = new EscalationManager();
  const context = createTestContext("approval-fail-1", "task-fail-1", 3);
  const rule = createTestEscalationRule();

  const result = await manager.escalate(context, rule);

  assert.strictEqual(result.success, false);
  assert.ok(result.error);
});
