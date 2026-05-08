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
  type IsolationLevel,
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
    maxAgeMs: 3600000,
    scanIntervalMs: 60000,
  };
  assert.equal(config.maxAgeMs, 3600000);
});

test("ExpirationScanResult type works correctly", () => {
  const result: ExpirationScanResult = {
    scannedCount: 100,
    expiredCount: 5,
    cleanedUpCount: 5,
  };
  assert.equal(result.scannedCount, 100);
  assert.equal(result.expiredCount, 5);
});

test("DelegationTreeNode type works correctly", () => {
  const node: DelegationTreeNode = {
    delegationId: "del-001",
    depth: 1,
    children: [],
    createdAt: "2024-01-15T10:00:00Z",
  };
  assert.equal(node.delegationId, "del-001");
  assert.equal(node.depth, 1);
});

test("DelegationMetrics type works correctly", () => {
  const metrics: DelegationMetrics = {
    activeDelegations: 10,
    totalDelegations: 100,
    averageDepth: 2.5,
  };
  assert.equal(metrics.activeDelegations, 10);
});

test("IsolationLevel type works correctly", () => {
  const level: IsolationLevel = "full";
  assert.equal(level, "full");
});

test("IsolatedContext type works correctly", () => {
  const context: IsolatedContext = {
    delegationId: "del-001",
    agentId: "agent-001",
    permissions: {},
    createdAt: "2024-01-15T10:00:00Z",
  };
  assert.equal(context.delegationId, "del-001");
});

test("TopologyValidatorConfig type works correctly", () => {
  const config: TopologyValidatorConfig = {
    maxDepth: 5,
    maxFanout: 10,
    allowCycles: false,
  };
  assert.equal(config.maxDepth, 5);
  assert.equal(config.allowCycles, false);
});

test("AgentContext type works correctly", () => {
  const context: AgentContext = {
    agentId: "agent-001",
    workspaceId: "ws-001",
    permissions: {},
  };
  assert.equal(context.agentId, "agent-001");
});

test("PermissionSet type works correctly", () => {
  const perms: PermissionSet = {
    canDelegate: true,
    canExecute: true,
    canRead: true,
  };
  assert.equal(perms.canDelegate, true);
});

test("PermissionConstraints type works correctly", () => {
  const constraints: PermissionConstraints = {
    maxDepth: 3,
    allowedTargets: ["worker", "agent"],
  };
  assert.equal(constraints.maxDepth, 3);
});

test("DelegationSpec type works correctly", () => {
  const spec: DelegationSpec = {
    sourceAgentId: "agent-001",
    targetAgentId: "agent-002",
    permissions: { canDelegate: true, canExecute: true, canRead: true },
    constraints: { maxDepth: 3, allowedTargets: ["worker"] },
  };
  assert.equal(spec.sourceAgentId, "agent-001");
  assert.equal(spec.targetAgentId, "agent-002");
});

test("DelegationStatus type works correctly", () => {
  const status: DelegationStatus = "active";
  assert.equal(status, "active");
});

test("DelegationHandle type works correctly", () => {
  const handle: DelegationHandle = {
    delegationId: "del-001",
    correlationId: "corr-001",
    status: "active",
  };
  assert.equal(handle.delegationId, "del-001");
});

test("DelegationChainNode type works correctly", () => {
  const node: DelegationChainNode = {
    agentId: "agent-001",
    delegatedAt: "2024-01-15T10:00:00Z",
    permissions: { canDelegate: true, canExecute: true, canRead: true },
  };
  assert.equal(node.agentId, "agent-001");
});

test("DelegationChain type works correctly", () => {
  const chain: DelegationChain = {
    chainId: "chain-001",
    nodes: [],
    createdAt: "2024-01-15T10:00:00Z",
  };
  assert.equal(chain.chainId, "chain-001");
});

test("DelegationCreatedEvent type works correctly", () => {
  const event: DelegationCreatedEvent = {
    type: "delegation.created",
    delegationId: "del-001",
    timestamp: "2024-01-15T10:00:00Z",
  };
  assert.equal(event.type, "delegation.created");
});

test("DelegationCompletedEvent type works correctly", () => {
  const event: DelegationCompletedEvent = {
    type: "delegation.completed",
    delegationId: "del-001",
    timestamp: "2024-01-15T10:00:00Z",
  };
  assert.equal(event.type, "delegation.completed");
});

test("DelegationFailedEvent type works correctly", () => {
  const event: DelegationFailedEvent = {
    type: "delegation.failed",
    delegationId: "del-001",
    reason: "timeout",
    timestamp: "2024-01-15T10:00:00Z",
  };
  assert.equal(event.type, "delegation.failed");
  assert.equal(event.reason, "timeout");
});

test("DelegationOptions type works correctly", () => {
  const options: DelegationOptions = {
    timeoutMs: 30000,
    retryOnFailure: true,
    maxRetries: 3,
  };
  assert.equal(options.timeoutMs, 30000);
  assert.equal(options.retryOnFailure, true);
});

test("createDelegationManager is exported as function", () => {
  assert.equal(typeof createDelegationManager, "function");
});

test("createDelegationTracker is exported as function", () => {
  assert.equal(typeof createDelegationTracker, "function");
});
