import assert from "node:assert/strict";
import test from "node:test";
import type {
  AgentContext,
  PermissionSet,
  PermissionConstraints,
  ToolSchemaProperty,
  ToolSchema,
  DelegationSpec,
  PipelineStageDefinition,
  DelegationResult,
  DelegationStatus,
  DelegationHandle,
  DelegationChainNode,
  DelegationChain,
  DelegationOptions,
} from "../../../../../src/platform/orchestration/agent-delegation/delegation-types.js";

test("AgentContext structure", () => {
  const ctx: AgentContext = {
    agentId: "agent-001",
    agentType: "orchestrator",
    packId: "pack-001",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["resource-1"],
      actions: ["action-1"],
      constraints: {},
    },
    sandboxTier: "none",
    correlationId: "corr-001",
    tenantId: null,
  };
  assert.equal(ctx.agentId, "agent-001");
  assert.equal(ctx.delegationDepth, 0);
  assert.equal(ctx.sandboxTier, "none");
});

test("AgentContext accepts canonical sandboxTier values", () => {
  const ctx: AgentContext = {
    agentId: "agent-002",
    agentType: "worker",
    packId: "pack-001",
    delegationDepth: 1,
    activeDelegations: ["del-001"],
    permissions: {
      resources: [],
      actions: [],
      constraints: { maxDurationMs: 30000 },
    },
    sandboxTier: "workspace_write",
    correlationId: "corr-002",
    tenantId: "tenant-001",
  };
  assert.equal(ctx.sandboxTier, "workspace_write");
  assert.equal(ctx.activeDelegations.length, 1);
  assert.equal(ctx.permissions.constraints.maxDurationMs, 30000);
});

test("PermissionSet structure", () => {
  const perms: PermissionSet = {
    resources: ["res-a", "res-b"],
    actions: ["read", "write"],
    constraints: {
      maxDurationMs: 60000,
      maxTokens: 4000,
      allowedDomains: ["domain-1"],
      deniedDomains: ["domain-2"],
    },
  };
  assert.equal(perms.resources.length, 2);
  assert.equal(perms.constraints.maxDurationMs, 60000);
  assert.ok(perms.constraints.allowedDomains?.includes("domain-1"));
});

test("PermissionConstraints allows optional fields", () => {
  const constraints: PermissionConstraints = {};
  assert.equal(constraints.maxDurationMs, undefined);
  assert.equal(constraints.maxTokens, undefined);
});

test("ToolSchemaProperty types", () => {
  const prop: ToolSchemaProperty = {
    type: "string",
    description: "A test property",
    minLength: 1,
    enum: ["value1", "value2"],
  };
  assert.equal(prop.type, "string");
  assert.deepEqual(prop.enum, ["value1", "value2"]);
});

test("ToolSchemaProperty with array items", () => {
  const prop: ToolSchemaProperty = {
    type: "array",
    items: { type: "string" },
  };
  assert.equal(prop.type, "array");
  assert.equal(prop.items?.type, "string");
});

test("ToolSchema structure", () => {
  const schema: ToolSchema = {
    type: "object",
    properties: {
      name: { type: "string", description: "The name" },
      age: { type: "number", description: "The age" },
    },
    required: ["name"],
    additionalProperties: false,
    description: "Person schema",
  };
  assert.equal(schema.type, "object");
  assert.ok(schema.properties !== undefined);
  assert.equal(schema.properties.name.type, "string");
  assert.equal(schema.required?.length, 1);
});

test("DelegationSpec structure", () => {
  const spec: DelegationSpec = {
    targetAgentId: "target-agent",
    targetAgentType: "worker",
    targetPackId: "pack-001",
    requiredPermissions: {
      resources: ["res-1"],
      actions: ["action-1"],
      constraints: {},
    },
    timeout: 5000,
    inputSchema: { type: "object", properties: {} },
    outputSchema: { type: "object", properties: {} },
  };
  assert.equal(spec.targetAgentId, "target-agent");
  assert.equal(spec.timeout, 5000);
});

test("DelegationSpec with pipeline mode", () => {
  const spec: DelegationSpec = {
    targetAgentId: "pipeline-agent",
    targetAgentType: "pipeline",
    targetPackId: "pack-001",
    requiredPermissions: { resources: [], actions: [], constraints: {} },
    timeout: 10000,
    collaborationMode: "pipeline",
    pipelineStages: [
      { stageId: "stage-1", agentId: "agent-1", agentType: "type-1" },
      { stageId: "stage-2", agentId: "agent-2", agentType: "type-2" },
    ],
  };
  assert.equal(spec.collaborationMode, "pipeline");
  assert.equal(spec.pipelineStages?.length, 2);
});

test("DelegationSpec with negotiation mode", () => {
  const spec: DelegationSpec = {
    targetAgentId: "negotiation-agent",
    targetAgentType: "negotiator",
    targetPackId: "pack-001",
    requiredPermissions: { resources: [], actions: [], constraints: {} },
    timeout: 15000,
    collaborationMode: "negotiation",
    negotiationRounds: 5,
    negotiationSelectionPolicy: "consensus",
  };
  assert.equal(spec.collaborationMode, "negotiation");
  assert.equal(spec.negotiationRounds, 5);
  assert.equal(spec.negotiationSelectionPolicy, "consensus");
});

test("PipelineStageDefinition structure", () => {
  const stage: PipelineStageDefinition = {
    stageId: "stage-001",
    agentId: "agent-001",
    agentType: "worker",
  };
  assert.equal(stage.stageId, "stage-001");
  assert.equal(stage.inputTransform, undefined);
});

test("DelegationResult structure", () => {
  const result: DelegationResult = {
    delegationId: "del-result-001",
    parentAgentId: "parent-001",
    childAgentId: "child-001",
    depth: 1,
    permissions: { resources: [], actions: [], constraints: {} },
    createdAt: "2026-04-26T00:00:00.000Z",
    expiresAt: "2026-04-26T00:01:00.000Z",
    status: "active",
  };
  assert.equal(result.delegationId, "del-result-001");
  assert.equal(result.status, "active");
  assert.equal(result.depth, 1);
});

test("DelegationStatus accepts all valid values", () => {
  const statuses: DelegationStatus[] = ["pending", "active", "completed", "failed", "cancelled", "expired"];
  assert.equal(statuses.length, 6);
});

test("DelegationHandle structure", () => {
  const handle: DelegationHandle = {
    delegationId: "handle-001",
    parentAgentId: "parent-001",
    childAgentId: "child-001",
    depth: 0,
    status: "pending",
    createdAt: "2026-04-26T00:00:00.000Z",
    timeout: 30000,
    correlationId: "corr-handle",
  };
  assert.equal(handle.status, "pending");
  assert.equal(handle.timeout, 30000);
});

test("DelegationChainNode structure", () => {
  const node: DelegationChainNode = {
    delegationId: "chain-node-001",
    agentId: "node-agent",
    packId: "pack-001",
    agentType: "worker",
    depth: 2,
    createdAt: "2026-04-26T00:00:00.000Z",
    parentDelegationId: "parent-del",
  };
  assert.equal(node.packId, "pack-001");
  assert.equal(node.depth, 2);
  assert.ok(node.parentDelegationId !== null);
});

test("DelegationChain structure", () => {
  const chain: DelegationChain = {
    rootAgentId: "root-agent",
    nodes: [
      { delegationId: "d1", agentId: "a1", agentType: "type1", depth: 0, createdAt: "2026-04-26T00:00:00.000Z", parentDelegationId: null },
      { delegationId: "d2", agentId: "a2", agentType: "type2", depth: 1, createdAt: "2026-04-26T00:00:01.000Z", parentDelegationId: "d1" },
    ],
    maxDepthReached: 1,
    totalDelegations: 2,
  };
  assert.equal(chain.rootAgentId, "root-agent");
  assert.equal(chain.nodes.length, 2);
  assert.equal(chain.maxDepthReached, 1);
});

test("DelegationOptions with all optional fields", () => {
  const opts: DelegationOptions = {
    maxDepth: 5,
    maxFanout: 10,
    allowedPackIds: ["pack-a", "pack-b"],
    defaultTimeout: 30000,
  };
  assert.equal(opts.maxDepth, 5);
  assert.equal(opts.maxFanout, 10);
  assert.equal(opts.allowedPackIds?.length, 2);
  assert.equal(opts.defaultTimeout, 30000);
});

test("DelegationOptions with minimal fields", () => {
  const opts: DelegationOptions = {};
  assert.equal(opts.maxDepth, undefined);
  assert.equal(opts.maxFanout, undefined);
});

test("DelegationChainNode without packId", () => {
  const node: DelegationChainNode = {
    delegationId: "node-no-pack",
    agentId: "agent-no-pack",
    agentType: "worker",
    depth: 0,
    createdAt: "2026-04-26T00:00:00.000Z",
    parentDelegationId: null,
  };
  assert.equal(node.packId, undefined);
});
