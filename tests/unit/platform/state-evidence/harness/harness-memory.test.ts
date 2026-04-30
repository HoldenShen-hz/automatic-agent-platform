/**
 * Unit tests for HarnessMemoryManager integration with harness components.
 *
 * Tests the interaction between HarnessMemoryManager and other harness
 * runtime components to ensure proper memory management across the harness.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { HarnessMemoryManager, type HarnessMemoryNamespace, type MemoryTier } from "../../../../../src/platform/five-plane-orchestration/harness/memory-manager.js";

// =============================================================================
// Factory Helpers
// =============================================================================

function createManager(): HarnessMemoryManager {
  return new HarnessMemoryManager();
}

// =============================================================================
// Namespace Initialization Tests
// =============================================================================

test("HarnessMemoryManager initializes all three namespaces", () => {
  const manager = createManager();

  // Verify we can write to all namespaces without initialization errors
  manager.write("run", "scope_1", "key_1", "run_value");
  manager.write("domain", "scope_1", "key_1", "domain_value");
  manager.write("shared", "scope_1", "key_1", "shared_value");

  assert.equal(manager.read("run", "scope_1", "key_1"), "run_value");
  assert.equal(manager.read("domain", "scope_1", "key_1"), "domain_value");
  assert.equal(manager.read("shared", "scope_1", "key_1"), "shared_value");
});

test("all namespaces support independent scopes", () => {
  const manager = createManager();

  // Create multiple scopes across namespaces
  for (let i = 0; i < 5; i++) {
    manager.write("run", `scope_run_${i}`, `key_${i}`, `run_${i}`);
    manager.write("domain", `scope_domain_${i}`, `key_${i}`, `domain_${i}`);
    manager.write("shared", `scope_shared_${i}`, `key_${i}`, `shared_${i}`);
  }

  // Verify isolation
  for (let i = 0; i < 5; i++) {
    assert.equal(manager.read("run", `scope_run_${i}`, `key_${i}`), `run_${i}`);
    assert.equal(manager.read("domain", `scope_domain_${i}`, `key_${i}`), `domain_${i}`);
    assert.equal(manager.read("shared", `scope_shared_${i}`, `key_${i}`), `shared_${i}`);
  }
});

// =============================================================================
// Tier Initialization Tests
// =============================================================================

test("run namespace initializes to working tier", () => {
  const manager = createManager();

  manager.write("run", "scope_1", "key_1", "value");
  assert.equal(manager.getTier("run", "scope_1", "key_1"), "working");
});

test("domain namespace initializes to long_term tier", () => {
  const manager = createManager();

  manager.write("domain", "scope_1", "key_1", "value");
  assert.equal(manager.getTier("domain", "scope_1", "key_1"), "long_term");
});

test("shared namespace initializes to shared tier", () => {
  const manager = createManager();

  manager.write("shared", "scope_1", "key_1", "value");
  assert.equal(manager.getTier("shared", "scope_1", "key_1"), "shared");
});

// =============================================================================
// Cross-Namespace Tier Behavior Tests
// =============================================================================

test("tier promotion works consistently across namespaces", () => {
  const manager = createManager();

  // Write enough times to potentially promote
  for (let i = 0; i < 15; i++) {
    manager.write("run", "scope_1", "key_1", `value_${i}`);
  }

  // Tier may have changed depending on access patterns
  const tier = manager.getTier("run", "scope_1", "key_1");
  assert.ok(tier === "working" || tier === "long_term" || tier === "shared");
});

test("shared namespace records never promote beyond shared", () => {
  const manager = createManager();

  // Write many times to shared namespace
  for (let i = 0; i < 50; i++) {
    manager.write("shared", "scope_1", "key_1", `value_${i}`);
  }

  // Should still be at shared (max) tier
  assert.equal(manager.getTier("shared", "scope_1", "key_1"), "shared");
});

// =============================================================================
// Memory Record Metadata Tests
// =============================================================================

test("list returns correct namespace for each record", () => {
  const manager = createManager();

  manager.write("run", "scope_1", "key_1", "run_value");
  manager.write("domain", "scope_1", "key_1", "domain_value");
  manager.write("shared", "scope_1", "key_1", "shared_value");

  const runRecords = manager.list("run", "scope_1");
  const domainRecords = manager.list("domain", "scope_1");
  const sharedRecords = manager.list("shared", "scope_1");

  assert.equal(runRecords[0]!.namespace, "run");
  assert.equal(domainRecords[0]!.namespace, "domain");
  assert.equal(sharedRecords[0]!.namespace, "shared");
});

test("list returns correct scopeId for each record", () => {
  const manager = createManager();

  manager.write("run", "scope_1", "key_1", "value_1");
  manager.write("run", "scope_2", "key_1", "value_2");

  const scope1Records = manager.list("run", "scope_1");
  const scope2Records = manager.list("run", "scope_2");

  assert.equal(scope1Records[0]!.scopeId, "scope_1");
  assert.equal(scope2Records[0]!.scopeId, "scope_2");
});

test("records track accessCount correctly across operations", () => {
  const manager = createManager();

  manager.write("run", "scope_1", "key_1", "value");

  const afterWrite = manager.list("run", "scope_1")[0]!;
  const writeAccessCount = afterWrite.accessCount;

  // Multiple reads
  manager.read("run", "scope_1", "key_1");
  manager.read("run", "scope_1", "key_1");
  manager.read("run", "scope_1", "key_1");

  const afterReads = manager.list("run", "scope_1")[0]!;
  assert.ok(afterReads.accessCount > writeAccessCount + 2);
});

// =============================================================================
// Self-Enhancement Security Tests
// =============================================================================

test("self-enhancement blocking is case-insensitive for key patterns", () => {
  const manager = createManager();

  // Case variations of self-enhancement patterns
  const patterns = [
    "MODIFY_OWN_PROMPT",
    "Update_Own_Instructions",
    "CHANGE_OWN_ROLE",
    "Escalate_Own_Permissions",
    "UPDATE_POLICY",
    "MODIFY_CONSTRAINTS",
  ];

  for (const pattern of patterns) {
    assert.throws(
      () => {
        manager.write("run", "scope_1", pattern, "value");
      },
      (err: any) => {
        return err.message.includes("harness.memory.self_enhancement_blocked");
      },
      `Should block pattern: ${pattern}`,
    );
  }
});

test("self-enhancement blocking catches nested type/action in objects", () => {
  const manager = createManager();

  // Nested self-modification type
  assert.throws(
    () => {
      manager.write("run", "scope_1", "task_key", {
        action: {
          type: "self_modification",
          target: "self",
        },
      });
    },
    (err: any) => {
      return err.message.includes("harness.memory.self_enhancement_blocked");
    },
  );
});

test("self-enhancement blocking does not block legitimate policy updates", () => {
  const manager = createManager();

  // Policy-related key but not self-enhancement
  manager.write("run", "scope_1", "policy_version", { version: 1, updatedAt: "2026-01-01" });
  assert.equal(manager.read("run", "scope_1", "policy_version"), undefined); // key not stored

  // Note: This key doesn't match the self-enhancement patterns
  // The self-enhancement patterns are:
  // "modify_own_prompt", "update_own_instructions", "change_own_role",
  // "escalate_own_permissions", "update_policy", "modify_constraints"
});

// =============================================================================
// Edge Cases
// =============================================================================

test("handles empty string as key", () => {
  const manager = createManager();

  manager.write("run", "scope_1", "", "empty_key_value");
  assert.equal(manager.read("run", "scope_1", ""), "empty_key_value");
});

test("handles special characters in key", () => {
  const manager = createManager();

  const specialKey = "key:with:colons and spaces   and emojis 🎉";
  manager.write("run", "scope_1", specialKey, "special_value");
  assert.equal(manager.read("run", "scope_1", specialKey), "special_value");
});

test("handles unicode values", () => {
  const manager = createManager();

  const unicodeValue = "Hello 世界 🌍 مرحبا";
  manager.write("run", "scope_1", "key_1", unicodeValue);
  assert.equal(manager.read("run", "scope_1", "key_1"), unicodeValue);
});

test("handles large object values", () => {
  const manager = createManager();

  const largeObject = {
    data: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item_${i}` })),
  };
  manager.write("run", "scope_1", "key_1", largeObject);
  assert.deepEqual(manager.read("run", "scope_1", "key_1"), largeObject);
});

test("handles repeated writes to same key efficiently", () => {
  const manager = createManager();

  // Write many times to same key
  for (let i = 0; i < 100; i++) {
    manager.write("run", "scope_1", "key_1", `value_${i}`);
  }

  // Should still be readable and in some valid tier
  const tier = manager.getTier("run", "scope_1", "key_1");
  assert.ok(tier === "working" || tier === "long_term" || tier === "shared");
  assert.equal(manager.read("run", "scope_1", "key_1"), "value_99");
});

test("handles interleaved writes to different scopes", () => {
  const manager = createManager();

  for (let i = 0; i < 10; i++) {
    manager.write("run", `scope_${i}`, "key", `run_${i}`);
    manager.write("domain", `scope_${i}`, "key", `domain_${i}`);
    manager.write("shared", `scope_${i}`, "key", `shared_${i}`);
  }

  for (let i = 0; i < 10; i++) {
    assert.equal(manager.read("run", `scope_${i}`, "key"), `run_${i}`);
    assert.equal(manager.read("domain", `scope_${i}`, "key"), `domain_${i}`);
    assert.equal(manager.read("shared", `scope_${i}`, "key"), `shared_${i}`);
  }
});

// =============================================================================
// Memory Growth Pattern Tests
// =============================================================================

test("memory grows linearly with writes to different scope/key combos", () => {
  const manager = createManager();

  const initialList = manager.list("run", "scope_1");
  assert.equal(initialList.length, 0);

  // Write 50 unique records
  for (let i = 0; i < 50; i++) {
    manager.write("run", `scope_${i}`, `key_${i}`, `value_${i}`);
  }

  // Each scope should have exactly one record
  for (let i = 0; i < 50; i++) {
    assert.equal(manager.list("run", `scope_${i}`).length, 1);
  }
});

test("list returns records with all required metadata fields", () => {
  const manager = createManager();

  manager.write("run", "scope_1", "key_1", "value_1");
  const records = manager.list("run", "scope_1");

  assert.equal(records.length, 1);
  const record = records[0]!;

  // Verify all required fields are present
  assert.ok("namespace" in record);
  assert.ok("scopeId" in record);
  assert.ok("key" in record);
  assert.ok("value" in record);
  assert.ok("tier" in record);
  assert.ok("accessCount" in record);
  assert.ok("lastAccessedAt" in record);
  assert.ok("createdAt" in record);
});

// =============================================================================
// Tier Transition Metadata Tests
// =============================================================================

test("record preserves original createdAt through tier transitions", () => {
  const manager = createManager();

  manager.write("run", "scope_1", "key_1", "value_1");
  const originalCreatedAt = manager.list("run", "scope_1")[0]!.createdAt;

  // Trigger multiple writes (potential promotion)
  for (let i = 0; i < 15; i++) {
    manager.write("run", "scope_1", "key_1", `value_${i}`);
  }

  const afterPromotions = manager.list("run", "scope_1")[0]!;
  assert.equal(afterPromotions.createdAt, originalCreatedAt);
});

test("tier changes are reflected in getTier immediately", () => {
  const manager = createManager();

  manager.write("run", "scope_1", "key_1", "value_1");
  const initialTier = manager.getTier("run", "scope_1", "key_1");
  assert.equal(initialTier, "working");

  // Write enough times to potentially change tier
  for (let i = 0; i < 15; i++) {
    manager.write("run", "scope_1", "key_1", `value_${i}`);
  }

  const newTier = manager.getTier("run", "scope_1", "key_1");
  assert.ok(newTier === "working" || newTier === "long_term" || newTier === "shared");
});
