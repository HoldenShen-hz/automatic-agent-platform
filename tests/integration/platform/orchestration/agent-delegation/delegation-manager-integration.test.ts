/**
 * Integration Test: Delegation Manager Service
 *
 * Tests the DelegationManagerService which manages agent delegation including:
 * - Delegation creation with topology validation
 * - Permission narrowing
 * - Delegation chain tracking
 * - TTL-based expiration
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import {
  DelegationManagerService,
  createDelegationManager,
  type AgentContext,
  type DelegationSpec,
  type DelegationChain,
} from "../../../../../src/platform/five-plane-orchestration/agent-delegation/index.js";

function createTestAgentContext(overrides: Partial<AgentContext> = {}): AgentContext {
  return {
    agentId: "parent_agent_001",
    agentType: "general_executor",
    packId: "pack_parent",
    delegationDepth: 0,
    activeDelegations: [],
    permissions: {
      resources: ["/workspace", "/code"],
      actions: ["read", "write", "execute", "bash"],
      constraints: {
        maxDurationMs: 300000,
        maxTokens: 8000,
        allowedDomains: ["github.com", "api.example.com"],
      },
    },
    sandboxTier: "container",
    correlationId: "corr_001",
    tenantId: null,
    ...overrides,
  };
}

function createDelegationSpec(overrides: Partial<DelegationSpec> = {}): DelegationSpec {
  return {
    targetAgentId: "child_agent_001",
    targetAgentType: "general_executor",
    targetPackId: "pack_child",
    requiredPermissions: {
      resources: ["/workspace"],
      actions: ["read", "write"],
      constraints: {
        maxDurationMs: 60000,
        maxTokens: 4000,
      },
    },
    timeout: 120000,
    ...overrides,
  };
}

test("DelegationManager creates delegation with valid topology", async () => {
  const ctx = createIntegrationContext("aa-dlg-create-");
  try {
    const service = createDelegationManager();

    const parent = createTestAgentContext();
    const spec = createDelegationSpec();

    const handle = await service.delegate(parent, spec);

    assert.ok(handle.delegationId.startsWith("dlg_"), "Should have valid delegation ID");
    assert.equal(handle.parentAgentId, "parent_agent_001");
    assert.equal(handle.childAgentId, "child_agent_001");
    assert.equal(handle.depth, 1);
    assert.equal(handle.status, "pending");
    assert.ok(handle.timeout > 0, "Should have timeout set");
    assert.ok(handle.correlationId.includes("corr_001"), "Should preserve correlation ID");
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager creates nested delegation with incremented depth", async () => {
  const ctx = createIntegrationContext("aa-dlg-nested-");
  try {
    const service = createDelegationManager();

    // First delegation
    const parent1 = createTestAgentContext({ agentId: "root_agent" });
    const spec1 = createDelegationSpec({ targetAgentId: "level1_agent", targetPackId: "pack_level1" });
    const handle1 = await service.delegate(parent1, spec1);

    // Second delegation from child
    const parent2 = createTestAgentContext({
      agentId: "level1_agent",
      delegationDepth: 1,
      activeDelegations: [handle1.delegationId],
    });
    const spec2 = createDelegationSpec({ targetAgentId: "level2_agent", targetPackId: "pack_level2" });
    const handle2 = await service.delegate(parent2, spec2);

    assert.equal(handle1.depth, 1);
    assert.equal(handle2.depth, 2);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager stores delegation chain", async () => {
  const ctx = createIntegrationContext("aa-dlg-chain-");
  try {
    const service = createDelegationManager();

    const parent = createTestAgentContext({ agentId: "root_agent" });
    const spec = createDelegationSpec({ targetAgentId: "child_agent" });

    await service.delegate(parent, spec);

    const chain = await service.getDelegationChain("root_agent");
    assert.ok(chain, "Should have delegation chain");
    assert.equal(chain!.rootAgentId, "root_agent");
    assert.equal(chain!.nodes.length, 1);
    assert.equal(chain!.nodes[0]!.agentId, "child_agent");
    assert.equal(chain!.totalDelegations, 1);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager cancels pending delegation", async () => {
  const ctx = createIntegrationContext("aa-dlg-cancel-");
  try {
    const service = createDelegationManager();

    const parent = createTestAgentContext();
    const spec = createDelegationSpec();
    const handle = await service.delegate(parent, spec);

    await service.cancel(handle.delegationId);

    const delegation = await service.getDelegation(handle.delegationId);
    assert.equal(delegation!.status, "cancelled");
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager cancels active delegation", async () => {
  const ctx = createIntegrationContext("aa-dlg-cancel-active-");
  try {
    const service = createDelegationManager();

    const parent = createTestAgentContext();
    const spec = createDelegationSpec();
    const handle = await service.delegate(parent, spec);

    // Simulate activation
    const delegation = await service.getDelegation(handle.delegationId);
    if (delegation) {
      delegation.status = "active";
    }

    await service.cancel(handle.delegationId);

    const updated = await service.getDelegation(handle.delegationId);
    assert.equal(updated!.status, "cancelled");
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager completes delegation", async () => {
  const ctx = createIntegrationContext("aa-dlg-complete-");
  try {
    const service = createDelegationManager();

    const parent = createTestAgentContext();
    const spec = createDelegationSpec();
    const handle = await service.delegate(parent, spec);

    await service.complete(handle.delegationId, "output_artifact_123");

    const delegation = await service.getDelegation(handle.delegationId);
    assert.equal(delegation!.status, "completed");
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager fails delegation", async () => {
  const ctx = createIntegrationContext("aa-dlg-fail-");
  try {
    const service = createDelegationManager();

    const parent = createTestAgentContext();
    const spec = createDelegationSpec();
    const handle = await service.delegate(parent, spec);

    await service.fail(handle.delegationId, "Execution error");

    const delegation = await service.getDelegation(handle.delegationId);
    assert.equal(delegation!.status, "failed");
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager gets active delegations for agent", async () => {
  const ctx = createIntegrationContext("aa-dlg-active-");
  try {
    const service = createDelegationManager();

    const parent = createTestAgentContext({ agentId: "parent_for_active" });
    const spec1 = createDelegationSpec({ targetAgentId: "child1", targetPackId: "pack_child_1" });
    const spec2 = createDelegationSpec({ targetAgentId: "child2", targetPackId: "pack_child_2" });

    await service.delegate(parent, spec1);
    await service.delegate(parent, spec2);

    const active = await service.getActiveDelegations("parent_for_active");
    assert.equal(active.length, 2);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager revokeExpiredDelegations marks expired delegations", async () => {
  const ctx = createIntegrationContext("aa-dlg-expire-");
  try {
    const service = createDelegationManager();

    const parent = createTestAgentContext({ agentId: "expiring_agent" });
    const spec = createDelegationSpec({ targetAgentId: "expiring_child" });
    const handle = await service.delegate(parent, spec);

    // Manually set expiresAt to past
    const delegation = await service.getDelegation(handle.delegationId);
    if (delegation) {
      delegation.expiresAt = new Date(Date.now() - 1000).toISOString();
    }

    const result = await service.revokeExpiredDelegations();

    assert.ok(result.scanned >= 1);
    assert.ok(result.expired >= 1);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager getExpiredDelegations returns unexpired pending delegations", async () => {
  const ctx = createIntegrationContext("aa-dlg-get-expired-");
  try {
    const service = createDelegationManager();

    const parent = createTestAgentContext({ agentId: "expired_check_agent" });
    const spec = createDelegationSpec({ targetAgentId: "expired_check_child" });
    const handle = await service.delegate(parent, spec);

    // Set to past
    const delegation = await service.getDelegation(handle.delegationId);
    if (delegation) {
      delegation.expiresAt = new Date(Date.now() - 5000).toISOString();
    }

    const expired = await service.getExpiredDelegations();
    assert.ok(expired.length >= 1);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager recordTakeoverNotice handles takeover notice", async () => {
  const ctx = createIntegrationContext("aa-dlg-takeover-");
  try {
    const service = createDelegationManager();

    const parent = createTestAgentContext();
    const spec = createDelegationSpec();
    const handle = await service.delegate(parent, spec);

    // The recordTakeoverNotice method handles incoming takeover messages
    // Since this requires a properly structured ACP message, we test that
    // the method exists and can be called without error
    const message = {
      messageId: "msg_takeover_001",
      messageType: "takeover_notice" as const,
      correlation_id: handle.delegationId,
      parent_run_id: handle.delegationId,
      depth: 1,
      sender_agent_id: "operator",
      receiver_agent_id: parent.agentId,
      domain_id: "delegation",
      risk_level: 0,
      budget_remaining: 100,
      trace_id: "trace_takeover",
      payload: {},
      timestamp: new Date().toISOString(),
    };

    const context = {
      parentPermissions: parent.permissions,
      parentRiskMode: 50,
      parentConstraints: {},
      parentBudgetRemaining: 100,
      globalCallDepth: 1,
    };

    const result = await service.recordTakeoverNotice(message, context);
    assert.ok(typeof result.accepted === "boolean");
    assert.ok(Array.isArray(result.violations));
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager completeWithEvidence validates completion report", async () => {
  const ctx = createIntegrationContext("aa-dlg-evidence-");
  try {
    const service = createDelegationManager();

    const parent = createTestAgentContext();
    const spec = createDelegationSpec();
    const handle = await service.delegate(parent, spec);

    await service.completeWithEvidence(handle.delegationId, ["evidence_1", "evidence_2"], "output_ref");

    const delegation = await service.getDelegation(handle.delegationId);
    assert.equal(delegation!.status, "completed");
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager throws ValidationError for cancel on completed delegation", async () => {
  const ctx = createIntegrationContext("aa-dlg-cancel-error-");
  try {
    const service = createDelegationManager();

    const parent = createTestAgentContext();
    const spec = createDelegationSpec();
    const handle = await service.delegate(parent, spec);

    await service.complete(handle.delegationId);

    await assert.rejects(
      async () => service.cancel(handle.delegationId),
      /cannot be cancelled/,
    );
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager throws ValidationError for cancel on non-existent delegation", async () => {
  const ctx = createIntegrationContext("aa-dlg-cancel-notfound-");
  try {
    const service = createDelegationManager();

    await assert.rejects(
      async () => service.cancel("non_existent_dlg"),
      /not found/,
    );
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager with custom options uses configured defaults", async () => {
  const ctx = createIntegrationContext("aa-dlg-options-");
  try {
    const service = createDelegationManager({
      maxDepth: 3,
      maxFanout: 5,
      defaultTimeout: 60000,
    });

    const parent = createTestAgentContext();
    // spec.timeout defaults to 120000, which overrides defaultTimeout of 60000
    const spec = createDelegationSpec();

    const handle = await service.delegate(parent, spec);

    // spec.timeout (120000) should be used, not defaultTimeout (60000).
    // The exposed remaining timeout is computed after wall-clock time has advanced.
    assert.ok(handle.timeout <= 120000);
    assert.ok(handle.timeout >= 119000);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager getDelegation returns null for non-existent delegation", async () => {
  const ctx = createIntegrationContext("aa-dlg-get-null-");
  try {
    const service = createDelegationManager();

    const result = await service.getDelegation("non_existent");
    assert.equal(result, null);
  } finally {
    ctx.cleanup();
  }
});

test("DelegationManager getDelegationChain returns null for unknown agent", async () => {
  const ctx = createIntegrationContext("aa-dlg-chain-null-");
  try {
    const service = createDelegationManager();

    const result = await service.getDelegationChain("unknown_agent");
    assert.equal(result, null);
  } finally {
    ctx.cleanup();
  }
});
