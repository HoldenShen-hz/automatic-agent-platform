import assert from "node:assert/strict";
import test from "node:test";

// Agent Delegation Module barrel - re-exports delegation services
import {
  DelegationManagerService,
  type DelegationExpirationConfig,
  type ExpirationScanResult,
  DelegationTracker,
  type DelegationTreeNode,
  type DelegationMetrics,
  ContextIsolator,
  createContextIsolator,
  IsolationLevel,
  type IsolatedContext,
  TopologyValidator,
  createTopologyValidator,
  type TopologyValidatorConfig,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_FANOUT,
  DelegationDepthExceededError,
  DelegationFanoutExceededError,
  DelegationCycleDetectedError,
  type AgentContext,
  type PermissionSet,
  type PermissionConstraints,
  type DelegationSpec,
  type DelegationResult,
  type DelegationStatus,
  type DelegationHandle,
  type DelegationChainNode,
  type DelegationChain,
  type DelegationCreatedEvent,
  type DelegationCompletedEvent,
  type DelegationFailedEvent,
  type DelegationEvent,
  type DelegationOptions,
  createDelegationManager,
  createDelegationTracker,
} from "../../../../src/platform/agent-delegation/index.js";

test("DelegationManagerService is exported as function", () => {
  assert.equal(typeof DelegationManagerService, "function");
});

test("DelegationTracker is exported as function", () => {
  assert.equal(typeof DelegationTracker, "function");
});

test("ContextIsolator is exported as function", () => {
  assert.equal(typeof ContextIsolator, "function");
});

test("createContextIsolator is exported as function", () => {
  assert.equal(typeof createContextIsolator, "function");
});

test("TopologyValidator is exported as function", () => {
  assert.equal(typeof TopologyValidator, "function");
});

test("createTopologyValidator is exported as function", () => {
  assert.equal(typeof createTopologyValidator, "function");
});

test("DEFAULT_MAX_DEPTH is exported as number", () => {
  assert.equal(typeof DEFAULT_MAX_DEPTH, "number");
  assert.ok(DEFAULT_MAX_DEPTH > 0);
});

test("DEFAULT_MAX_FANOUT is exported as number", () => {
  assert.equal(typeof DEFAULT_MAX_FANOUT, "number");
  assert.ok(DEFAULT_MAX_FANOUT > 0);
});

test("DelegationDepthExceededError is exported as error class", () => {
  assert.equal(typeof DelegationDepthExceededError, "function");
  const error = new DelegationDepthExceededError(5, 3);
  assert.ok(error instanceof Error);
});

test("DelegationFanoutExceededError is exported as error class", () => {
  assert.equal(typeof DelegationFanoutExceededError, "function");
  const error = new DelegationFanoutExceededError(10, 5);
  assert.ok(error instanceof Error);
});

test("DelegationCycleDetectedError is exported as error class", () => {
  assert.equal(typeof DelegationCycleDetectedError, "function");
  const error = new DelegationCycleDetectedError(["a", "b", "a"]);
  assert.ok(error instanceof Error);
});

test("DelegationExpirationConfig type works correctly", () => {
  const config: DelegationExpirationConfig = {
    checkIntervalMs: 60000,
    batchSize: 100,
  };
  assert.equal(config.checkIntervalMs, 60000);
});

test("ExpirationScanResult type works correctly", () => {
  const result: ExpirationScanResult = {
    scanned: 100,
    expired: 5,
    errors: [],
  };
  assert.equal(result.scanned, 100);
  assert.equal(result.expired, 5);
});

test("DelegationTreeNode type works correctly", () => {
  const node: DelegationTreeNode = {
    delegationId: "del-001",
    agentId: "agent-001",
    agentType: "worker",
    depth: 1,
    status: "active",
    children: [],
    createdAt: "2024-01-15T10:00:00Z",
    metrics: {
      totalDelegations: 10,
      maxDepth: 3,
      activeCount: 5,
      completedCount: 4,
      failedCount: 1,
      averageDurationMs: 1000,
    },
  };
  assert.equal(node.delegationId, "del-001");
  assert.equal(node.depth, 1);
});

test("DelegationMetrics type works correctly", () => {
  const metrics: DelegationMetrics = {
    totalDelegations: 100,
    maxDepth: 5,
    activeCount: 10,
    completedCount: 80,
    failedCount: 10,
    averageDurationMs: 2000,
  };
  assert.equal(metrics.totalDelegations, 100);
});

test("IsolationLevel type works correctly", () => {
  const level: IsolationLevel = IsolationLevel.FULL;
  assert.equal(level, "full");
});

test("IsolatedContext type works correctly", () => {
  const context: IsolatedContext = {
    context: {
      agentId: "agent-001",
      agentType: "worker",
      packId: "pack-001",
      delegationDepth: 0,
      activeDelegations: [],
      permissions: { resources: [], actions: [], constraints: {} },
      sandboxTier: "read_only",
      correlationId: "corr-001",
      tenantId: null,
    },
    inheritedPermissions: { resources: [], actions: [], constraints: {} },
    narrowedPermissions: { resources: [], actions: [], constraints: {} },
    isolationLevel: IsolationLevel.FULL,
  };
  assert.equal(context.context.agentId, "agent-001");
});

test("TopologyValidatorConfig type works correctly", () => {
  const config: TopologyValidatorConfig = {
    maxDepth: 5,
    maxFanout: 10,
  };
  assert.equal(config.maxDepth, 5);
});

test("AgentContext type works correctly", () => {
  const context: AgentContext = {
    agentId: "agent-001",
    agentType: "worker",
    packId: "pack-001",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: { resources: [], actions: [], constraints: {} },
    sandboxTier: "read_only",
    correlationId: "corr-001",
    tenantId: null,
  };
  assert.equal(context.agentId, "agent-001");
});

test("PermissionSet type works correctly", () => {
  const perms: PermissionSet = {
    resources: ["resource-1"],
    actions: ["action-1"],
    constraints: {},
  };
  assert.equal(perms.resources[0], "resource-1");
});

test("PermissionConstraints type works correctly", () => {
  const constraints: PermissionConstraints = {
    maxDurationMs: 5000,
    maxTokens: 1000,
  };
  assert.equal(constraints.maxDurationMs, 5000);
});

test("DelegationSpec type works correctly", () => {
  const spec: DelegationSpec = {
    targetAgentId: "agent-002",
    targetAgentType: "worker",
    targetPackId: "pack-001",
    requiredPermissions: { resources: [], actions: [], constraints: {} },
    timeout: 30000,
  };
  assert.equal(spec.targetAgentId, "agent-002");
});

test("DelegationStatus type works correctly", () => {
  const status: DelegationStatus = "active";
  assert.equal(status, "active");
});

test("DelegationHandle type works correctly", () => {
  const handle: DelegationHandle = {
    delegationId: "del-001",
    parentAgentId: "agent-001",
    childAgentId: "agent-002",
    depth: 1,
    status: "active",
    createdAt: "2024-01-15T10:00:00Z",
    timeout: 30000,
    correlationId: "corr-001",
  };
  assert.equal(handle.delegationId, "del-001");
});

test("DelegationChainNode type works correctly", () => {
  const node: DelegationChainNode = {
    delegationId: "del-001",
    agentId: "agent-001",
    agentType: "worker",
    depth: 0,
    createdAt: "2024-01-15T10:00:00Z",
    parentDelegationId: null,
  };
  assert.equal(node.agentId, "agent-001");
});

test("DelegationChain type works correctly", () => {
  const chain: DelegationChain = {
    rootAgentId: "agent-001",
    nodes: [],
    maxDepthReached: 0,
    totalDelegations: 0,
  };
  assert.equal(chain.rootAgentId, "agent-001");
});

test("DelegationCreatedEvent type works correctly", () => {
  const event: DelegationCreatedEvent = {
    eventType: "delegation.created",
    delegationId: "del-001",
    parentAgentId: "agent-001",
    childAgentId: "agent-002",
    depth: 1,
    timestamp: "2024-01-15T10:00:00Z",
    correlationId: "corr-001",
  };
  assert.equal(event.eventType, "delegation.created");
});

test("DelegationCompletedEvent type works correctly", () => {
  const event: DelegationCompletedEvent = {
    eventType: "delegation.completed",
    delegationId: "del-001",
    durationMs: 1000,
    timestamp: "2024-01-15T10:00:00Z",
  };
  assert.equal(event.eventType, "delegation.completed");
});

test("DelegationFailedEvent type works correctly", () => {
  const event: DelegationFailedEvent = {
    eventType: "delegation.failed",
    delegationId: "del-001",
    error: "timeout",
    timestamp: "2024-01-15T10:00:00Z",
  };
  assert.equal(event.eventType, "delegation.failed");
  assert.equal(event.error, "timeout");
});

test("DelegationOptions type works correctly", () => {
  const options: DelegationOptions = {
    maxDepth: 5,
    maxDelegationDepth: 5,
    maxFanout: 10,
    defaultTimeoutMs: 30000,
  };
  assert.equal(options.defaultTimeoutMs, 30000);
});

test("createDelegationManager is exported as function", () => {
  assert.equal(typeof createDelegationManager, "function");
});

test("createDelegationTracker is exported as function", () => {
  assert.equal(typeof createDelegationTracker, "function");
});
