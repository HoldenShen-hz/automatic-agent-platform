/**
 * Integration Test: Delegation Flow
 *
 * Tests the complete delegation flow from creation through
 * completion, including the delegation manager and governance.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import {
  DelegationManagerService,
  createDelegationManager,
  ContextIsolator,
  DelegationGovernanceService,
  type AgentContext,
  type DelegationSpec,
  type DelegationHandle,
} from "../../../../../src/platform/five-plane-orchestration/agent-delegation/index.js";

function createTestContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    agentId: "parent_test",
    agentType: "agent",
    packId: "pack_parent",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["/workspace", "/code"],
      actions: ["read", "write", "execute"],
      constraints: { maxDurationMs: 300000, maxTokens: 8000 },
    },
    sandboxTier: "container",
    correlationId: "corr_flow_test",
    tenantId: "tenant_flow",
    ...overrides,
  };
}

function createTestSpec(overrides: Partial<DelegationSpec> = {}): DelegationSpec {
  return {
    targetAgentId: "child_test",
    targetAgentType: "agent",
    targetPackId: "pack_child",
    requiredPermissions: {
      resources: ["/workspace"],
      actions: ["read", "write"],
      constraints: {},
    },
    timeout: 60000,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2183: Eviction should not evict active delegation
// ─────────────────────────────────────────────────────────────────────────────

test("DelegationManager handles full delegation lifecycle", async () => {
  const ctx = createIntegrationContext("aa-dlg-lifecycle-");
  try {
    const service = createDelegationManager();
    const parent = createTestContext();
    const spec = createTestSpec();

    // Create delegation
    const handle = service.delegate(parent, spec);
    assert.ok(handle.delegationId.startsWith("dlg_"));
    assert.equal(handle.status, "pending");

    // Get delegation and verify state
    const delegation = service.getDelegation(handle.delegationId);
    assert.ok(delegation !== null);
    assert.equal(delegation.parentAgentId, "parent_test");
    assert.equal(delegation.childAgentId, "child_test");
    assert.equal(delegation.status, "pending");

    // Complete delegation
    service.complete(handle.delegationId);
    const completed = service.getDelegation(handle.delegationId);
    assert.equal(completed!.status, "completed");
    assert.ok(completed!.completedAt !== undefined);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager delegation chain tracking", async () => {
  const ctx = createIntegrationContext("aa-dlg-chain-track-");
  try {
    const service = createDelegationManager();

    // Create first-level delegation
    const parent1 = createTestContext({ agentId: "root" });
    const spec1 = createTestSpec({ targetAgentId: "level1" });
    const handle1 = service.delegate(parent1, spec1);

    // Create second-level delegation
    const parent2 = createTestContext({
      agentId: "level1",
      delegationDepth: 1,
      activeDelegations: [handle1.delegationId],
    });
    const spec2 = createTestSpec({ targetAgentId: "level2" });
    const handle2 = service.delegate(parent2, spec2);

    // Verify chain for root
    const chain = service.getDelegationChain("root");
    assert.ok(chain !== null);
    assert.equal(chain!.rootAgentId, "root");
    assert.ok(chain!.nodes.length >= 1);

    // Verify depths
    assert.equal(handle1.depth, 1);
    assert.equal(handle2.depth, 2);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager cancel flow", async () => {
  const ctx = createIntegrationContext("aa-dlg-cancel-flow-");
  try {
    const service = createDelegationManager();
    const parent = createTestContext();
    const spec = createTestSpec();

    const handle = service.delegate(parent, spec);
    service.cancel(handle.delegationId);

    const delegation = service.getDelegation(handle.delegationId);
    assert.equal(delegation!.status, "cancelled");
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager fail flow", async () => {
  const ctx = createIntegrationContext("aa-dlg-fail-flow-");
  try {
    const service = createDelegationManager();
    const parent = createTestContext();
    const spec = createTestSpec();

    const handle = service.delegate(parent, spec);
    service.fail(handle.delegationId, "Test failure");

    const delegation = service.getDelegation(handle.delegationId);
    assert.equal(delegation!.status, "failed");
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager timeout handling", async () => {
  const ctx = createIntegrationContext("aa-dlg-timeout-");
  try {
    const service = createDelegationManager();
    const parent = createTestContext();
    const spec = createTestSpec();

    const handle = service.delegate(parent, spec);
    service.handleDelegationTimeout(handle.delegationId);

    const delegation = service.getDelegation(handle.delegationId);
    assert.equal(delegation!.status, "timed_out");
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager active delegations filtering", async () => {
  const ctx = createIntegrationContext("aa-dlg-active-filter-");
  try {
    const service = createDelegationManager();
    const parent = createTestContext({ agentId: "parent_active" });

    // Create multiple delegations
    service.delegate(parent, createTestSpec({ targetAgentId: "child1" }));
    service.delegate(parent, createTestSpec({ targetAgentId: "child2" }));

    const active = service.getActiveDelegations("parent_active");
    assert.equal(active.length, 2);
    assert.ok(active.every((d) => d.status === "pending"));
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager getExpiredDelegations for TTL testing", async () => {
  const ctx = createIntegrationContext("aa-dlg-expired-ttl-");
  try {
    const service = createDelegationManager();
    const parent = createTestContext();
    const spec = createTestSpec();

    const handle = service.delegate(parent, spec);

    // Manually expire the delegation
    const delegation = service.getDelegation(handle.delegationId);
    if (delegation) {
      delegation.expiresAt = new Date(Date.now() - 10000).toISOString();
    }

    const expired = service.getExpiredDelegations();
    assert.ok(expired.length >= 1);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager revokeExpiredDelegations scanning", async () => {
  const ctx = createIntegrationContext("aa-dlg-revoke-");
  try {
    const service = createDelegationManager();

    // Create and manually expire delegations
    const parent = createTestContext();
    const spec = createTestSpec();

    const handle = service.delegate(parent, spec);
    const delegation = service.getDelegation(handle.delegationId);
    if (delegation) {
      delegation.expiresAt = new Date(Date.now() - 10000).toISOString();
    }

    const result = service.revokeExpiredDelegations();
    assert.ok(result.scanned >= 1);
    assert.ok(result.expired >= 1);
    assert.ok(Array.isArray(result.errors));
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager requiresApproval sets correct initial status", async () => {
  const ctx = createIntegrationContext("aa-dlg-requires-approval-");
  try {
    const service = createDelegationManager();
    const parent = createTestContext();
    const spec = createTestSpec({ requiresApproval: true });

    const handle = service.delegate(parent, spec);
    assert.equal(handle.status, "pending_approval");
    assert.equal(handle.requiresApproval, true);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager completeWithEvidence validates ACP", async () => {
  const ctx = createIntegrationContext("aa-dlg-evidence-acp-");
  try {
    const service = createDelegationManager();
    const parent = createTestContext();
    const spec = createTestSpec();

    const handle = service.delegate(parent, spec);

    // Complete with evidence should validate via ACP protocol
    await service.completeWithEvidence(handle.delegationId, ["evidence-1"], "output-ref");

    const delegation = service.getDelegation(handle.delegationId);
    assert.equal(delegation!.status, "completed");
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager context creation after delegation", async () => {
  const ctx = createIntegrationContext("aa-dlg-context-");
  try {
    const service = createDelegationManager();
    const parent = createTestContext();
    const spec = createTestSpec();

    const handle = service.delegate(parent, spec);
    const context = service.createDelegationContext(handle.delegationId);

    assert.equal(context.agentId, "child_test");
    assert.equal(context.delegationDepth, 1);
    assert.ok(Array.isArray(context.activeDelegations));
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager getPendingExpirationCount returns count", async () => {
  const ctx = createIntegrationContext("aa-dlg-pending-count-");
  try {
    const service = createDelegationManager();
    const parent = createTestContext();
    const spec = createTestSpec();

    service.delegate(parent, spec);

    const count = service.getPendingExpirationCount();
    assert.equal(typeof count, "number");
    assert.ok(count >= 0);
  } finally {
    ctx.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ContextIsolator Integration with DelegationManager
// ─────────────────────────────────────────────────────────────────────────────

test("ContextIsolator works with delegation workflow", async () => {
  const ctx = createIntegrationContext("aa-isolator-workflow-");
  try {
    const isolator = new ContextIsolator();
    const parent = createTestContext();
    const spec = createTestSpec();

    const result = isolator.isolate(parent, spec);

    assert.equal(result.context.agentId, "child_test");
    assert.equal(result.context.delegationDepth, 1);
    assert.ok(result.isolationLevel !== undefined);
  } finally {
    ctx.cleanup();
  }
});

test("ContextIsolator validates permission requests correctly", async () => {
  const ctx = createIntegrationContext("aa-isolator-perms-");
  try {
    const isolator = new ContextIsolator();
    const parent: AgentContext = createTestContext();

    // Valid request
    const valid = isolator.validatePermissionRequest(
      parent.permissions,
      { resources: ["/workspace"], actions: ["read"], constraints: {} },
    );
    assert.equal(valid, true);

    // Invalid request - action not allowed
    const invalid = isolator.validatePermissionRequest(
      parent.permissions,
      { resources: ["/workspace"], actions: ["delete"], constraints: {} },
    );
    assert.equal(invalid, false);
  } finally {
    ctx.cleanup();
  }
});

test("ContextIsolator mergePermissions takes restrictive values", async () => {
  const ctx = createIntegrationContext("aa-isolator-merge-");
  try {
    const isolator = new ContextIsolator();
    const base = createTestContext().permissions;
    const override = {
      resources: [],
      actions: [],
      constraints: { maxTokens: 1000 },
    };

    const merged = isolator.mergePermissions(base, override);

    assert.deepEqual(merged.resources, base.resources);
    assert.deepEqual(merged.actions, base.actions);
    assert.equal(merged.constraints.maxTokens, 1000);
  } finally {
    ctx.cleanup();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Governance Integration with DelegationManager
// ─────────────────────────────────────────────────────────────────────────────

test("GovernanceService evaluates delegation requests", async () => {
  const ctx = createIntegrationContext("aa-governance-eval-");
  try {
    const governance = new DelegationGovernanceService();
    const request = {
      parentContext: createTestContext(),
      delegationSpec: createTestSpec(),
      riskLevel: "low" as const,
    };

    const decision = governance.evaluate(request);
    assert.equal(decision.decision, "allow");
    assert.equal(decision.requiresApproval, false);
  } finally {
    ctx.cleanup();
  }
});

test("GovernanceService blocks critical risk delegations", async () => {
  const ctx = createIntegrationContext("aa-governance-critical-");
  try {
    const governance = new DelegationGovernanceService();
    const request = {
      parentContext: createTestContext(),
      delegationSpec: createTestSpec(),
      riskLevel: "critical" as const,
    };

    const decision = governance.evaluate(request);
    assert.equal(decision.decision, "deny");
    assert.equal(decision.reasonCode, "delegation.critical_risk_denied");
  } finally {
    ctx.cleanup();
  }
});

test("GovernanceService audit trail records decisions", async () => {
  const ctx = createIntegrationContext("aa-governance-audit-");
  try {
    const governance = new DelegationGovernanceService();
    const request = {
      parentContext: createTestContext(),
      delegationSpec: createTestSpec(),
      riskLevel: "low" as const,
    };

    const decision = governance.evaluate(request);
    governance.recordDecision(request, decision, "admin");

    const records = governance.getAuditRecords();
    assert.ok(records.length >= 1);
    assert.equal(records[0]!.approvedBy, "admin");
  } finally {
    ctx.cleanup();
  }
});