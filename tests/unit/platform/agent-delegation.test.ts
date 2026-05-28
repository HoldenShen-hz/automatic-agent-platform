import assert from "node:assert/strict";
import test from "node:test";

import {
  TopologyValidator,
  createTopologyValidator,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_FANOUT,
  DelegationDepthExceededError,
  DelegationFanoutExceededError,
  DelegationCycleDetectedError,
  type TopologyValidatorConfig,
} from "../../../src/platform/five-plane-orchestration/agent-delegation/index.js";

import {
  ContextIsolator,
  createContextIsolator,
  IsolationLevel,
  type IsolatedContext,
} from "../../../src/platform/five-plane-orchestration/agent-delegation/index.js";

import {
  DelegationTracker,
  createDelegationTracker,
  type DelegationTreeNode,
  type DelegationMetrics,
} from "../../../src/platform/five-plane-orchestration/agent-delegation/index.js";

import {
  DelegationManagerService,
  createDelegationManager,
  type DelegationExpirationConfig,
  type ExpirationScanResult,
} from "../../../src/platform/five-plane-orchestration/agent-delegation/index.js";

import type {
  AgentContext,
  PermissionSet,
  DelegationSpec,
  DelegationResult,
  DelegationOptions,
} from "../../../src/platform/five-plane-orchestration/agent-delegation/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// TopologyValidator Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DEFAULT_MAX_DEPTH is 3", () => {
  assert.equal(DEFAULT_MAX_DEPTH, 3);
});

test("DEFAULT_MAX_FANOUT is 10", () => {
  assert.equal(DEFAULT_MAX_FANOUT, 10);
});

test("createTopologyValidator uses defaults when no config provided", () => {
  const validator = createTopologyValidator();
  assert.equal(validator.getMaxDepth(), DEFAULT_MAX_DEPTH);
  assert.equal(validator.getMaxFanout(), DEFAULT_MAX_FANOUT);
});

test("createTopologyValidator applies custom config", () => {
  const validator = createTopologyValidator({ maxDepth: 5, maxFanout: 20 });
  assert.equal(validator.getMaxDepth(), 5);
  assert.equal(validator.getMaxFanout(), 20);
});

test("TopologyValidator.validateDepth throws when depth exceeds max depth", () => {
  const validator = createTopologyValidator({ maxDepth: 3 });
  assert.throws(
    () => validator.validateDepth(4),
    DelegationDepthExceededError,
  );
});

test("TopologyValidator.validateDepth does not throw below max depth", () => {
  const validator = createTopologyValidator({ maxDepth: 3 });
  validator.validateDepth(2); // Should not throw
});

test("TopologyValidator.validateDepth throws when at max depth", () => {
  const validator = createTopologyValidator({ maxDepth: 3 });
  assert.throws(
    () => validator.validateDepth(3),
    DelegationDepthExceededError,
  );
});

test("TopologyValidator.validateFanout throws when at max fanout", () => {
  const validator = createTopologyValidator({ maxFanout: 10 });
  assert.throws(
    () => validator.validateFanout(10),
    DelegationFanoutExceededError,
  );
});

test("TopologyValidator.validateFanout does not throw below max fanout", () => {
  const validator = createTopologyValidator({ maxFanout: 10 });
  validator.validateFanout(9); // Should not throw
});

test("TopologyValidator.detectCycle throws when packId in chain", () => {
  const validator = createTopologyValidator();
  assert.throws(
    () => validator.detectCycle("pack-1", ["pack-2", "pack-1", "pack-3"]),
    DelegationCycleDetectedError,
  );
});

test("TopologyValidator.detectCycle does not throw when packId not in chain", () => {
  const validator = createTopologyValidator();
  validator.detectCycle("pack-1", ["pack-2", "pack-3"]); // Should not throw
});

test("TopologyValidator.validatePackId throws when packId not allowed", () => {
  const validator = createTopologyValidator({ allowedPackIds: ["allowed-pack"] });
  assert.throws(
    () => validator.validatePackId("forbidden-pack"),
  );
});

test("TopologyValidator.validatePackId does not throw when packId allowed", () => {
  const validator = createTopologyValidator({ allowedPackIds: ["allowed-pack"] });
  validator.validatePackId("allowed-pack"); // Should not throw
});

test("TopologyValidator.validatePackId does not throw when no allowed list", () => {
  const validator = createTopologyValidator();
  validator.validatePackId("any-pack"); // Should not throw
});

test("TopologyValidator.getMaxDepth returns configured depth", () => {
  const validator = createTopologyValidator({ maxDepth: 7 });
  assert.equal(validator.getMaxDepth(), 7);
});

test("TopologyValidator.getMaxFanout returns configured fanout", () => {
  const validator = createTopologyValidator({ maxFanout: 15 });
  assert.equal(validator.getMaxFanout(), 15);
});

test("TopologyValidator.validate runs all checks", () => {
  const validator = createTopologyValidator({ maxDepth: 3, maxFanout: 5, allowedPackIds: ["allowed"] });
  // depth beyond max should fail
  assert.throws(
    () => validator.validate({ currentDepth: 4, activeDelegations: 3, targetPackId: "allowed", delegationChain: [] }),
    DelegationDepthExceededError,
  );
});

test("DelegationDepthExceededError contains depth info", () => {
  const error = new DelegationDepthExceededError(5, 3);
  assert.equal(error.code, "delegation.depth_exceeded");
  const details = error.details as { currentDepth: number; maxDepth: number };
  assert.equal(details.currentDepth, 5);
  assert.equal(details.maxDepth, 3);
});

test("DelegationFanoutExceededError contains fanout info", () => {
  const error = new DelegationFanoutExceededError(15, 10);
  assert.equal(error.code, "delegation.fanout_exceeded");
  const details = error.details as { currentFanout: number; maxFanout: number };
  assert.equal(details.currentFanout, 15);
  assert.equal(details.maxFanout, 10);
});

test("DelegationCycleDetectedError contains cycle info", () => {
  const chain = ["pack-1", "pack-2", "pack-3"];
  const error = new DelegationCycleDetectedError("pack-2", chain);
  assert.equal(error.code, "delegation.cycle_detected");
  const details = error.details as { packId: string; chain: readonly string[] };
  assert.equal(details.packId, "pack-2");
});

// ─────────────────────────────────────────────────────────────────────────────
// ContextIsolator Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createContextIsolator returns new instance", () => {
  const isolator = createContextIsolator();
  assert.ok(isolator instanceof ContextIsolator);
});

test("IsolationLevel enum has all expected values", () => {
  assert.equal(IsolationLevel.FULL, "full");
  assert.equal(IsolationLevel.PARTIAL, "partial");
  assert.equal(IsolationLevel.MINIMAL, "minimal");
  assert.equal(IsolationLevel.SANDBOXED, "sandboxed");
});

test("ContextIsolator.isolate creates child context with incremented depth", () => {
  const isolator = createContextIsolator();
  const parent: AgentContext = {
    agentId: "parent-1",
    agentType: "agent",
    packId: "pack-1",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["resource-1", "resource-2"],
      actions: ["action-1", "action-2"],
      constraints: { maxDurationMs: 60000, maxTokens: 1000 },
    },
    sandboxTier: "read_only",
    correlationId: "corr-1",
    tenantId: "tenant-1",
  };

  const spec: DelegationSpec = {
    targetAgentId: "child-1",
    targetAgentType: "agent",
    targetPackId: "pack-2",
    requiredPermissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    timeout: 30000,
  };

  const result = isolator.isolate(parent, spec);

  assert.equal(result.context.agentId, "child-1");
  assert.equal(result.context.delegationDepth, 1);
  assert.ok(result.context.correlationId.startsWith("corr-1:"));
});

test("ContextIsolator.isolate with sandboxed parent returns SANDBOXED isolation", () => {
  const isolator = createContextIsolator();
  const parent: AgentContext = {
    agentId: "parent-1",
    agentType: "agent",
    packId: "pack-1",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    sandboxTier: "workspace_write",
    correlationId: "corr-1",
    tenantId: "tenant-1",
  };

  const spec: DelegationSpec = {
    targetAgentId: "child-1",
    targetAgentType: "agent",
    targetPackId: "pack-2",
    requiredPermissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    timeout: 30000,
  };

  const result = isolator.isolate(parent, spec);
  assert.equal(result.isolationLevel, IsolationLevel.SANDBOXED);
});

test("ContextIsolator.validatePermissionRequest returns true for valid request", () => {
  const isolator = createContextIsolator();
  const parent: PermissionSet = {
    resources: ["resource-1", "resource-2"],
    actions: ["action-1", "action-2"],
    constraints: {},
  };

  const requested: PermissionSet = {
    resources: ["resource-1"],
    actions: ["action-1"],
    constraints: {},
  };

  assert.equal(isolator.validatePermissionRequest(parent, requested), true);
});

test("ContextIsolator.validatePermissionRequest returns false when resource not allowed", () => {
  const isolator = createContextIsolator();
  const parent: PermissionSet = {
    resources: ["resource-1"],
    actions: ["action-1"],
    constraints: {},
  };

  const requested: PermissionSet = {
    resources: ["resource-2"], // Not in parent
    actions: ["action-1"],
    constraints: {},
  };

  assert.equal(isolator.validatePermissionRequest(parent, requested), false);
});

test("ContextIsolator.validatePermissionRequest returns false when action not allowed", () => {
  const isolator = createContextIsolator();
  const parent: PermissionSet = {
    resources: ["resource-1"],
    actions: ["action-1"],
    constraints: {},
  };

  const requested: PermissionSet = {
    resources: ["resource-1"],
    actions: ["action-2"], // Not in parent
    constraints: {},
  };

  assert.equal(isolator.validatePermissionRequest(parent, requested), false);
});

test("ContextIsolator.mergePermissions takes more restrictive values", () => {
  const isolator = createContextIsolator();
  const base: PermissionSet = {
    resources: ["resource-1"],
    actions: ["action-1"],
    constraints: { maxDurationMs: 60000, maxTokens: 5000 },
  };

  const override: PermissionSet = {
    resources: [],
    actions: [],
    constraints: { maxDurationMs: 30000, maxTokens: 1000 },
  };

  const merged = isolator.mergePermissions(base, override);

  assert.equal(merged.constraints.maxDurationMs, 30000);
  assert.equal(merged.constraints.maxTokens, 1000);
});

test("ContextIsolator.mergePermissions with empty override falls back to base resources and actions", () => {
  const isolator = createContextIsolator();
  const base: PermissionSet = {
    resources: ["resource-1"],
    actions: ["action-1"],
    constraints: { maxDurationMs: 60000 },
  };

  const override: PermissionSet = {
    resources: [],
    actions: [],
    constraints: {},
  };

  const merged = isolator.mergePermissions(base, override);

  assert.deepEqual(merged.resources, ["resource-1"]);
  assert.deepEqual(merged.actions, ["action-1"]);
  assert.equal(merged.constraints.maxDurationMs, 60000);
});

// ─────────────────────────────────────────────────────────────────────────────
// DelegationTracker Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createDelegationTracker returns new instance", () => {
  const tracker = createDelegationTracker();
  assert.ok(tracker instanceof DelegationTracker);
});

test("DelegationTracker.getChain returns null for unknown agent", () => {
  const tracker = createDelegationTracker();
  assert.equal(tracker.getChain("unknown-agent"), null);
});

test("DelegationTracker.getTree returns null for unknown agent", () => {
  const tracker = createDelegationTracker();
  assert.equal(tracker.getTree("unknown-agent"), null);
});

test("DelegationTracker.recordDelegation creates chain entry", () => {
  const tracker = createDelegationTracker();

  const delegation: DelegationResult = {
    delegationId: "dlg-1",
    parentAgentId: "parent-1",
    childAgentId: "child-1",
    depth: 1,
    permissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    grantedPermissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    correlationId: "corr-1",
    status: "pending",
  };

  tracker.recordDelegation(delegation, "parent-1");

  const chain = tracker.getChain("parent-1");
  assert.ok(chain !== null);
  assert.equal(chain!.rootAgentId, "parent-1");
  assert.equal(chain!.nodes.length, 1);
  assert.equal(chain!.nodes[0]!.delegationId, "dlg-1");
});

test("DelegationTracker.recordDelegation increments totalDelegations", () => {
  const tracker = createDelegationTracker();

  const delegation1: DelegationResult = {
    delegationId: "dlg-1",
    parentAgentId: "parent-1",
    childAgentId: "child-1",
    depth: 1,
    permissions: { resources: [], actions: [], constraints: {} },
    grantedPermissions: { resources: [], actions: [], constraints: {} },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    correlationId: "corr-1",
    status: "pending",
  };

  const delegation2: DelegationResult = {
    delegationId: "dlg-2",
    parentAgentId: "parent-1",
    childAgentId: "child-2",
    depth: 1,
    permissions: { resources: [], actions: [], constraints: {} },
    grantedPermissions: { resources: [], actions: [], constraints: {} },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    correlationId: "corr-2",
    status: "pending",
  };

  tracker.recordDelegation(delegation1, "parent-1");
  tracker.recordDelegation(delegation2, "parent-1");

  const chain = tracker.getChain("parent-1");
  assert.equal(chain!.totalDelegations, 2);
});

test("DelegationTracker.recordEvent stores event", () => {
  const tracker = createDelegationTracker();

  const event = {
    eventType: "delegation.created" as const,
    delegationId: "dlg-1",
    parentAgentId: "parent-1",
    childAgentId: "child-1",
    depth: 1,
    timestamp: new Date().toISOString(),
    correlationId: "corr-1",
  };

  tracker.recordEvent("dlg-1", event);

  const events = tracker.getEvents("dlg-1");
  assert.equal(events.length, 1);
  assert.equal(events[0]!.eventType, "delegation.created");
});

test("DelegationTracker.getEvents returns empty array for unknown delegation", () => {
  const tracker = createDelegationTracker();
  assert.deepEqual(tracker.getEvents("unknown"), []);
});

test("DelegationTracker.getMetrics returns zeros for unknown agent", () => {
  const tracker = createDelegationTracker();
  const metrics = tracker.getMetrics("unknown-agent");

  assert.equal(metrics.totalDelegations, 0);
  assert.equal(metrics.maxDepth, 0);
});

test("DelegationTracker.getMetrics returns correct values after recording", () => {
  const tracker = createDelegationTracker();

  const delegation: DelegationResult = {
    delegationId: "dlg-1",
    parentAgentId: "parent-1",
    childAgentId: "child-1",
    depth: 2,
    permissions: { resources: [], actions: [], constraints: {} },
    grantedPermissions: { resources: [], actions: [], constraints: {} },
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 60000).toISOString(),
    correlationId: "corr-1",
    status: "pending",
  };

  tracker.recordDelegation(delegation, "parent-1");

  const metrics = tracker.getMetrics("parent-1");
  assert.equal(metrics.totalDelegations, 1);
  assert.equal(metrics.maxDepth, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// DelegationManagerService Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createDelegationManager returns new instance", () => {
  const manager = createDelegationManager();
  assert.ok(manager instanceof DelegationManagerService);
});

test("DelegationManagerService.delegate creates delegation handle", async () => {
  const manager = createDelegationManager({ defaultTimeout: 30000 });

  const parent: AgentContext = {
    agentId: "parent-1",
    agentType: "agent",
    packId: "pack-1",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    sandboxTier: "read_only",
    correlationId: "corr-1",
    tenantId: "tenant-1",
  };

  const spec: DelegationSpec = {
    targetAgentId: "child-1",
    targetAgentType: "agent",
    targetPackId: "pack-2",
    requiredPermissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    timeout: 30000,
  };

  const handle = await manager.delegate(parent, spec);

  assert.ok(handle.delegationId.startsWith("dlg_"));
  assert.equal(handle.parentAgentId, "parent-1");
  assert.equal(handle.childAgentId, "child-1");
  assert.equal(handle.depth, 1);
  assert.equal(handle.status, "pending");
});

test("DelegationManagerService.getDelegation retrieves delegation", async () => {
  const manager = createDelegationManager();

  const parent: AgentContext = {
    agentId: "parent-1",
    agentType: "agent",
    packId: "pack-1",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    sandboxTier: "read_only",
    correlationId: "corr-1",
    tenantId: "tenant-1",
  };

  const spec: DelegationSpec = {
    targetAgentId: "child-1",
    targetAgentType: "agent",
    targetPackId: "pack-2",
    requiredPermissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    timeout: 30000,
  };

  const handle = await manager.delegate(parent, spec);
  const delegation = await manager.getDelegation(handle.delegationId);

  assert.ok(delegation !== null);
  assert.equal(delegation!.delegationId, handle.delegationId);
});

test("DelegationManagerService.getDelegation returns null for unknown id", async () => {
  const manager = createDelegationManager();
  assert.equal(await manager.getDelegation("unknown-dlg"), null);
});

test("DelegationManagerService.complete marks delegation as completed", async () => {
  const manager = createDelegationManager();

  const parent: AgentContext = {
    agentId: "parent-1",
    agentType: "agent",
    packId: "pack-1",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    sandboxTier: "read_only",
    correlationId: "corr-1",
    tenantId: "tenant-1",
  };

  const spec: DelegationSpec = {
    targetAgentId: "child-1",
    targetAgentType: "agent",
    targetPackId: "pack-2",
    requiredPermissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    timeout: 30000,
  };

  const handle = await manager.delegate(parent, spec);
  await manager.complete(handle.delegationId);

  const delegation = await manager.getDelegation(handle.delegationId);
  assert.equal(delegation!.status, "completed");
});

test("DelegationManagerService.cancel throws for unknown delegation", async () => {
  const manager = createDelegationManager();
  try {
    await manager.cancel("unknown-dlg");
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("not found"), `Expected "not found" in error message, got: ${err.message}`);
  }
});

test("DelegationManagerService.fail marks delegation as failed", async () => {
  const manager = createDelegationManager();

  const parent: AgentContext = {
    agentId: "parent-1",
    agentType: "agent",
    packId: "pack-1",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    sandboxTier: "read_only",
    correlationId: "corr-1",
    tenantId: "tenant-1",
  };

  const spec: DelegationSpec = {
    targetAgentId: "child-1",
    targetAgentType: "agent",
    targetPackId: "pack-2",
    requiredPermissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    timeout: 30000,
  };

  const handle = await manager.delegate(parent, spec);
  await manager.fail(handle.delegationId, "Something went wrong");

  const delegation = await manager.getDelegation(handle.delegationId);
  assert.equal(delegation!.status, "failed");
});

test("DelegationManagerService.getActiveDelegations returns active delegations", async () => {
  const manager = createDelegationManager();

  const parent: AgentContext = {
    agentId: "parent-1",
    agentType: "agent",
    packId: "pack-1",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    sandboxTier: "read_only",
    correlationId: "corr-1",
    tenantId: "tenant-1",
  };

  const spec: DelegationSpec = {
    targetAgentId: "child-1",
    targetAgentType: "agent",
    targetPackId: "pack-2",
    requiredPermissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    timeout: 30000,
  };

  await manager.delegate(parent, spec);

  const active = await manager.getActiveDelegations("parent-1");
  assert.equal(active.length, 1);
  assert.equal(active[0]!.parentAgentId, "parent-1");
});

test("DelegationManagerService.getDelegationChain returns chain", async () => {
  const manager = createDelegationManager();

  const parent: AgentContext = {
    agentId: "parent-1",
    agentType: "agent",
    packId: "pack-1",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    sandboxTier: "read_only",
    correlationId: "corr-1",
    tenantId: "tenant-1",
  };

  const spec: DelegationSpec = {
    targetAgentId: "child-1",
    targetAgentType: "agent",
    targetPackId: "pack-2",
    requiredPermissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    timeout: 30000,
  };

  await manager.delegate(parent, spec);

  const chain = await manager.getDelegationChain("parent-1");
  assert.ok(chain !== null);
  assert.equal(chain!.rootAgentId, "parent-1");
  assert.equal(chain!.totalDelegations, 1);
});

test("DelegationManagerService.revokeExpiredDelegations returns scan result", async () => {
  const manager = createDelegationManager();
  const result = await manager.revokeExpiredDelegations();

  assert.equal(typeof result.scanned, "number");
  assert.equal(typeof result.expired, "number");
  assert.ok(Array.isArray(result.errors));
});

test("DelegationManagerService.getExpiredDelegations returns list", async () => {
  const manager = createDelegationManager();
  const expired = await manager.getExpiredDelegations();
  assert.ok(Array.isArray(expired));
});

test("DelegationManagerService.getPendingExpirationCount returns number", async () => {
  const manager = createDelegationManager();
  const count = await manager.getPendingExpirationCount();
  assert.equal(typeof count, "number");
});

test("DelegationManagerService with options applies them", () => {
  const options: DelegationOptions = {
    maxDepth: 5,
    maxFanout: 20,
    defaultTimeout: 60000,
  };

  const manager = createDelegationManager(options);
  assert.ok(manager instanceof DelegationManagerService);
});
