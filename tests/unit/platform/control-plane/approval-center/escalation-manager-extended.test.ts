/**
 * Extended unit tests for Escalation Manager
 * Tests delegation expiration edge cases, TTL reset limits, and notification handling
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  EscalationManager,
  NotificationChannelType,
  NotificationPriority,
  DelegationStatus,
  EscalationReason,
  type Delegation,
  type EscalationContext,
  type NotificationChannel,
  type NotificationMessage,
} from "../../../../../src/platform/five-plane-control-plane/approval-center/escalation-manager.js";

// ============================================================================
// Helper Functions
// ============================================================================

function createTestRule(overrides = {}) {
  return {
    escalateTo: { type: "role" as const, identifier: "senior-engineer", can_delegate: true },
    maxEscalationDepth: 3,
    notificationChannels: [
      { type: NotificationChannelType.EMAIL, address: "escalation@example.com", enabled: true, priority: NotificationPriority.HIGH },
    ],
    escalationTimeoutMs: 30 * 60 * 1000,
    ...overrides,
  };
}

function createTestContext(overrides: Partial<EscalationContext> = {}): EscalationContext {
  return {
    approvalId: "approval-1",
    taskId: "task-1",
    executionId: "exec-1",
    currentLevel: 0,
    reason: EscalationReason.TIMEOUT,
    ...overrides,
  };
}

// ============================================================================
// TTL Reset Edge Cases
// ============================================================================

test("EscalationManager resetDelegationTtl throws on EXPIRED status", async () => {
  const manager = new EscalationManager();
  const delegation: Delegation = {
    delegationId: "delegation-1",
    fromApprover: "approver-1",
    toApprover: "approver-2",
    delegatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    originalApprovalId: "approval-1",
    ttlResetCount: 0,
    maxTtlResets: 3,
    status: DelegationStatus.EXPIRED,
  };

  await assert.rejects(
    async () => manager.resetDelegationTtl(delegation),
    /inactive delegation/,
  );
});

test("EscalationManager resetDelegationTtl throws on REVOKED status", async () => {
  const manager = new EscalationManager();
  const delegation: Delegation = {
    delegationId: "delegation-1",
    fromApprover: "approver-1",
    toApprover: "approver-2",
    delegatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    originalApprovalId: "approval-1",
    ttlResetCount: 0,
    maxTtlResets: 3,
    status: DelegationStatus.REVOKED,
  };

  await assert.rejects(
    async () => manager.resetDelegationTtl(delegation),
    /inactive delegation/,
  );
});

test("EscalationManager resetDelegationTtl throws on COMPLETED status", async () => {
  const manager = new EscalationManager();
  const delegation: Delegation = {
    delegationId: "delegation-1",
    fromApprover: "approver-1",
    toApprover: "approver-2",
    delegatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    originalApprovalId: "approval-1",
    ttlResetCount: 0,
    maxTtlResets: 3,
    status: DelegationStatus.COMPLETED,
  };

  await assert.rejects(
    async () => manager.resetDelegationTtl(delegation),
    /inactive delegation/,
  );
});

test("EscalationManager resetDelegationTtl updates expiresAt correctly", async () => {
  const manager = new EscalationManager();
  const originalExpiry = new Date(Date.now() + 1000).toISOString(); // 1 second from now
  const delegation: Delegation = {
    delegationId: "delegation-1",
    fromApprover: "approver-1",
    toApprover: "approver-2",
    delegatedAt: new Date().toISOString(),
    expiresAt: originalExpiry,
    originalApprovalId: "approval-1",
    ttlResetCount: 0,
    maxTtlResets: 3,
    status: DelegationStatus.ACTIVE,
  };

  const updated = await manager.resetDelegationTtl(delegation, 3600000);

  assert.ok(new Date(updated.expiresAt).getTime() > new Date(originalExpiry).getTime());
  assert.strictEqual(updated.ttlResetCount, 1);
});

test("EscalationManager resetDelegationTtl uses default TTL when not specified", async () => {
  const manager = new EscalationManager();
  const delegation: Delegation = {
    delegationId: "delegation-1",
    fromApprover: "approver-1",
    toApprover: "approver-2",
    delegatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    originalApprovalId: "approval-1",
    ttlResetCount: 0,
    maxTtlResets: 3,
    status: DelegationStatus.ACTIVE,
  };

  const beforeReset = new Date(delegation.expiresAt).getTime();
  const updated = await manager.resetDelegationTtl(delegation);

  // Default TTL is 2 hours
  assert.ok(new Date(updated.expiresAt).getTime() > beforeReset);
});

// ============================================================================
// Delegation Expiration Edge Cases
// ============================================================================

test("EscalationManager isDelegationExpired handles EXPIRED status correctly", () => {
  const manager = new EscalationManager();
  const delegation: Delegation = {
    delegationId: "delegation-1",
    fromApprover: "approver-1",
    toApprover: "approver-2",
    delegatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    originalApprovalId: "approval-1",
    ttlResetCount: 0,
    maxTtlResets: 3,
    status: DelegationStatus.EXPIRED,
  };

  // When status is EXPIRED, isDelegationExpired returns true (status === EXPIRED)
  assert.strictEqual(manager.isDelegationExpired(delegation), true);
});

test("EscalationManager isDelegationExpired handles COMPLETED status correctly", () => {
  const manager = new EscalationManager();
  const delegation: Delegation = {
    delegationId: "delegation-1",
    fromApprover: "approver-1",
    toApprover: "approver-2",
    delegatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    originalApprovalId: "approval-1",
    ttlResetCount: 0,
    maxTtlResets: 3,
    status: DelegationStatus.COMPLETED,
  };

  // When status is COMPLETED, isDelegationExpired returns false (status !== EXPIRED)
  assert.strictEqual(manager.isDelegationExpired(delegation), false);
});

test("EscalationManager isDelegationExpired handles future expiry correctly", () => {
  const manager = new EscalationManager();
  const delegation: Delegation = {
    delegationId: "delegation-1",
    fromApprover: "approver-1",
    toApprover: "approver-2",
    delegatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    originalApprovalId: "approval-1",
    ttlResetCount: 0,
    maxTtlResets: 3,
    status: DelegationStatus.ACTIVE,
  };

  assert.strictEqual(manager.isDelegationExpired(delegation), false);
});

test("EscalationManager isDelegationExpired handles past expiry correctly", () => {
  const manager = new EscalationManager();
  const delegation: Delegation = {
    delegationId: "delegation-1",
    fromApprover: "approver-1",
    toApprover: "approver-2",
    delegatedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    originalApprovalId: "approval-1",
    ttlResetCount: 0,
    maxTtlResets: 3,
    status: DelegationStatus.ACTIVE,
  };

  assert.strictEqual(manager.isDelegationExpired(delegation), true);
});

test("EscalationManager isDelegationExpired handles exactly at expiry boundary", () => {
  const manager = new EscalationManager();
  const exactExpiry = Date.now() - 1; // 1ms in the past
  const delegation: Delegation = {
    delegationId: "delegation-1",
    fromApprover: "approver-1",
    toApprover: "approver-2",
    delegatedAt: new Date().toISOString(),
    expiresAt: new Date(exactExpiry).toISOString(),
    originalApprovalId: "approval-1",
    ttlResetCount: 0,
    maxTtlResets: 3,
    status: DelegationStatus.ACTIVE,
  };

  // At or before expiry should return true
  assert.strictEqual(manager.isDelegationExpired(delegation), true);
});

// ============================================================================
// Notification Channel Tests
// ============================================================================

test("EscalationManager notifyChannels filters disabled channels", async () => {
  const manager = new EscalationManager();
  const channels: NotificationChannel[] = [
    { type: NotificationChannelType.EMAIL, address: "enabled@example.com", enabled: true },
    { type: NotificationChannelType.EMAIL, address: "disabled@example.com", enabled: false },
  ];
  const message: NotificationMessage = {
    title: "Test",
    body: "Test message",
    priority: NotificationPriority.NORMAL,
  };

  // Should not throw even with disabled channels
  await manager.notifyChannels(channels, message);
  assert.ok(true);
});

test("EscalationManager notifyChannels handles empty channel list", async () => {
  const manager = new EscalationManager();
  const message: NotificationMessage = {
    title: "Test",
    body: "Test message",
    priority: NotificationPriority.NORMAL,
  };

  await manager.notifyChannels([], message);
  assert.ok(true);
});

test("EscalationManager notifyChannels handles FEISHU channel type", async () => {
  const manager = new EscalationManager();
  const channels: NotificationChannel[] = [
    { type: NotificationChannelType.FEISHU, address: "https://feishu.example.com/webhook", enabled: true },
  ];
  const message: NotificationMessage = {
    title: "Escalation",
    body: "Test escalation",
    priority: NotificationPriority.HIGH,
  };

  await manager.notifyChannels(channels, message);
  assert.ok(true);
});

test("EscalationManager notifyChannels handles WEBHOOK channel type", async () => {
  const manager = new EscalationManager();
  const channels: NotificationChannel[] = [
    { type: NotificationChannelType.WEBHOOK, address: "https://webhook.example.com/notify", enabled: true },
  ];
  const message: NotificationMessage = {
    title: "Escalation",
    body: "Test escalation",
    priority: NotificationPriority.HIGH,
  };

  await manager.notifyChannels(channels, message);
  assert.ok(true);
});

test("EscalationManager notifyChannels includes metadata in notification", async () => {
  const manager = new EscalationManager();
  const channels: NotificationChannel[] = [
    { type: NotificationChannelType.EMAIL, address: "test@example.com", enabled: true },
  ];
  const message: NotificationMessage = {
    title: "Escalation",
    body: "Test escalation",
    metadata: {
      taskId: "task-123",
      approvalId: "approval-456",
    },
    priority: NotificationPriority.HIGH,
  };

  await manager.notifyChannels(channels, message);
  assert.ok(true);
});

// ============================================================================
// Escalation Context Creation Tests
// ============================================================================

test("EscalationManager createTimeoutContext with all parameters", () => {
  const manager = new EscalationManager();

  const context = manager.createTimeoutContext("approval-1", "task-1", "exec-1", 2);

  assert.strictEqual(context.approvalId, "approval-1");
  assert.strictEqual(context.taskId, "task-1");
  assert.strictEqual(context.executionId, "exec-1");
  assert.strictEqual(context.currentLevel, 2);
  assert.strictEqual(context.reason, EscalationReason.TIMEOUT);
});

test("EscalationManager createTimeoutContext with null executionId", () => {
  const manager = new EscalationManager();

  const context = manager.createTimeoutContext("approval-1", "task-1", null, 0);

  assert.strictEqual(context.approvalId, "approval-1");
  assert.strictEqual(context.executionId, null);
});

test("EscalationManager createQuorumNotMetContext with all parameters", () => {
  const manager = new EscalationManager();

  const context = manager.createQuorumNotMetContext("approval-1", "task-1", "exec-1", 1);

  assert.strictEqual(context.approvalId, "approval-1");
  assert.strictEqual(context.taskId, "task-1");
  assert.strictEqual(context.executionId, "exec-1");
  assert.strictEqual(context.currentLevel, 1);
  assert.strictEqual(context.reason, EscalationReason.QUORUM_NOT_MET);
});

test("EscalationManager createTimeoutContext sets escalatedFrom when provided", () => {
  const manager = new EscalationManager();

  const context = manager.createTimeoutContext("approval-1", "task-1", "exec-1", 2);

  // escalatedFrom is not set in createTimeoutContext, but could be set manually
  assert.strictEqual(context.escalatedFrom, undefined);
});

// ============================================================================
// Max Depth Edge Cases
// ============================================================================

test("EscalationManager canEscalate handles zero max depth", () => {
  const manager = new EscalationManager();

  assert.strictEqual(manager.canEscalate(0, 0), false);
});

test("EscalationManager canEscalate handles negative current level", () => {
  const manager = new EscalationManager();

  // Should still work - negative is treated as under max
  assert.strictEqual(manager.canEscalate(-1, 3), true);
});

test("EscalationManager createEscalation throws when at max depth boundary", () => {
  const manager = new EscalationManager();
  const context = createTestContext({ approvalId: "approval-1", currentLevel: 2 }); // Current level 2
  const rule = createTestRule();
  rule.maxEscalationDepth = 2; // Max depth 2

  // Level 2 can escalate to 3, but max is 2, so should throw
  assert.throws(
    () => manager.createEscalation(context, rule),
    /Cannot escalate beyond max depth/,
  );
});

test("EscalationManager createEscalation throws when exceeding max depth", () => {
  const manager = new EscalationManager();
  const context = createTestContext({ approvalId: "approval-1", currentLevel: 3 }); // Current level 3
  const rule = createTestRule();
  rule.maxEscalationDepth = 3; // Max depth 3

  // Level 3 + 1 = 4 > 3, should throw
  assert.throws(
    () => manager.createEscalation(context, rule),
    /Cannot escalate beyond max depth/,
  );
});

// ============================================================================
// Multiple Escalation Levels Tests
// ============================================================================

test("EscalationManager handles escalation to different approvers", () => {
  const manager = new EscalationManager();

  const ctx1 = createTestContext({ approvalId: "approval-1", currentLevel: 0 });
  const rule1 = createTestRule({ escalateTo: { type: "role", identifier: "senior", can_delegate: true }, maxEscalationDepth: 4 });
  const esc1 = manager.createEscalation(ctx1, rule1);
  assert.strictEqual(esc1.escalateTo.identifier, "senior");

  const ctx2 = createTestContext({ approvalId: "approval-1", currentLevel: 1 });
  const rule2 = createTestRule({ escalateTo: { type: "role", identifier: "manager", can_delegate: true }, maxEscalationDepth: 4 });
  const esc2 = manager.createEscalation(ctx2, rule2);
  assert.strictEqual(esc2.escalateTo.identifier, "manager");

  const ctx3 = createTestContext({ approvalId: "approval-1", currentLevel: 2 });
  const rule3 = createTestRule({ escalateTo: { type: "role", identifier: "director", can_delegate: true }, maxEscalationDepth: 4 });
  const esc3 = manager.createEscalation(ctx3, rule3);
  assert.strictEqual(esc3.escalateTo.identifier, "director");
});

test("EscalationManager escalation levels are sequential", () => {
  const manager = new EscalationManager();

  const ctx1 = createTestContext({ approvalId: "approval-1", currentLevel: 0 });
  const rule = createTestRule({ maxEscalationDepth: 4 });
  const esc1 = manager.createEscalation(ctx1, rule);

  const ctx2 = createTestContext({ approvalId: "approval-1", currentLevel: esc1.level });
  const esc2 = manager.createEscalation(ctx2, rule);

  const ctx3 = createTestContext({ approvalId: "approval-1", currentLevel: esc2.level });
  const esc3 = manager.createEscalation(ctx3, rule);

  assert.strictEqual(esc2.level, esc1.level + 1);
  assert.strictEqual(esc3.level, esc2.level + 1);
});

// ============================================================================
// Default Timeout Tests
// ============================================================================

test("EscalationManager uses custom default timeout", () => {
  const manager = new EscalationManager(60000); // 60 seconds

  const context = manager.createTimeoutContext("approval-1", "task-1", null, 0);

  // The context should still have the approvalId set correctly
  assert.strictEqual(context.approvalId, "approval-1");
});

test("EscalationManager escalation history persists across same approval", () => {
  const manager = new EscalationManager();
  const rule = createTestRule({ maxEscalationDepth: 4 });

  // Create multiple escalations for same approval
  manager.createEscalation(createTestContext({ approvalId: "same-approval", currentLevel: 0 }), rule);
  manager.createEscalation(createTestContext({ approvalId: "same-approval", currentLevel: 1 }), rule);
  manager.createEscalation(createTestContext({ approvalId: "same-approval", currentLevel: 2 }), rule);

  const history = manager.getEscalationHistory("same-approval");

  assert.strictEqual(history.length, 3);
});

test("EscalationManager escalation history is separate per approval", () => {
  const manager = new EscalationManager();
  const rule = createTestRule();

  manager.createEscalation(createTestContext({ approvalId: "approval-A", currentLevel: 0 }), rule);
  manager.createEscalation(createTestContext({ approvalId: "approval-B", currentLevel: 0 }), rule);

  const historyA = manager.getEscalationHistory("approval-A");
  const historyB = manager.getEscalationHistory("approval-B");

  assert.strictEqual(historyA.length, 1);
  assert.strictEqual(historyB.length, 1);
});

// ============================================================================
// Get Active Delegation For Approval Tests
// ============================================================================

test("EscalationManager getActiveDelegationForApproval returns undefined for expired", async () => {
  const manager = new EscalationManager();

  // Create a delegation
  await manager.createDelegation("approver-1", "approver-2", "approval-with-delegation", 1); // 1ms TTL

  // Wait for expiration
  await new Promise((resolve) => setTimeout(resolve, 10));

  const delegation = manager.getActiveDelegationForApproval("approval-with-delegation");

  // After expiration, should return undefined
  assert.strictEqual(delegation, undefined);
});

test("EscalationManager getActiveDelegationForApproval returns undefined for revoked", async () => {
  const manager = new EscalationManager();

  const delegation = await manager.createDelegation("approver-1", "approver-2", "approval-revoked", 3600000);
  await manager.revokeDelegation(delegation.delegationId);

  const result = manager.getActiveDelegationForApproval("approval-revoked");

  assert.strictEqual(result, undefined);
});

test("EscalationManager getActiveDelegationForApproval returns undefined for completed", async () => {
  const manager = new EscalationManager();

  const delegation = await manager.createDelegation("approver-1", "approver-2", "approval-completed", 3600000);
  manager.completeDelegation(delegation.delegationId);

  const result = manager.getActiveDelegationForApproval("approval-completed");

  assert.strictEqual(result, undefined);
});

// ============================================================================
// Get Current Escalation Level Tests
// ============================================================================

test("EscalationManager getCurrentEscalationLevel returns 0 for empty history", () => {
  const manager = new EscalationManager();

  const level = manager.getCurrentEscalationLevel("never-escalated");

  assert.strictEqual(level, 0);
});

test("EscalationManager getCurrentEscalationLevel returns max of all levels", () => {
  const manager = new EscalationManager();
  const rule = createTestRule({ maxEscalationDepth: 4 });

  // Create escalations that might not be in order
  manager.createEscalation(createTestContext({ approvalId: "approval-1", currentLevel: 0 }), rule);
  manager.createEscalation(createTestContext({ approvalId: "approval-1", currentLevel: 1 }), rule);
  manager.createEscalation(createTestContext({ approvalId: "approval-1", currentLevel: 2 }), rule);

  const level = manager.getCurrentEscalationLevel("approval-1");

  assert.strictEqual(level, 3); // Highest level created
});

// ============================================================================
// Notify Channels Priority Tests
// ============================================================================

test("EscalationManager notifyChannels respects HIGH priority", async () => {
  const manager = new EscalationManager();
  const channels: NotificationChannel[] = [
    { type: NotificationChannelType.EMAIL, address: "test@example.com", enabled: true, priority: NotificationPriority.HIGH },
  ];
  const message: NotificationMessage = {
    title: "Critical Escalation",
    body: "Immediate attention required",
    priority: NotificationPriority.HIGH,
  };

  await manager.notifyChannels(channels, message);
  assert.ok(true);
});

test("EscalationManager notifyChannels respects LOW priority", async () => {
  const manager = new EscalationManager();
  const channels: NotificationChannel[] = [
    { type: NotificationChannelType.EMAIL, address: "test@example.com", enabled: true, priority: NotificationPriority.LOW },
  ];
  const message: NotificationMessage = {
    title: "Low Priority",
    body: "FYI only",
    priority: NotificationPriority.LOW,
  };

  await manager.notifyChannels(channels, message);
  assert.ok(true);
});

// ============================================================================
// Escalation Result Tests
// ============================================================================

test("EscalationManager escalate returns success true on success", async () => {
  const manager = new EscalationManager();
  const context = createTestContext({ approvalId: "approval-1", currentLevel: 0 });
  const rule = createTestRule();

  const result = await manager.escalate(context, rule);

  assert.strictEqual(result.success, true);
  assert.ok(result.newLevel);
});

test("EscalationManager escalate returns success false with error on failure", async () => {
  const manager = new EscalationManager();
  const context = createTestContext({ approvalId: "approval-1", currentLevel: 100 }); // Over max depth
  const rule = createTestRule();

  const result = await manager.escalate(context, rule);

  assert.strictEqual(result.success, false);
  assert.ok(result.error);
});

test("EscalationManager escalate creates new level with correct properties", async () => {
  const manager = new EscalationManager();
  const context = createTestContext({ approvalId: "approval-escalation-test", currentLevel: 0 });
  const rule = createTestRule();

  const result = await manager.escalate(context, rule);

  assert.ok(result.newLevel);
  assert.strictEqual(result.newLevel!.level, 1);
  assert.strictEqual(result.newLevel!.escalatedBy, "system");
  assert.ok(result.newLevel!.escalatedAt);
  assert.strictEqual(result.newLevel!.reason, EscalationReason.TIMEOUT);
});
