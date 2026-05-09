/**
 * Context Isolator Unit Tests
 *
 * Tests narrowPermissions behavior per R9-07 security fix:
 * narrowPermissions must use set intersection, NOT replacement.
 *
 * @see src/platform/five-plane-orchestration/agent-delegation/context-isolator.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  ContextIsolator,
  IsolationLevel,
} from "../../../../../src/platform/five-plane-orchestration/agent-delegation/context-isolator.js";
import type {
  AgentContext,
  DelegationSpec,
  PermissionSet,
} from "../../../../../src/platform/five-plane-orchestration/agent-delegation/delegation-types.js";

function createParentContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    agentId: "parent-agent",
    agentType: "orchestrator",
    packId: "pack-1",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["resource-a", "resource-b", "resource-c"],
      actions: ["action-read", "action-write", "action-delete"],
      constraints: {
        maxDurationMs: 120000,
        maxTokens: 10000,
        allowedDomains: ["domain-a", "domain-b"],
      },
    },
    sandboxTier: "read_only",
    correlationId: "corr-1",
    tenantId: "tenant-1",
    ...overrides,
  };
}

function createDelegationSpec(overrides: Partial<DelegationSpec> = {}): DelegationSpec {
  return {
    targetAgentId: "child-agent",
    targetAgentType: "worker",
    targetPackId: "pack-1",
    requiredPermissions: {
      resources: [],
      actions: [],
      constraints: {},
    },
    timeout: 30000,
    ...overrides,
  };
}

// R9-07 fix verification: narrowPermissionsInternal with MINIMAL uses intersection
test("narrowPermissionsInternal MINIMAL level uses intersection not replacement", () => {
  const isolator = new ContextIsolator();

  const parentPermissions: PermissionSet = {
    resources: ["resource-a", "resource-b", "resource-c"],
    actions: ["action-read", "action-write", "action-delete"],
    constraints: { maxDurationMs: 120000 },
  };

  const requiredPermissions: PermissionSet = {
    resources: ["resource-b"],
    actions: ["action-write"],
    constraints: { maxDurationMs: 60000 },
  };

  const result = isolator.mergePermissions(parentPermissions, requiredPermissions);

  // Intersection should give child only what parent has AND child requests
  assert.deepEqual(result.resources, ["resource-b"], "Resource should be intersection");
  assert.deepEqual(result.actions, ["action-write"], "Action should be intersection");
});

// R9-07 fix verification: Child can only get permissions that parent has (subset rule)
test("child agent can only get permissions that parent has - resources subset rule", () => {
  const parent = createParentContext({
    permissions: {
      resources: ["resource-a", "resource-b", "resource-c"],
      actions: ["action-read", "action-write"],
      constraints: { maxDurationMs: 120000 },
    },
  });

  const spec = createDelegationSpec({
    requiredPermissions: {
      resources: ["resource-b", "resource-d"], // D is not in parent
      actions: ["action-read"],
      constraints: {},
    },
  });

  const isolator = new ContextIsolator();
  const result = isolator.validatePermissionRequest(parent.permissions, spec.requiredPermissions);

  // Should fail because resource-d is not in parent
  assert.equal(result, false, "Should reject permission request for resources parent does not have");
});

// R9-07 fix verification: Intersection correctly filters resources
test("intersection correctly filters resources - parent has A,B,C child requests B,D", () => {
  const parent: PermissionSet = {
    resources: ["resource-a", "resource-b", "resource-c"],
    actions: ["action-read"],
    constraints: {},
  };

  const child: PermissionSet = {
    resources: ["resource-b", "resource-d"], // D is not in parent
    actions: ["action-read"],
    constraints: {},
  };

  const isolator = new ContextIsolator();
  const result = isolator.mergePermissions(parent, child);

  assert.deepEqual(
    result.resources,
    ["resource-b"],
    "Only B should remain since D is not in parent",
  );
});

// R9-07 fix verification: Intersection correctly filters actions
test("intersection correctly filters actions", () => {
  const parent: PermissionSet = {
    resources: ["resource-a"],
    actions: ["action-read", "action-write", "action-delete"],
    constraints: {},
  };

  const child: PermissionSet = {
    resources: ["resource-a"],
    actions: ["action-write", "action-execute"], // execute is not in parent
    constraints: {},
  };

  const isolator = new ContextIsolator();
  const result = isolator.mergePermissions(parent, child);

  assert.deepEqual(
    result.actions,
    ["action-write"],
    "Only action-write should remain since action-execute is not in parent",
  );
});

// R9-07 fix verification: SANDBOXED level uses proper intersection
test("SANDBOXED level uses proper intersection for resources and actions", () => {
  const parentPermissions: PermissionSet = {
    resources: ["resource-a", "resource-b", "resource-c"],
    actions: ["action-read", "action-write", "action-delete"],
    constraints: { maxDurationMs: 120000 },
  };

  const requiredPermissions: PermissionSet = {
    resources: ["resource-b", "resource-c"],
    actions: ["action-read", "action-write"],
    constraints: { maxDurationMs: 30000 },
  };

  const isolator = new ContextIsolator();
  const result = isolator.mergePermissions(parentPermissions, requiredPermissions);

  assert.deepEqual(result.resources, ["resource-b", "resource-c"], "SANDBOXED should intersect resources");
  assert.deepEqual(result.actions, ["action-read", "action-write"], "SANDBOXED should intersect actions");
});

// R9-07 fix verification: PARTIAL level uses proper intersection
test("PARTIAL level uses proper intersection for resources and actions", () => {
  const parentPermissions: PermissionSet = {
    resources: ["resource-a", "resource-b", "resource-c"],
    actions: ["action-read", "action-write", "action-delete"],
    constraints: { maxDurationMs: 120000 },
  };

  const requiredPermissions: PermissionSet = {
    resources: ["resource-a"],
    actions: ["action-delete"],
    constraints: { maxDurationMs: 60000 },
  };

  const isolator = new ContextIsolator();
  const result = isolator.mergePermissions(parentPermissions, requiredPermissions);

  assert.deepEqual(result.resources, ["resource-a"], "PARTIAL should intersect resources");
  assert.deepEqual(result.actions, ["action-delete"], "PARTIAL should intersect actions");
});

// R9-07 fix verification: Constraints are properly merged (maxDurationMs takes minimum)
test("constraints are properly merged - maxDurationMs takes minimum", () => {
  const parent: PermissionSet = {
    resources: ["resource-a"],
    actions: ["action-read"],
    constraints: { maxDurationMs: 120000, maxTokens: 20000 },
  };

  const child: PermissionSet = {
    resources: ["resource-a"],
    actions: ["action-read"],
    constraints: { maxDurationMs: 60000, maxTokens: 10000 },
  };

  const isolator = new ContextIsolator();
  const result = isolator.mergePermissions(parent, child);

  assert.equal(result.constraints.maxDurationMs, 60000, "maxDurationMs should be minimum");
  assert.equal(result.constraints.maxTokens, 10000, "maxTokens should be minimum");
});

// R9-07 fix verification: IsolationLevel.MINIMAL returns intersection for FULL permission ratio
test("MINIMAL isolation level returns intersection when required matches MINIMAL criteria", () => {
  const parent = createParentContext({
    sandboxTier: "read_only", // Will not trigger SANDBOXED level
    permissions: {
      resources: ["resource-a", "resource-b", "resource-c", "resource-d", "resource-e"],
      actions: ["action-read", "action-write", "action-delete", "action-list", "action-create"],
      constraints: { maxDurationMs: 120000 },
    },
  });

  // Request only 1 action out of 5 (20% ratio, triggers MINIMAL)
  const spec = createDelegationSpec({
    requiredPermissions: {
      resources: ["resource-a", "resource-b"],
      actions: ["action-read"],
      constraints: { maxDurationMs: 60000 },
    },
  });

  const isolator = new ContextIsolator();
  const isolated = isolator.isolate(parent, spec);

  // With MINIMAL level, child should only get explicitly requested permissions
  // that are also in parent (intersection)
  assert.equal(isolated.isolationLevel, IsolationLevel.MINIMAL);
  assert.deepEqual(
    isolated.narrowedPermissions.actions,
    ["action-read"],
    "MINIMAL should return only requested actions that parent has",
  );
  assert.deepEqual(
    isolated.narrowedPermissions.resources,
    ["resource-a", "resource-b"],
    "MINIMAL should return only requested resources that parent has",
  );
});

// R9-07 fix verification: validatePermissionRequest enforces subset rule
test("validatePermissionRequest enforces that child cannot request permissions beyond parent", () => {
  const parent: PermissionSet = {
    resources: ["resource-a", "resource-b"],
    actions: ["action-read", "action-write"],
    constraints: { allowedDomains: ["domain-a"] },
  };

  const isolator = new ContextIsolator();

  // Valid request - all requested items are in parent
  const validRequest: PermissionSet = {
    resources: ["resource-a"],
    actions: ["action-read"],
    constraints: { allowedDomains: ["domain-a"] },
  };
  assert.equal(isolator.validatePermissionRequest(parent, validRequest), true);

  // Invalid request - resource not in parent
  const invalidResourceRequest: PermissionSet = {
    resources: ["resource-c"], // Not in parent
    actions: ["action-read"],
    constraints: {},
  };
  assert.equal(isolator.validatePermissionRequest(parent, invalidResourceRequest), false);

  // Invalid request - action not in parent
  const invalidActionRequest: PermissionSet = {
    resources: ["resource-a"],
    actions: ["action-delete"], // Not in parent
    constraints: {},
  };
  assert.equal(isolator.validatePermissionRequest(parent, invalidActionRequest), false);

  // Invalid request - domain not in parent
  const invalidDomainRequest: PermissionSet = {
    resources: ["resource-a"],
    actions: ["action-read"],
    constraints: { allowedDomains: ["domain-b"] }, // Not in parent
  };
  assert.equal(isolator.validatePermissionRequest(parent, invalidDomainRequest), false);
});

// R9-07 fix verification: Merge permissions takes minimum for numeric constraints
test("mergePermissions takes minimum for maxDurationMs when child has no constraint", () => {
  const parent: PermissionSet = {
    resources: ["resource-a"],
    actions: ["action-read"],
    constraints: { maxDurationMs: 120000 },
  };

  const child: PermissionSet = {
    resources: ["resource-a"],
    actions: ["action-read"],
    constraints: {}, // No maxDurationMs
  };

  const isolator = new ContextIsolator();
  const result = isolator.mergePermissions(parent, child);

  assert.equal(result.constraints.maxDurationMs, 120000, "Should use parent maxDurationMs when child has none");
});

// R9-07 fix verification: Empty required permissions returns empty intersection
test("empty required permissions returns empty intersection", () => {
  const parent: PermissionSet = {
    resources: ["resource-a", "resource-b"],
    actions: ["action-read", "action-write"],
    constraints: {},
  };

  const child: PermissionSet = {
    resources: [],
    actions: [],
    constraints: {},
  };

  const isolator = new ContextIsolator();
  const result = isolator.mergePermissions(parent, child);

  assert.deepEqual(result.resources, [], "Should return empty resources when child requests none");
  assert.deepEqual(result.actions, [], "Should return empty actions when child requests none");
});

// R9-07 fix verification: Full isolation level returns parent permissions unchanged
test("FULL isolation level returns parent permissions unchanged", () => {
  const parent = createParentContext({
    permissions: {
      resources: ["resource-a", "resource-b"],
      actions: ["action-read", "action-write"],
      constraints: { maxDurationMs: 120000 },
    },
  });

  // Request 90%+ of parent actions to trigger FULL level
  const spec = createDelegationSpec({
    requiredPermissions: {
      resources: ["resource-a", "resource-b"],
      actions: ["action-read", "action-write"], // 2/2 = 100% triggers FULL
      constraints: {},
    },
  });

  const isolator = new ContextIsolator();
  const isolated = isolator.isolate(parent, spec);

  assert.equal(isolated.isolationLevel, IsolationLevel.FULL);
  assert.deepEqual(isolated.narrowedPermissions.resources, parent.permissions.resources);
  assert.deepEqual(isolated.narrowedPermissions.actions, parent.permissions.actions);
});

// R26-05 fix: denied domains should use union, not intersection
test("R26-05: mergeDomainLists uses union for denied domains (not intersection)", () => {
  const parent: PermissionSet = {
    resources: ["resource-a"],
    actions: ["action-read"],
    constraints: {
      allowedDomains: ["domain-a", "domain-b"],
      deniedDomains: ["denied-parent-1", "denied-parent-2"],
    },
  };

  const child: PermissionSet = {
    resources: ["resource-a"],
    actions: ["action-read"],
    constraints: {
      allowedDomains: ["domain-a"], // child wants to narrow allowed
      deniedDomains: ["denied-child-1", "denied-parent-2"], // child adds its own denied
    },
  };

  const isolator = new ContextIsolator();
  const result = isolator.mergePermissions(parent, child);

  // Denied domains should be the UNION of parent and child denied domains
  // This ensures denied domains are never discarded - any domain denied by either is denied
  assert.ok(result.constraints.deniedDomains != null, "Should have denied domains");
  const denied = result.constraints.deniedDomains as readonly string[];
  assert.ok(denied.includes("denied-parent-1"), "Should include parent's denied domain");
  assert.ok(denied.includes("denied-parent-2"), "Should include parent's denied domain");
  assert.ok(denied.includes("denied-child-1"), "Should include child's denied domain");
  assert.equal(denied.length, 3, "Should be union of both denied domain lists");
});

// R26-05 fix: allowed domains should still use intersection
test("R26-05: mergeDomainLists uses intersection for allowed domains", () => {
  const parent: PermissionSet = {
    resources: ["resource-a"],
    actions: ["action-read"],
    constraints: {
      allowedDomains: ["domain-a", "domain-b", "domain-c"],
    },
  };

  const child: PermissionSet = {
    resources: ["resource-a"],
    actions: ["action-read"],
    constraints: {
      allowedDomains: ["domain-b", "domain-c", "domain-d"], // d is not in parent
    },
  };

  const isolator = new ContextIsolator();
  const result = isolator.mergePermissions(parent, child);

  // Allowed domains should be intersection
  const allowed = result.constraints.allowedDomains as readonly string[];
  assert.deepEqual(allowed, ["domain-b", "domain-c"], "Should be intersection");
  assert.ok(!allowed.includes("domain-a"), "Should not include domain-a (only in parent)");
  assert.ok(!allowed.includes("domain-d"), "Should not include domain-d (only in child)");
});
