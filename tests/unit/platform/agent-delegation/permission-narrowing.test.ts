/**
 * Unit tests for Permission Narrowing
 *
 * Tests that permissions are properly narrowed via intersection per §19.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createDelegationManager } from "../../../../src/platform/agent-delegation/index.js";
import type { AgentContext, DelegationSpec, PermissionSet } from "../../../../src/platform/agent-delegation/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createParentContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    agentId: "parent-agent",
    agentType: "coordinator",
    packId: "pack-parent",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["resource-a", "resource-b", "resource-c"],
      actions: ["action-read", "action-write", "action-delete"],
      constraints: {
        maxDurationMs: 60000,
        maxTokens: 10000,
        allowedDomains: ["domain-a.com", "domain-b.com"],
        deniedDomains: ["evil.com"],
      },
    },
    sandboxTier: "workspace_write",
    correlationId: "test-correlation",
    tenantId: "tenant-1",
    ...overrides,
  };
}

function createDelegationSpec(overrides: Partial<DelegationSpec> = {}): DelegationSpec {
  return {
    targetAgentId: "child-agent",
    targetAgentType: "worker",
    targetPackId: "pack-child",
    requiredPermissions: {
      resources: ["resource-a", "resource-b"],
      actions: ["action-read", "action-write"],
      constraints: {},
    },
    timeout: 30000,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Permission Narrowing Tests
// ─────────────────────────────────────────────────────────────────────────────

test("delegation narrows permissions via intersection of resources", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  // Parent has: resource-a, resource-b, resource-c
  // Child requests: resource-a, resource-b
  // Child gets: resource-a, resource-b (intersection)

  const handle = await service.delegate(parent, spec);
  const delegation = await service.getDelegation(handle.delegationId);

  assert.ok(delegation);
  assert.deepEqual(delegation.permissions.resources, ["resource-a", "resource-b"]);
});

test("delegation narrows permissions via intersection of actions", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec();

  // Parent has: action-read, action-write, action-delete
  // Child requests: action-read, action-write
  // Child gets: action-read, action-write (intersection)

  const handle = await service.delegate(parent, spec);
  const delegation = await service.getDelegation(handle.delegationId);

  assert.ok(delegation);
  assert.deepEqual(delegation.permissions.actions, ["action-read", "action-write"]);
});

test("delegation uses parent actions when child requests empty actions", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec({
    requiredPermissions: {
      resources: ["resource-a"],
      actions: [], // Empty actions = inherit all parent actions
      constraints: {},
    },
  });

  const handle = await service.delegate(parent, spec);
  const delegation = await service.getDelegation(handle.delegationId);

  assert.ok(delegation);
  // Empty child actions means inherit all parent actions
  assert.deepEqual(delegation.permissions.actions, ["action-read", "action-write", "action-delete"]);
});

test("delegation takes more restrictive maxDurationMs constraint", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({
    permissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {
        maxDurationMs: 60000,
      },
    },
  });
  const spec = createDelegationSpec({
    requiredPermissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {
        maxDurationMs: 30000, // More restrictive
      },
    },
  });

  const handle = await service.delegate(parent, spec);
  const delegation = await service.getDelegation(handle.delegationId);

  assert.ok(delegation);
  assert.equal(delegation.permissions.constraints.maxDurationMs, 30000);
});

test("delegation takes more restrictive maxTokens constraint", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({
    permissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {
        maxTokens: 10000,
      },
    },
  });
  const spec = createDelegationSpec({
    requiredPermissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {
        maxTokens: 5000, // More restrictive
      },
    },
  });

  const handle = await service.delegate(parent, spec);
  const delegation = await service.getDelegation(handle.delegationId);

  assert.ok(delegation);
  assert.equal(delegation.permissions.constraints.maxTokens, 5000);
});

test("delegation child cannot request resources parent does not have", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({
    permissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {},
    },
  });
  const spec = createDelegationSpec({
    requiredPermissions: {
      resources: ["resource-a", "resource-b"], // resource-b not in parent
      actions: ["action-read"],
      constraints: {},
    },
  });

  const handle = await service.delegate(parent, spec);
  const delegation = await service.getDelegation(handle.delegationId);

  assert.ok(delegation);
  // Only intersection - resource-b should be filtered out
  assert.deepEqual(delegation.permissions.resources, ["resource-a"]);
});

test("delegation child cannot request actions parent does not have", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({
    permissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {},
    },
  });
  const spec = createDelegationSpec({
    requiredPermissions: {
      resources: ["resource-a"],
      actions: ["action-read", "action-delete"], // action-delete not in parent
      constraints: {},
    },
  });

  const handle = await service.delegate(parent, spec);
  const delegation = await service.getDelegation(handle.delegationId);

  assert.ok(delegation);
  // Only intersection
  assert.deepEqual(delegation.permissions.actions, ["action-read"]);
});

test("delegation allowedDomains narrows to the parent-child intersection", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({
    permissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {
        allowedDomains: ["domain-a.com", "domain-b.com"],
      },
    },
  });
  const spec = createDelegationSpec({
    requiredPermissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {
        allowedDomains: ["domain-b.com", "domain-c.com"],
      },
    },
  });

  const handle = await service.delegate(parent, spec);
  const delegation = await service.getDelegation(handle.delegationId);

  assert.ok(delegation);
  // Domain constraints are narrowed to the overlap the parent already allows.
  assert.deepEqual(delegation.permissions.constraints.allowedDomains, ["domain-b.com"]);
});

test("delegation keeps actions but not resources when no specific resources are requested", async () => {
  const service = createDelegationManager();
  const parent = createParentContext();
  const spec = createDelegationSpec({
    requiredPermissions: {
      resources: [],
      actions: [],
      constraints: {},
    },
  });

  const handle = await service.delegate(parent, spec);
  const delegation = await service.getDelegation(handle.delegationId);

  assert.ok(delegation);
  // R17-01 fix: When requiredPermissions is empty, child inherits parent's full set
  assert.deepEqual(delegation.permissions.resources, ["resource-a", "resource-b", "resource-c"]);
  assert.deepEqual(delegation.permissions.actions, ["action-read", "action-write", "action-delete"]);
});

test("delegation denies permissions when child requests no overlap", async () => {
  const service = createDelegationManager();
  const parent = createParentContext({
    permissions: {
      resources: ["resource-a"],
      actions: ["action-read"],
      constraints: {},
    },
  });
  const spec = createDelegationSpec({
    requiredPermissions: {
      resources: ["resource-x"], // No overlap
      actions: ["action-write"],
      constraints: {},
    },
  });

  const handle = await service.delegate(parent, spec);
  const delegation = await service.getDelegation(handle.delegationId);

  assert.ok(delegation);
  // No intersection = empty permissions
  assert.deepEqual(delegation.permissions.resources, []);
  assert.deepEqual(delegation.permissions.actions, []);
});
