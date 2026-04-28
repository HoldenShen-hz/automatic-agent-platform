/**
 * Unit tests for EscalationManager
 * Tests escalation creation, delegation, TTL reset, and notification channels
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  EscalationManager,
  EscalationReason,
  DelegationStatus,
  NotificationChannelType,
  NotificationPriority,
  NotificationChannel,
  ApproverRule,
  EscalationRule,
  EscalationContext,
} from "../../../../../src/platform/control-plane/approval-center/escalation-manager.js";

test("EscalationManager canEscalate returns true within depth", () => {
  const manager = new EscalationManager();

  assert.equal(manager.canEscalate(0, 3), true);
  assert.equal(manager.canEscalate(1, 3), true);
  assert.equal(manager.canEscalate(2, 3), true);
});

test("EscalationManager canEscalate returns false at max depth", () => {
  const manager = new EscalationManager();

  assert.equal(manager.canEscalate(3, 3), false);
  assert.equal(manager.canEscalate(4, 3), false);
  assert.equal(manager.canEscalate(5, 3), false);
});

test("EscalationManager createEscalation creates new level", () => {
  const manager = new EscalationManager();
  const context: EscalationContext = {
    approvalId: "approval-escalate-1",
    taskId: "task-1",
    executionId: "exec-1",
    currentLevel: 0,
    reason: EscalationReason.TIMEOUT,
  };
  const rule: EscalationRule = {
    escalateTo: { type: "role", identifier: "admin", can_delegate: true },
    maxEscalationDepth: 3,
    notificationChannels: [],
    escalationTimeoutMs: 30 * 60 * 1000,
  };

  const escalation = manager.createEscalation(context, rule);

  assert.equal(escalation.level, 1);
  assert.equal(escalation.escalateTo.identifier, "admin");
  assert.equal(escalation.reason, EscalationReason.TIMEOUT);
});

test("EscalationManager createEscalation increments level", () => {
  const manager = new EscalationManager();
  const rule: EscalationRule = {
    escalateTo: { type: "role", identifier: "admin", can_delegate: true },
    maxEscalationDepth: 5,
    notificationChannels: [],
    escalationTimeoutMs: 30 * 60 * 1000,
  };

  manager.createEscalation(
    { approvalId: "approval-lvl", taskId: "task-1", currentLevel: 0, reason: EscalationReason.TIMEOUT },
    rule,
  );
  const second = manager.createEscalation(
    { approvalId: "approval-lvl", taskId: "task-1", currentLevel: 1, reason: EscalationReason.TIMEOUT },
    rule,
  );

  assert.equal(second.level, 2);
});

test("EscalationManager createEscalation throws at max depth", () => {
  const manager = new EscalationManager();
  const context: EscalationContext = {
    approvalId: "approval-max-depth",
    taskId: "task-1",
    currentLevel: 3,
    reason: EscalationReason.TIMEOUT,
  };
  const rule: EscalationRule = {
    escalateTo: { type: "role", identifier: "admin", can_delegate: true },
    maxEscalationDepth: 3, // max depth is 3, current level is 3
    notificationChannels: [],
    escalationTimeoutMs: 30 * 60 * 1000,
  };

  assert.throws(
    () => manager.createEscalation(context, rule),
    /Cannot escalate beyond max depth of 3/i,
  );
});

test("EscalationManager createDelegation creates valid delegation", () => {
  const manager = new EscalationManager();

  const delegation = manager.createDelegation("user1", "user2", "approval_del_1", 3600000);

  assert.equal(delegation.fromApprover, "user1");
  assert.equal(delegation.toApprover, "user2");
  assert.equal(delegation.originalApprovalId, "approval_del_1");
  assert.equal(delegation.status, DelegationStatus.ACTIVE);
  assert.equal(delegation.ttlResetCount, 0);
  assert.equal(delegation.maxTtlResets, 3);
});

test("EscalationManager createDelegation throws on self-delegation", () => {
  const manager = new EscalationManager();

  assert.throws(
    () => manager.createDelegation("user1", "user1", "approval_self"),
    /Cannot delegate to yourself/,
  );
});

test("EscalationManager isDelegationExpired returns false for active delegation", () => {
  const manager = new EscalationManager();

  const delegation = manager.createDelegation("user1", "user2", "approval_active", 60000);

  assert.equal(manager.isDelegationExpired(delegation), false);
});

test("EscalationManager isDelegationExpired returns true for expired TTL", () => {
  const manager = new EscalationManager();

  const delegation = manager.createDelegation("user1", "user2", "approval_exp", 1); // 1ms TTL

  // Wait for expiration
  const start = Date.now();
  while (Date.now() - start < 10);

  assert.equal(manager.isDelegationExpired(delegation), true);
});

test("EscalationManager isDelegationExpired does not treat revoked status as ttl-expired", () => {
  const manager = new EscalationManager();

  const delegation = manager.createDelegation("user1", "user2", "approval_rev", 60000);
  manager.revokeDelegation(delegation.delegationId);

  const revoked = manager.getDelegation(delegation.delegationId);
  assert.ok(revoked);
  assert.equal(manager.isDelegationExpired(revoked), false);
});

test("EscalationManager resetDelegationTtl increments reset count", () => {
  const manager = new EscalationManager();

  const delegation = manager.createDelegation("user1", "user2", "approval_reset", 60000, 3);
  const updated = manager.resetDelegationTtl(delegation, 60000);

  assert.equal(updated.ttlResetCount, 1);
  assert.equal(updated.status, DelegationStatus.ACTIVE);
});

test("EscalationManager resetDelegationTtl throws on max resets", () => {
  const manager = new EscalationManager();

  const delegation = manager.createDelegation("user1", "user2", "approval_max_reset", 60000, 1);
  manager.resetDelegationTtl(delegation, 60000);

  assert.throws(
    () => manager.resetDelegationTtl({ ...delegation, ttlResetCount: 1 }, 60000),
    /Cannot reset TTL more than/,
  );
});

test("EscalationManager resetDelegationTtl throws on inactive delegation", () => {
  const manager = new EscalationManager();

  const delegation = manager.createDelegation("user1", "user2", "approval_inactive", 60000);
  manager.completeDelegation(delegation.delegationId);
  const completed = manager.getDelegation(delegation.delegationId);
  assert.ok(completed);

  assert.throws(
    () => manager.resetDelegationTtl(completed, 60000),
    /inactive delegation/,
  );
});

test("EscalationManager revokeDelegation sets status to revoked", () => {
  const manager = new EscalationManager();

  const delegation = manager.createDelegation("user1", "user2", "approval_revoke", 60000);
  manager.revokeDelegation(delegation.delegationId);

  const retrieved = manager.getDelegation(delegation.delegationId);
  assert.equal(retrieved?.status, DelegationStatus.REVOKED);
});

test("EscalationManager completeDelegation sets status to completed", () => {
  const manager = new EscalationManager();

  const delegation = manager.createDelegation("user1", "user2", "approval_complete", 60000);
  manager.completeDelegation(delegation.delegationId);

  const retrieved = manager.getDelegation(delegation.delegationId);
  assert.equal(retrieved?.status, DelegationStatus.COMPLETED);
});

test("EscalationManager getDelegation returns delegation by ID", () => {
  const manager = new EscalationManager();

  const delegation = manager.createDelegation("user1", "user2", "approval_get", 60000);
  const retrieved = manager.getDelegation(delegation.delegationId);

  assert.ok(retrieved);
  assert.equal(retrieved?.delegationId, delegation.delegationId);
});

test("EscalationManager getDelegation returns undefined for nonexistent", () => {
  const manager = new EscalationManager();

  const retrieved = manager.getDelegation("nonexistent");

  assert.equal(retrieved, undefined);
});

test("EscalationManager getActiveDelegationForApproval returns active delegation", () => {
  const manager = new EscalationManager();

  const delegation = manager.createDelegation("user1", "user2", "approval_active_lookup", 60000);
  const retrieved = manager.getActiveDelegationForApproval("approval_active_lookup");

  assert.ok(retrieved);
  assert.equal(retrieved?.delegationId, delegation.delegationId);
});

test("EscalationManager getActiveDelegationForApproval returns undefined for expired", () => {
  const manager = new EscalationManager();

  const delegation = manager.createDelegation("user1", "user2", "approval_expired_lookup", 1);
  // Wait for expiration
  const start = Date.now();
  while (Date.now() - start < 10);

  const retrieved = manager.getActiveDelegationForApproval("approval_expired_lookup");

  assert.equal(retrieved, undefined);
});

test("EscalationManager getEscalationHistory returns history entries", () => {
  const manager = new EscalationManager();
  const rule: EscalationRule = {
    escalateTo: { type: "role", identifier: "admin", can_delegate: true },
    maxEscalationDepth: 5,
    notificationChannels: [],
    escalationTimeoutMs: 30 * 60 * 1000,
  };

  manager.createEscalation(
    { approvalId: "approval_history", taskId: "task-1", currentLevel: 0, reason: EscalationReason.TIMEOUT },
    rule,
  );
  manager.createEscalation(
    { approvalId: "approval_history", taskId: "task-1", currentLevel: 1, reason: EscalationReason.TIMEOUT },
    rule,
  );

  const history = manager.getEscalationHistory("approval_history");

  assert.equal(history.length, 2);
  assert.equal(history[0]?.level, 1);
  assert.equal(history[1]?.level, 2);
});

test("EscalationManager getEscalationHistory returns empty for nonexistent", () => {
  const manager = new EscalationManager();

  const history = manager.getEscalationHistory("nonexistent");

  assert.deepEqual(history, []);
});

test("EscalationManager getCurrentEscalationLevel returns max level", () => {
  const manager = new EscalationManager();
  const rule: EscalationRule = {
    escalateTo: { type: "role", identifier: "admin", can_delegate: true },
    maxEscalationDepth: 5,
    notificationChannels: [],
    escalationTimeoutMs: 30 * 60 * 1000,
  };

  manager.createEscalation(
    { approvalId: "approval_level", taskId: "task-1", currentLevel: 0, reason: EscalationReason.TIMEOUT },
    rule,
  );
  manager.createEscalation(
    { approvalId: "approval_level", taskId: "task-1", currentLevel: 1, reason: EscalationReason.TIMEOUT },
    rule,
  );

  assert.equal(manager.getCurrentEscalationLevel("approval_level"), 2);
});

test("EscalationManager getCurrentEscalationLevel returns 0 for nonexistent", () => {
  const manager = new EscalationManager();

  assert.equal(manager.getCurrentEscalationLevel("nonexistent"), 0);
});

test("EscalationManager createTimeoutContext creates valid context", () => {
  const manager = new EscalationManager();

  const context = manager.createTimeoutContext("approval_timeout", "task_timeout", "exec_timeout", 1);

  assert.equal(context.approvalId, "approval_timeout");
  assert.equal(context.taskId, "task_timeout");
  assert.equal(context.executionId, "exec_timeout");
  assert.equal(context.currentLevel, 1);
  assert.equal(context.reason, EscalationReason.TIMEOUT);
});

test("EscalationManager createQuorumNotMetContext creates valid context", () => {
  const manager = new EscalationManager();

  const context = manager.createQuorumNotMetContext("approval_quorum", "task_quorum", null, 2);

  assert.equal(context.approvalId, "approval_quorum");
  assert.equal(context.reason, EscalationReason.QUORUM_NOT_MET);
  assert.equal(context.currentLevel, 2);
  assert.equal(context.executionId, null);
});

test("EscalationManager escalate creates escalation and returns result", async () => {
  const manager = new EscalationManager();
  const context: EscalationContext = {
    approvalId: "approval_esc",
    taskId: "task_esc",
    executionId: "exec_esc",
    currentLevel: 0,
    reason: EscalationReason.TIMEOUT,
  };
  const rule: EscalationRule = {
    escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
    maxEscalationDepth: 3,
    notificationChannels: [
      { type: NotificationChannelType.EMAIL, address: "test@example.com", enabled: true },
    ],
    escalationTimeoutMs: 30 * 60 * 1000,
  };

  const result = await manager.escalate(context, rule);

  assert.equal(result.success, true);
  assert.ok(result.newLevel);
  assert.equal(result.newLevel?.level, 1);
});

test("EscalationManager escalate returns error when max depth exceeded", async () => {
  const manager = new EscalationManager();
  const context: EscalationContext = {
    approvalId: "approval_esc_err",
    taskId: "task_esc_err",
    currentLevel: 3,
    reason: EscalationReason.TIMEOUT,
  };
  const rule: EscalationRule = {
    escalateTo: { type: "role", identifier: "superadmin", can_delegate: false },
    maxEscalationDepth: 3,
    notificationChannels: [],
    escalationTimeoutMs: 30 * 60 * 1000,
  };

  const result = await manager.escalate(context, rule);

  assert.equal(result.success, false);
  assert.ok(result.error);
});

test("EscalationManager notifyChannels does not throw for empty channels", async () => {
  const manager = new EscalationManager();

  // Should not throw
  await manager.notifyChannels([], {
    title: "Test",
    body: "Test body",
    priority: NotificationPriority.NORMAL,
  });
});

test("EscalationManager notification channels have correct types", () => {
  assert.equal(NotificationChannelType.EMAIL, "email");
  assert.equal(NotificationChannelType.SLACK, "slack");
  assert.equal(NotificationChannelType.FEISHU, "feishu");
  assert.equal(NotificationChannelType.WEBHOOK, "webhook");
});

test("EscalationManager notification priorities are correct", () => {
  assert.equal(NotificationPriority.HIGH, "high");
  assert.equal(NotificationPriority.NORMAL, "normal");
  assert.equal(NotificationPriority.LOW, "low");
});

test("EscalationManager handles manual escalation reason", () => {
  const manager = new EscalationManager();
  const rule: EscalationRule = {
    escalateTo: { type: "role", identifier: "admin", can_delegate: true },
    maxEscalationDepth: 5,
    notificationChannels: [],
    escalationTimeoutMs: 30 * 60 * 1000,
  };

  const escalation = manager.createEscalation(
    { approvalId: "approval_manual", taskId: "task-1", currentLevel: 0, reason: EscalationReason.MANUAL },
    rule,
  );

  assert.equal(escalation.reason, EscalationReason.MANUAL);
});

test("EscalationManager handles critical_risk escalation reason", () => {
  const manager = new EscalationManager();
  const rule: EscalationRule = {
    escalateTo: { type: "role", identifier: "admin", can_delegate: true },
    maxEscalationDepth: 5,
    notificationChannels: [],
    escalationTimeoutMs: 30 * 60 * 1000,
  };

  const escalation = manager.createEscalation(
    { approvalId: "approval_critical", taskId: "task-1", currentLevel: 0, reason: EscalationReason.CRITICAL_RISK },
    rule,
  );

  assert.equal(escalation.reason, EscalationReason.CRITICAL_RISK);
});
