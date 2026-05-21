/**
 * Comprehensive tests for EscalationManager
 * Source: src/platform/five-plane-control-plane/approval-center/escalation-manager.ts
 */

import { describe, it, beforeEach, mock } from "node:test";
import assert from "node:assert";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

describe("EscalationManager", () => {
  let EscalationManager: any;
  let NotificationChannelType: any;
  let NotificationPriority: any;
  let EscalationReason: any;
  let DelegationStatus: any;

  beforeEach(() => {
    delete require.cache[require.resolve("./escalation-manager.js")];
    delete require.cache[require.resolve("./escalation-manager.ts")];

    const module = require("./escalation-manager.js");
    EscalationManager = module.EscalationManager;
    NotificationChannelType = module.NotificationChannelType;
    NotificationPriority = module.NotificationPriority;
    EscalationReason = module.EscalationReason;
    DelegationStatus = module.DelegationStatus;
  });

  describe("canEscalate", () => {
    it("should return true when current level is below max depth", () => {
      const manager = new EscalationManager();
      assert.strictEqual(manager.canEscalate(0, 3), true);
      assert.strictEqual(manager.canEscalate(2, 3), true);
    });

    it("should return false when current level equals max depth", () => {
      const manager = new EscalationManager();
      assert.strictEqual(manager.canEscalate(3, 3), false);
      assert.strictEqual(manager.canEscalate(5, 3), false);
    });
  });

  describe("createEscalation", () => {
    it("should create escalation with incremented level", () => {
      const manager = new EscalationManager();

      const context = {
        approvalId: "approval-123",
        taskId: "task-123",
        executionId: null,
        currentLevel: 0,
        reason: EscalationReason.TIMEOUT,
      };

      const rule = {
        escalateTo: { type: "role" as const, identifier: "manager", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      };

      const result = manager.createEscalation(context, rule);

      assert.strictEqual(result.level, 1);
      assert.strictEqual(result.escalateTo.identifier, "manager");
      assert.strictEqual(result.reason, EscalationReason.TIMEOUT);
    });

    it("should throw when max depth exceeded", () => {
      const manager = new EscalationManager();

      const context = {
        approvalId: "approval-123",
        taskId: "task-123",
        executionId: null,
        currentLevel: 3,
        reason: EscalationReason.TIMEOUT,
      };

      const rule = {
        escalateTo: { type: "role" as const, identifier: "manager", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      };

      assert.throws(() => {
        manager.createEscalation(context, rule);
      }, /max depth/);
    });
  });

  describe("createDelegation", () => {
    it("should create delegation between two approvers", () => {
      const manager = new EscalationManager();

      const result = manager.createDelegation("approver-1", "approver-2", "approval-123", 3600000, 3);

      assert.ok(result.delegationId);
      assert.strictEqual(result.fromApprover, "approver-1");
      assert.strictEqual(result.toApprover, "approver-2");
      assert.strictEqual(result.originalApprovalId, "approval-123");
      assert.strictEqual(result.status, DelegationStatus.ACTIVE);
      assert.strictEqual(result.ttlResetCount, 0);
    });

    it("should throw when delegating to self", () => {
      const manager = new EscalationManager();

      assert.throws(() => {
        manager.createDelegation("approver-1", "approver-1", "approval-123");
      }, /yourself/);
    });
  });

  describe("isDelegationExpired", () => {
    it("should return false for active delegation not expired", () => {
      const manager = new EscalationManager();

      const delegation = {
        delegationId: "delegation-123",
        fromApprover: "approver-1",
        toApprover: "approver-2",
        delegatedAt: nowIso(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        originalApprovalId: "approval-123",
        ttlResetCount: 0,
        maxTtlResets: 3,
        status: DelegationStatus.ACTIVE,
      };

      assert.strictEqual(manager.isDelegationExpired(delegation), false);
    });

    it("should return true for expired delegation", () => {
      const manager = new EscalationManager();

      const delegation = {
        delegationId: "delegation-123",
        fromApprover: "approver-1",
        toApprover: "approver-2",
        delegatedAt: nowIso(),
        expiresAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        originalApprovalId: "approval-123",
        ttlResetCount: 0,
        maxTtlResets: 3,
        status: DelegationStatus.ACTIVE,
      };

      assert.strictEqual(manager.isDelegationExpired(delegation), true);
    });

    it("should return true for non-active delegation", () => {
      const manager = new EscalationManager();

      const delegation = {
        delegationId: "delegation-123",
        fromApprover: "approver-1",
        toApprover: "approver-2",
        delegatedAt: nowIso(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        originalApprovalId: "approval-123",
        ttlResetCount: 0,
        maxTtlResets: 3,
        status: DelegationStatus.EXPIRED,
      };

      assert.strictEqual(manager.isDelegationExpired(delegation), true);
    });
  });

  describe("resetDelegationTtl", () => {
    it("should reset TTL and increment reset count", () => {
      const manager = new EscalationManager();

      const delegation = {
        delegationId: "delegation-123",
        fromApprover: "approver-1",
        toApprover: "approver-2",
        delegatedAt: nowIso(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        originalApprovalId: "approval-123",
        ttlResetCount: 0,
        maxTtlResets: 3,
        status: DelegationStatus.ACTIVE,
      };

      const result = manager.resetDelegationTtl(delegation, 7200000);

      assert.strictEqual(result.ttlResetCount, 1);
    });

    it("should throw when max resets exceeded", () => {
      const manager = new EscalationManager();

      const delegation = {
        delegationId: "delegation-123",
        fromApprover: "approver-1",
        toApprover: "approver-2",
        delegatedAt: nowIso(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        originalApprovalId: "approval-123",
        ttlResetCount: 3,
        maxTtlResets: 3,
        status: DelegationStatus.ACTIVE,
      };

      assert.throws(() => {
        manager.resetDelegationTtl(delegation);
      }, /max.*reset/);
    });

    it("should throw when delegation not active", () => {
      const manager = new EscalationManager();

      const delegation = {
        delegationId: "delegation-123",
        fromApprover: "approver-1",
        toApprover: "approver-2",
        delegatedAt: nowIso(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        originalApprovalId: "approval-123",
        ttlResetCount: 0,
        maxTtlResets: 3,
        status: DelegationStatus.REVOKED,
      };

      assert.throws(() => {
        manager.resetDelegationTtl(delegation);
      }, /not active/);
    });
  });

  describe("revokeDelegation", () => {
    it("should revoke an active delegation", () => {
      const manager = new EscalationManager();

      const delegation = {
        delegationId: "delegation-123",
        fromApprover: "approver-1",
        toApprover: "approver-2",
        delegatedAt: nowIso(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        originalApprovalId: "approval-123",
        ttlResetCount: 0,
        maxTtlResets: 3,
        status: DelegationStatus.ACTIVE,
      };

      manager.revokeDelegation("delegation-123");

      // Delegation should now be revoked
      const stored = manager.getDelegation("delegation-123");
      assert.strictEqual(stored?.status, DelegationStatus.REVOKED);
    });

    it("should throw when delegation not found", () => {
      const manager = new EscalationManager();

      assert.throws(() => {
        manager.revokeDelegation("nonexistent");
      }, /not found/);
    });
  });

  describe("completeDelegation", () => {
    it("should mark delegation as completed", () => {
      const manager = new EscalationManager();

      const delegation = {
        delegationId: "delegation-123",
        fromApprover: "approver-1",
        toApprover: "approver-2",
        delegatedAt: nowIso(),
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        originalApprovalId: "approval-123",
        ttlResetCount: 0,
        maxTtlResets: 3,
        status: DelegationStatus.ACTIVE,
      };

      manager.completeDelegation("delegation-123");

      const stored = manager.getDelegation("delegation-123");
      assert.strictEqual(stored?.status, DelegationStatus.COMPLETED);
    });
  });

  describe("getDelegation", () => {
    it("should return undefined for non-existent delegation", () => {
      const manager = new EscalationManager();

      const result = manager.getDelegation("nonexistent");

      assert.strictEqual(result, undefined);
    });

    it("should return delegation when it exists", () => {
      const manager = new EscalationManager();

      manager.createDelegation("approver-1", "approver-2", "approval-123");
      const result = manager.getDelegation("delegation-1");

      assert.ok(result);
    });
  });

  describe("getEscalationHistory", () => {
    it("should return empty array when no history exists", () => {
      const manager = new EscalationManager();

      const result = manager.getEscalationHistory("nonexistent");

      assert.deepStrictEqual(result, []);
    });

    it("should return escalation history for approval", () => {
      const manager = new EscalationManager();

      const context = {
        approvalId: "approval-123",
        taskId: "task-123",
        executionId: null,
        currentLevel: 0,
        reason: EscalationReason.TIMEOUT,
      };

      const rule = {
        escalateTo: { type: "role" as const, identifier: "manager", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      };

      manager.createEscalation(context, rule);

      const history = manager.getEscalationHistory("approval-123");

      assert.strictEqual(history.length, 1);
      assert.strictEqual(history[0]?.level, 1);
    });
  });

  describe("getCurrentEscalationLevel", () => {
    it("should return 0 when no escalation history", () => {
      const manager = new EscalationManager();

      const result = manager.getCurrentEscalationLevel("nonexistent");

      assert.strictEqual(result, 0);
    });

    it("should return max level from history", () => {
      const manager = new EscalationManager();

      const context1 = {
        approvalId: "approval-123",
        taskId: "task-123",
        executionId: null,
        currentLevel: 0,
        reason: EscalationReason.TIMEOUT,
      };

      const context2 = {
        approvalId: "approval-123",
        taskId: "task-123",
        executionId: null,
        currentLevel: 1,
        reason: EscalationReason.TIMEOUT,
      };

      const rule = {
        escalateTo: { type: "role" as const, identifier: "manager", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      };

      manager.createEscalation(context1, rule);
      manager.createEscalation(context2, rule);

      const result = manager.getCurrentEscalationLevel("approval-123");

      assert.strictEqual(result, 2);
    });
  });

  describe("createTimeoutContext", () => {
    it("should create escalation context with timeout reason", () => {
      const manager = new EscalationManager();

      const context = manager.createTimeoutContext("approval-123", "task-123", null, 0);

      assert.strictEqual(context.approvalId, "approval-123");
      assert.strictEqual(context.taskId, "task-123");
      assert.strictEqual(context.reason, EscalationReason.TIMEOUT);
    });
  });

  describe("createQuorumNotMetContext", () => {
    it("should create escalation context with quorum not met reason", () => {
      const manager = new EscalationManager();

      const context = manager.createQuorumNotMetContext("approval-123", "task-123", null, 0);

      assert.strictEqual(context.approvalId, "approval-123");
      assert.strictEqual(context.reason, EscalationReason.QUORUM_NOT_MET);
    });
  });

  describe("escalate", () => {
    it("should escalate and notify channels", async () => {
      const manager = new EscalationManager();

      const context = {
        approvalId: "approval-123",
        taskId: "task-123",
        executionId: null,
        currentLevel: 0,
        reason: EscalationReason.TIMEOUT,
      };

      const rule = {
        escalateTo: { type: "role" as const, identifier: "manager", can_delegate: true },
        maxEscalationDepth: 3,
        notificationChannels: [],
        escalationTimeoutMs: 1800000,
      };

      const result = await manager.escalate(context, rule);

      assert.strictEqual(result.success, true);
      assert.ok(result.newLevel);
    });
  });
});