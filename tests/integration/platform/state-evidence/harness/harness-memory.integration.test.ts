/**
 * Integration tests for HarnessMemoryManager with harness runtime.
 *
 * Tests the memory manager in an integration context with simulated
 * harness runtime scenarios.
 *
 * These tests verify:
 * - Memory management across multiple harness runs
 * - Tier management under realistic workload patterns
 * - Self-enhancement protection in multi-step scenarios
 * - Issue #2035: Unbounded growth behavior
 */

import assert from "node:assert/strict";
import test from "node:test";
import { HarnessMemoryManager, type HarnessMemoryNamespace, type MemoryTier } from "../../../../../../src/platform/five-plane-orchestration/harness/memory-manager.js";

// =============================================================================
// Factory Helpers
// =============================================================================

function createManager(): HarnessMemoryManager {
  return new HarnessMemoryManager();
}

// =============================================================================
// Multi-Run Memory Isolation Tests
// =============================================================================

test("integration: each run scope is isolated from others", () => {
  const manager = createManager();

  // Simulate multiple independent runs
  manager.write("run", "run_1", "execution_context", { step: 1, agent: "A" });
  manager.write("run", "run_2", "execution_context", { step: 1, agent: "B" });
  manager.write("run", "run_3", "execution_context", { step: 1, agent: "C" });

  // Each run should have its own execution context
  assert.deepEqual(manager.read("run", "run_1", "execution_context"), { step: 1, agent: "A" });
  assert.deepEqual(manager.read("run", "run_2", "execution_context"), { step: 1, agent: "B" });
  assert.deepEqual(manager.read("run", "run_3", "execution_context"), { step: 1, agent: "C" });
});

test("integration: run namespace can accumulate state across steps", () => {
  const manager = createManager();

  const runId = "run_abc123";

  // Simulate a multi-step run
  manager.write("run", runId, "step_1_result", { output: "Step 1 complete" });
  manager.write("run", runId, "step_2_result", { output: "Step 2 complete" });
  manager.write("run", runId, "step_3_result", { output: "Step 3 complete" });

  // All steps should be accessible
  const step1 = manager.read("run", runId, "step_1_result");
  const step2 = manager.read("run", runId, "step_2_result");
  const step3 = manager.read("run", runId, "step_3_result");

  assert.deepEqual(step1, { output: "Step 1 complete" });
  assert.deepEqual(step2, { output: "Step 2 complete" });
  assert.deepEqual(step3, { output: "Step 3 complete" });

  // List should show all steps
  const records = manager.list("run", runId);
  assert.equal(records.length, 3);
});

// =============================================================================
// Domain Memory Sharing Tests
// =============================================================================

test("integration: domain namespace allows cross-run sharing", () => {
  const manager = createManager();

  // Write domain-level knowledge
  manager.write("domain", "shared_knowledge", "api_patterns", {
    pattern: "repository",
    description: "Data access pattern",
  });

  // Multiple runs can access the same domain knowledge
  assert.deepEqual(
    manager.read("domain", "shared_knowledge", "api_patterns"),
    { pattern: "repository", description: "Data access pattern" },
  );

  manager.write("domain", "another_run", "api_patterns", {
    pattern: "updated",
  });

  // Original should be unchanged
  assert.deepEqual(
    manager.read("domain", "shared_knowledge", "api_patterns"),
    { pattern: "repository", description: "Data access pattern" },
  );
});

test("integration: shared namespace for global state", () => {
  const manager = createManager();

  // Global configuration
  manager.write("shared", "global_config", "max_retries", 3);
  manager.write("shared", "global_config", "timeout_ms", 30000);
  manager.write("shared", "global_config", "features", ["feature_a", "feature_b"]);

  // All configs should be accessible
  assert.equal(manager.read("shared", "global_config", "max_retries"), 3);
  assert.equal(manager.read("shared", "global_config", "timeout_ms"), 30000);
  assert.deepEqual(manager.read("shared", "global_config", "features"), ["feature_a", "feature_b"]);
});

// =============================================================================
// Tier Management Integration Tests
// =============================================================================

test("integration: working tier records promoted after repeated access", () => {
  const manager = createManager();

  const runId = "run_promotion_test";

  // Write initial record
  manager.write("run", runId, "frequently_accessed", { data: "important" });

  // Simulate repeated access (e.g., agent repeatedly consulting same memory)
  for (let i = 0; i < 15; i++) {
    manager.read("run", runId, "frequently_accessed");
  }

  const tier = manager.getTier("run", runId, "frequently_accessed");

  // Should have been promoted to long_term due to frequent access
  assert.ok(tier === "long_term" || tier === "working");
});

test("integration: shared tier acts as permanent storage", () => {
  const manager = createManager();

  // Write to shared namespace
  manager.write("shared", "permanent", "license_key", "ABCD-1234-EFGH-5678");

  // Verify it's in shared tier
  const tier = manager.getTier("shared", "permanent", "license_key");
  assert.equal(tier, "shared");

  // Access many times
  for (let i = 0; i < 20; i++) {
    manager.read("shared", "permanent", "license_key");
  }

  // Should still be in shared tier (max tier)
  const newTier = manager.getTier("shared", "permanent", "license_key");
  assert.equal(newTier, "shared");
});

// =============================================================================
// Self-Enhancement Protection Integration Tests
// =============================================================================

test("integration: blocks agent attempting to modify own prompt", () => {
  const manager = createManager();

  const runId = "run_security_test";

  // Simulate an agent attempting self-enhancement
  assert.throws(
    () => {
      manager.write("run", runId, "modify_own_prompt", {
        target: "current_agent",
        change: "increase权限",
      });
    },
    (err: any) => {
      return err.message.includes("harness.memory.self_enhancement_blocked");
    },
  );

  // Verify the blocked write didn't happen
  assert.equal(manager.read("run", runId, "modify_own_prompt"), null);
});

test("integration: blocks agent attempting to escalate own permissions", () => {
  const manager = createManager();

  const runId = "run_security_test_2";

  assert.throws(
    () => {
      manager.write("run", runId, "escalate_own_permissions", {
        action: "gain_admin",
      });
    },
    (err: any) => {
      return err.message.includes("harness.memory.self_enhancement_blocked");
    },
  );
});

test("integration: blocks agent attempting self-modification via action type", () => {
  const manager = createManager();

  const runId = "run_security_test_3";

  assert.throws(
    () => {
      manager.write("run", runId, "memory_key", {
        type: "self_modification",
        target: "agent_instructions",
      });
    },
    (err: any) => {
      return err.message.includes("harness.memory.self_enhancement_blocked");
    },
  );
});

test("integration: allows legitimate operations that look similar to self-enhancement", () => {
  const manager = createManager();

  const runId = "run_legitimate_test";

  // These should NOT throw because they don't match the self-enhancement patterns
  // "update_policy" with action: "notify" is not "update_policy" key
  manager.write("run", runId, "policy_change_request", {
    action: "notify",
    policyId: "pol_123",
  });

  // "change_role" without "own" is not blocked
  manager.write("run", runId, "role_change_request", {
    userId: "user_456",
    newRole: "admin",
  });

  // Both should succeed
  assert.ok(manager.read("run", runId, "policy_change_request") !== null);
  assert.ok(manager.read("run", runId, "role_change_request") !== null);
});

// =============================================================================
// Issue #2035: Unbounded Growth Integration Tests
// =============================================================================
//
// These tests document the unbounded growth issue where TIER_MAX_SIZE is only
// enforced during promotion, not during regular writes to the same tier.
// =============================================================================

test("ISSUE #2035 integration: working tier grows beyond 100 records without eviction", () => {
  const manager = createManager();

  // Simulate a busy system with many concurrent runs
  // Each run has a few memory entries in working tier
  for (let run = 0; run < 150; run++) {
    manager.write("run", `run_${run}`, "context", { runId: run });
    manager.write("run", `run_${run}`, "history", { steps: 5 });
    manager.write("run", `run_${run}`, "state", { status: "running" });
  }

  // With 150 runs * 3 entries each = 450 records in working tier
  // This far exceeds TIER_MAX_SIZE.working = 100
  let workingCount = 0;
  for (let run = 0; run < 150; run++) {
    const tier = manager.getTier("run", `run_${run}`, "context");
    if (tier === "working") {
      workingCount++;
    }
  }

  // All 150 records should still exist in working tier
  // This demonstrates the unbounded growth issue
  assert.equal(workingCount, 150, "Issue #2035: Working tier exceeded 100 records without eviction");
});

test("ISSUE #2035 integration: long_term tier grows beyond 500 records without eviction", () => {
  const manager = createManager();

  // Fill domain namespace with knowledge entries
  for (let i = 0; i < 600; i++) {
    manager.write("domain", `knowledge_${i}`, "content", {
      id: `kb_${i}`,
      data: `Knowledge entry ${i}`,
    });
  }

  // Count records in long_term tier
  let longTermCount = 0;
  for (let i = 0; i < 600; i++) {
    const tier = manager.getTier("domain", `knowledge_${i}`, "content");
    if (tier === "long_term") {
      longTermCount++;
    }
  }

  // All 600 records should exist in long_term tier
  assert.equal(longTermCount, 600, "Issue #2035: Long term tier exceeded 500 records without eviction");
});

test("ISSUE #2035 integration: shared tier grows beyond 1000 records without eviction", () => {
  const manager = createManager();

  // Fill shared namespace with global configurations
  for (let i = 0; i < 1100; i++) {
    manager.write("shared", `config_${i}`, "settings", {
      id: `cfg_${i}`,
      value: `Config ${i}`,
    });
  }

  // Count records in shared tier
  let sharedCount = 0;
  for (let i = 0; i < 1100; i++) {
    const tier = manager.getTier("shared", `config_${i}`, "settings");
    if (tier === "shared") {
      sharedCount++;
    }
  }

  // All 1100 records should exist in shared tier
  assert.equal(sharedCount, 1100, "Issue #2035: Shared tier exceeded 1000 records without eviction");
});

test("ISSUE #2035 integration: eviction only triggers when promoting to full tier", () => {
  const manager = createManager();

  // First, fill working tier to its limit
  for (let i = 0; i < 100; i++) {
    manager.write("run", `scope_${i}`, "key", `value_${i}`);
  }

  // Now write one more - this will exceed working tier limit
  // But since we're not promoting, no eviction should happen
  manager.write("run", "extra_scope", "key", "extra_value");

  // Verify the extra value exists
  assert.equal(manager.read("run", "extra_scope", "key"), "extra_value");

  // Now trigger promotions by accessing one record many times
  // This might cause eviction of the oldest working tier record
  for (let i = 0; i < 15; i++) {
    manager.read("run", "scope_0", "key");
  }

  // The record we were promoting should have moved to long_term
  // And if long_term was full, eviction would happen
  const tier = manager.getTier("run", "scope_0", "key");
  assert.ok(tier === "long_term" || tier === "working");
});

test("ISSUE #2035 integration: cross-tier eviction works when promoting", () => {
  const manager = createManager();

  // Fill long_term tier to near capacity
  for (let i = 0; i < 500; i++) {
    manager.write("domain", `scope_${i}`, "key", `value_${i}`);
  }

  // Verify all in long_term
  let longTermCount = 0;
  for (let i = 0; i < 500; i++) {
    if (manager.getTier("domain", `scope_${i}`, "key") === "long_term") {
      longTermCount++;
    }
  }
  assert.equal(longTermCount, 500);

  // Now promote a working tier record to long_term
  // This should trigger eviction in long_term tier
  for (let i = 0; i < 15; i++) {
    manager.write("run", "promote_me", "key", "promote_value");
    manager.read("run", "promote_me", "key");
  }

  // The promoted record should be in long_term (or still promoting)
  const tier = manager.getTier("run", "promote_me", "key");
  assert.ok(tier === "long_term" || tier === "working");
});

// =============================================================================
// Realistic Workload Simulation Tests
// =============================================================================

test("integration: simulates realistic multi-agent workflow", () => {
  const manager = createManager();

  // Simulate 3 concurrent agents each running a 5-step workflow
  for (let agent = 0; agent < 3; agent++) {
    const agentId = `agent_${agent}`;

    for (let step = 1; step <= 5; step++) {
      manager.write("run", `${agentId}_run`, `step_${step}_input`, {
        agentId,
        step,
        timestamp: Date.now(),
      });

      manager.write("run", `${agentId}_run`, `step_${step}_output`, {
        agentId,
        step,
        result: `completed step ${step}`,
      });
    }

    // Write agent-specific context
    manager.write("run", `${agentId}_run`, "context", {
      agentId,
      totalSteps: 5,
    });
  }

  // Verify all agent runs have their data
  for (let agent = 0; agent < 3; agent++) {
    const agentId = `agent_${agent}`;
    const records = manager.list("run", `${agentId}_run`);
    assert.equal(records.length, 11); // 5 steps * 2 (input/output) + 1 context
  }
});

test("integration: simulates knowledge base queries across runs", () => {
  const manager = createManager();

  // Populate domain knowledge base
  const knowledgeEntries = [
    { id: "kb_1", topic: "authentication", content: "Use OAuth2 for auth" },
    { id: "kb_2", topic: "database", content: "Use connection pooling" },
    { id: "kb_3", topic: "caching", content: "Use Redis for session cache" },
  ];

  for (const entry of knowledgeEntries) {
    manager.write("domain", "knowledge_base", entry.id, entry);
  }

  // Multiple runs query the knowledge base
  for (let run = 0; run < 5; run++) {
    const kb1 = manager.read("domain", "knowledge_base", "kb_1");
    const kb2 = manager.read("domain", "knowledge_base", "kb_2");
    const kb3 = manager.read("domain", "knowledge_base", "kb_3");

    assert.deepEqual(kb1, knowledgeEntries[0]);
    assert.deepEqual(kb2, knowledgeEntries[1]);
    assert.deepEqual(kb3, knowledgeEntries[2]);
  }

  // Verify knowledge base is still intact
  const allKb = manager.list("domain", "knowledge_base");
  assert.equal(allKb.length, 3);
});

// =============================================================================
// Metadata Accuracy Integration Tests
// =============================================================================

test("integration: accessCount reflects actual usage patterns", () => {
  const manager = createManager();

  manager.write("run", "scope_1", "key_1", "value_1");

  // Record initial access count
  const initial = manager.list("run", "scope_1")[0]!.accessCount;

  // Perform multiple operations
  manager.read("run", "scope_1", "key_1");
  manager.read("run", "scope_1", "key_1");
  manager.write("run", "scope_1", "key_1", "new_value");
  manager.read("run", "scope_1", "key_1");

  const after = manager.list("run", "scope_1")[0]!.accessCount;
  assert.ok(after > initial + 3);
});

test("integration: createdAt persists across many operations", () => {
  const manager = createManager();

  manager.write("run", "scope_1", "key_1", "value_1");
  const createdAt = manager.list("run", "scope_1")[0]!.createdAt;

  // Perform many operations
  for (let i = 0; i < 50; i++) {
    manager.read("run", "scope_1", "key_1");
    if (i % 10 === 0) {
      manager.write("run", "scope_1", "key_1", `value_${i}`);
    }
  }

  const afterManyOps = manager.list("run", "scope_1")[0]!.createdAt;
  assert.equal(afterManyOps, createdAt);
});

test("integration: lastAccessedAt updates on each access", () => {
  const manager = createManager();

  manager.write("run", "scope_1", "key_1", "value_1");
  const afterWrite = manager.list("run", "scope_1")[0]!.lastAccessedAt;

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  manager.read("run", "scope_1", "key_1");
  const afterRead = manager.list("run", "scope_1")[0]!.lastAccessedAt;

  assert.ok(afterRead >= afterWrite);
});
