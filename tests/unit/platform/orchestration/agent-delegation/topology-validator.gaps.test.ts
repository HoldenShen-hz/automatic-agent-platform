/**
 * Unit tests for TopologyValidator - Coverage Gaps
 *
 * Tests for edge cases not covered in the main test file:
 * - Default configuration behavior
 * - Edge cases in depth/fanout validation
 * - Empty chain cycle detection
 * - Multiple allowed pack IDs validation
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  TopologyValidator,
  createTopologyValidator,
  DelegationDepthExceededError,
  DelegationFanoutExceededError,
  DelegationCycleDetectedError,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_FANOUT,
} from "../../../../../src/platform/five-plane-orchestration/agent-delegation/topology-validator.js";

// ─────────────────────────────────────────────────────────────────────────────
// Default Configuration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("TopologyValidator uses provided maxDepth even when 0", () => {
  const validator = new TopologyValidator({ maxDepth: 0, maxFanout: 10 });

  assert.equal(validator.getMaxDepth(), 0);
});

test("TopologyValidator uses provided maxFanout even when 0", () => {
  const validator = new TopologyValidator({ maxDepth: 5, maxFanout: 0 });

  assert.equal(validator.getMaxFanout(), 0);
});

test("getMaxDepth returns 0 when explicitly set", () => {
  const validator = new TopologyValidator({ maxDepth: 0, maxFanout: 10 });

  // With 0, any depth >= 0 will fail (since >= is used)
  assert.equal(validator.getMaxDepth(), 0);
  assert.throws(() => validator.validateDepth(0), DelegationDepthExceededError);
});

test("getMaxFanout returns 0 when explicitly set", () => {
  const validator = new TopologyValidator({ maxDepth: 10, maxFanout: 0 });

  // With 0, any fanout >= 0 will fail (since >= is used)
  assert.equal(validator.getMaxFanout(), 0);
  assert.throws(() => validator.validateFanout(0), DelegationFanoutExceededError);
});

test("createTopologyValidator uses DEFAULT_MAX_DEPTH when config not provided", () => {
  const validator = createTopologyValidator();

  assert.equal(validator.getMaxDepth(), DEFAULT_MAX_DEPTH);
});

test("createTopologyValidator uses DEFAULT_MAX_FANOUT when config not provided", () => {
  const validator = createTopologyValidator();

  assert.equal(validator.getMaxFanout(), DEFAULT_MAX_FANOUT);
});

test("createTopologyValidator accepts undefined config", () => {
  const validator = createTopologyValidator(undefined);

  assert.equal(validator.getMaxDepth(), DEFAULT_MAX_DEPTH);
  assert.equal(validator.getMaxFanout(), DEFAULT_MAX_FANOUT);
});

test("createTopologyValidator accepts partial config", () => {
  const validator = createTopologyValidator({ maxDepth: 7 });

  assert.equal(validator.getMaxDepth(), 7);
  assert.equal(validator.getMaxFanout(), DEFAULT_MAX_FANOUT);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases in Depth Validation
// ─────────────────────────────────────────────────────────────────────────────

test("validateDepth allows depth 0", () => {
  const validator = createTopologyValidator({ maxDepth: 3 });

  assert.doesNotThrow(() => validator.validateDepth(0));
});

test("validateDepth allows depth 1 when maxDepth is 2", () => {
  const validator = createTopologyValidator({ maxDepth: 2 });

  assert.doesNotThrow(() => validator.validateDepth(1));
});

test("validateDepth throws at exactly maxDepth", () => {
  const validator = createTopologyValidator({ maxDepth: 3 });

  assert.throws(
    () => validator.validateDepth(3),
    DelegationDepthExceededError,
  );
});

test("validateDepth throws for depth greater than maxDepth", () => {
  const validator = createTopologyValidator({ maxDepth: 3 });

  assert.throws(
    () => validator.validateDepth(4),
    DelegationDepthExceededError,
  );
});

test("validateDepth allows negative depth (no restriction on negative values)", () => {
  const validator = createTopologyValidator({ maxDepth: 3 });

  assert.doesNotThrow(() => validator.validateDepth(-1));
});

test("DelegationDepthExceededError message includes current and max depth", () => {
  const err = new DelegationDepthExceededError(5, 3);

  assert.ok(err.message.includes("5"));
  assert.ok(err.message.includes("3"));
  assert.ok(err.message.includes("exceeds maximum"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases in Fanout Validation
// ─────────────────────────────────────────────────────────────────────────────

test("validateFanout allows fanout 0", () => {
  const validator = createTopologyValidator({ maxFanout: 10 });

  assert.doesNotThrow(() => validator.validateFanout(0));
});

test("validateFanout allows fanout less than maxFanout", () => {
  const validator = createTopologyValidator({ maxFanout: 10 });

  assert.doesNotThrow(() => validator.validateFanout(9));
});

test("validateFanout throws at exactly maxFanout", () => {
  const validator = createTopologyValidator({ maxFanout: 10 });

  assert.throws(
    () => validator.validateFanout(10),
    DelegationFanoutExceededError,
  );
});

test("validateFanout throws for fanout greater than maxFanout", () => {
  const validator = createTopologyValidator({ maxFanout: 10 });

  assert.throws(
    () => validator.validateFanout(15),
    DelegationFanoutExceededError,
  );
});

test("validateFanout allows negative fanout (no restriction on negative values)", () => {
  const validator = createTopologyValidator({ maxFanout: 10 });

  assert.doesNotThrow(() => validator.validateFanout(-1));
});

test("DelegationFanoutExceededError message includes current and max fanout", () => {
  const err = new DelegationFanoutExceededError(12, 5);

  assert.ok(err.message.includes("12"));
  assert.ok(err.message.includes("5"));
  assert.ok(err.message.includes("exceeds maximum"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases in Cycle Detection
// ─────────────────────────────────────────────────────────────────────────────

test("detectCycle allows empty chain", () => {
  const validator = createTopologyValidator();

  assert.doesNotThrow(() => validator.detectCycle("new-pack", []));
});

test("detectCycle allows single element different from target", () => {
  const validator = createTopologyValidator();

  assert.doesNotThrow(() => validator.detectCycle("new-pack", ["existing-pack"]));
});

test("detectCycle allows multiple elements all different from target", () => {
  const validator = createTopologyValidator();

  assert.doesNotThrow(() => validator.detectCycle("new-pack", ["pack-a", "pack-b", "pack-c"]));
});

test("detectCycle throws when packId appears at start of chain", () => {
  const validator = createTopologyValidator();

  assert.throws(
    () => validator.detectCycle("pack-a", ["pack-a", "pack-b", "pack-c"]),
    DelegationCycleDetectedError,
  );
});

test("detectCycle throws when packId appears at end of chain", () => {
  const validator = createTopologyValidator();

  assert.throws(
    () => validator.detectCycle("pack-c", ["pack-a", "pack-b", "pack-c"]),
    DelegationCycleDetectedError,
  );
});

test("detectCycle throws when packId appears in middle of chain", () => {
  const validator = createTopologyValidator();

  assert.throws(
    () => validator.detectCycle("pack-b", ["pack-a", "pack-b", "pack-c"]),
    DelegationCycleDetectedError,
  );
});

test("detectCycle throws for single-element cycle (packId equals only element)", () => {
  const validator = createTopologyValidator();

  assert.throws(
    () => validator.detectCycle("pack-a", ["pack-a"]),
    DelegationCycleDetectedError,
  );
});

test("DelegationCycleDetectedError contains correct packId and chain", () => {
  const err = new DelegationCycleDetectedError("repeated-pack", ["a", "b", "repeated-pack", "d"]);

  assert.ok(err.message.includes("repeated-pack"));
  assert.ok(err.code.includes("cycle_detected"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Pack ID Validation Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("validatePackId allows any pack when allowedPackIds is null", () => {
  const validator = createTopologyValidator(); // No allowedPackIds

  assert.doesNotThrow(() => validator.validatePackId("any-pack-id"));
});

test("validatePackId allows pack in allowedPackIds", () => {
  const validator = createTopologyValidator({
    allowedPackIds: ["allowed-1", "allowed-2", "allowed-3"],
  });

  assert.doesNotThrow(() => validator.validatePackId("allowed-2"));
});

test("validatePackId allows first pack in allowedPackIds", () => {
  assert.doesNotThrow(() => {
    const validator = createTopologyValidator({
      allowedPackIds: ["first-allowed", "second-allowed"],
    });

    validator.validatePackId("first-allowed"); // Should not throw
  });
});

test("validatePackId allows last pack in allowedPackIds", () => {
  assert.doesNotThrow(() => {
    const validator = createTopologyValidator({
      allowedPackIds: ["first-allowed", "last-allowed"],
    });

    validator.validatePackId("last-allowed"); // Should not throw
  });
});

test("validatePackId throws for pack not in allowedPackIds", () => {
  const validator = createTopologyValidator({
    allowedPackIds: ["allowed-1", "allowed-2"],
  });

  assert.throws(
    () => validator.validatePackId("disallowed-pack"),
    (err: Error & { code?: string }) => err.code === "delegation.pack_id_not_allowed",
  );
});

test("validatePackId case-sensitive matching", () => {
  const validator = createTopologyValidator({
    allowedPackIds: ["Pack-A", "Pack-B"],
  });

  // Should throw because pack-a (lowercase) is not Pack-A (mixed case)
  assert.throws(
    () => validator.validatePackId("pack-a"),
    (err: Error & { code?: string }) => err.code === "delegation.pack_id_not_allowed",
  );
});

test("validatePackId with empty allowedPackIds rejects all", () => {
  const validator = createTopologyValidator({
    allowedPackIds: [],
  });

  assert.throws(
    () => validator.validatePackId("any-pack"),
    (err: Error & { code?: string }) => err.code === "delegation.pack_id_not_allowed",
  );
});

test("validatePackId with single allowed pack", () => {
  const validator = createTopologyValidator({
    allowedPackIds: ["only-allowed"],
  });

  validator.validatePackId("only-allowed"); // Should not throw
  assert.throws(
    () => validator.validatePackId("other-pack"),
    (err: Error & { code?: string }) => err.code === "delegation.pack_id_not_allowed",
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Full Validation Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("validate succeeds when all constraints are satisfied", () => {
  assert.doesNotThrow(() => {
    const validator = createTopologyValidator({
      maxDepth: 3,
      maxFanout: 10,
      allowedPackIds: ["pack-a", "pack-b"],
    });

    validator.validate({
      currentDepth: 2,
      activeDelegations: 5,
      targetPackId: "pack-a",
      delegationChain: [],
    }); // Should not throw
  });
});

test("validate fails on depth even when packId is allowed", () => {
  const validator = createTopologyValidator({
    maxDepth: 2,
    maxFanout: 10,
    allowedPackIds: ["pack-a"],
  });

  assert.throws(
    () => validator.validate({
      currentDepth: 2, // Equals max - should fail
      activeDelegations: 5,
      targetPackId: "pack-a",
      delegationChain: [],
    }),
    DelegationDepthExceededError,
  );
});

test("validate fails on fanout even when packId is allowed", () => {
  const validator = createTopologyValidator({
    maxDepth: 5,
    maxFanout: 5,
    allowedPackIds: ["pack-a"],
  });

  assert.throws(
    () => validator.validate({
      currentDepth: 1,
      activeDelegations: 5, // Equals max - should fail
      targetPackId: "pack-a",
      delegationChain: [],
    }),
    DelegationFanoutExceededError,
  );
});

test("validate fails on cycle before checking packId", () => {
  const validator = createTopologyValidator({
    maxDepth: 5,
    maxFanout: 10,
    allowedPackIds: ["pack-a"], // pack-a is allowed
  });

  // But pack-a is in the chain, so cycle detection should fail first
  assert.throws(
    () => validator.validate({
      currentDepth: 1,
      activeDelegations: 5,
      targetPackId: "pack-a", // Same as in chain
      delegationChain: ["pack-a", "pack-b"],
    }),
    DelegationCycleDetectedError,
  );
});

test("validate fails on packId when depth and fanout are valid", () => {
  const validator = createTopologyValidator({
    maxDepth: 5,
    maxFanout: 10,
    allowedPackIds: ["allowed-pack"],
  });

  assert.throws(
    () => validator.validate({
      currentDepth: 1,
      activeDelegations: 3,
      targetPackId: "disallowed-pack",
      delegationChain: [],
    }),
    (err: Error & { code?: string }) => err.code === "delegation.pack_id_not_allowed",
  );
});

test("validate checks depth first in order", () => {
  const validator = createTopologyValidator({
    maxDepth: 2,
    maxFanout: 10,
    allowedPackIds: ["pack-a"],
  });

  // All constraints are violated, but depth should be checked first
  assert.throws(
    () => validator.validate({
      currentDepth: 5, // Exceeds maxDepth
      activeDelegations: 15, // Exceeds maxFanout
      targetPackId: "disallowed", // Not in allowedPackIds
      delegationChain: ["pack-a", "pack-a"], // Cycle
    }),
    DelegationDepthExceededError, // Should be first error
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Getters Return Correct Values
// ─────────────────────────────────────────────────────────────────────────────

test("getMaxDepth returns configured value", () => {
  const validator = createTopologyValidator({ maxDepth: 7 });

  assert.equal(validator.getMaxDepth(), 7);
});

test("getMaxFanout returns configured value", () => {
  const validator = createTopologyValidator({ maxFanout: 15 });

  assert.equal(validator.getMaxFanout(), 15);
});

test("getMaxDepth returns 0 when explicitly set", () => {
  const validator = new TopologyValidator({ maxDepth: 0, maxFanout: 10 });

  // With 0, any depth >= 0 will fail (since >= is used)
  assert.equal(validator.getMaxDepth(), 0);
  assert.throws(() => validator.validateDepth(0), DelegationDepthExceededError);
});

test("getMaxFanout returns 0 when explicitly set", () => {
  const validator = new TopologyValidator({ maxDepth: 10, maxFanout: 0 });

  // With 0, any fanout >= 0 will fail (since >= is used)
  assert.equal(validator.getMaxFanout(), 0);
  assert.throws(() => validator.validateFanout(0), DelegationFanoutExceededError);
});

// ─────────────────────────────────────────────────────────────────────────────
// Constructor Configuration Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("TopologyValidator handles undefined maxDepth in config", () => {
  const validator = new TopologyValidator({ maxDepth: undefined as unknown as number, maxFanout: 10 });

  // Should fall back to DEFAULT_MAX_DEPTH
  assert.equal(validator.getMaxDepth(), DEFAULT_MAX_DEPTH);
});

test("TopologyValidator handles undefined maxFanout in config", () => {
  const validator = new TopologyValidator({ maxDepth: 5, maxFanout: undefined as unknown as number });

  // Should fall back to DEFAULT_MAX_FANOUT
  assert.equal(validator.getMaxFanout(), DEFAULT_MAX_FANOUT);
});

test("TopologyValidator handles null allowedPackIds", () => {
  assert.doesNotThrow(() => {
    const validator = new TopologyValidator({
      maxDepth: 5,
      maxFanout: 10,
      allowedPackIds: null,
    });

    // Should allow any pack (no restrictions)
    validator.validatePackId("any-pack");
  });
});

test("createTopologyValidator preserves allowedPackIds from config", () => {
  const validator = createTopologyValidator({
    maxDepth: 5,
    maxFanout: 10,
    allowedPackIds: ["pack-x", "pack-y"],
  });

  validator.validatePackId("pack-x"); // Should not throw
  assert.throws(
    () => validator.validatePackId("pack-z"),
    (err: Error & { code?: string }) => err.code === "delegation.pack_id_not_allowed",
  );
});
