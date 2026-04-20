import assert from "node:assert/strict";
import test from "node:test";

import {
  TopologyValidator,
  createTopologyValidator,
  DelegationDepthExceededError,
  DelegationFanoutExceededError,
  DelegationCycleDetectedError,
} from "../../../../../src/platform/orchestration/agent-delegation/topology-validator.js";
import type { DelegationOptions } from "../../../../../src/platform/orchestration/agent-delegation/delegation-types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Topology Validator Tests
// ─────────────────────────────────────────────────────────────────────────────

test("TopologyValidator rejects depth exceeding MAX_DEPTH", () => {
  const validator = createTopologyValidator({ maxDepth: 3, maxFanout: 10 });

  // Depth 0, 1, 2 should pass (valid depths)
  validator.validateDepth(0);
  validator.validateDepth(1);
  validator.validateDepth(2);

  // Depth 3 should fail
  assert.throws(
    () => validator.validateDepth(3),
    DelegationDepthExceededError,
  );

  assert.throws(
    () => validator.validateDepth(5),
    DelegationDepthExceededError,
  );
});

test("TopologyValidator rejects fanout exceeding MAX_FANOUT", () => {
  const validator = createTopologyValidator({ maxDepth: 5, maxFanout: 3 });

  // Fanout 0, 1, 2 should pass
  validator.validateFanout(0);
  validator.validateFanout(1);
  validator.validateFanout(2);

  // Fanout 3 should fail
  assert.throws(
    () => validator.validateFanout(3),
    DelegationFanoutExceededError,
  );

  assert.throws(
    () => validator.validateFanout(10),
    DelegationFanoutExceededError,
  );
});

test("TopologyValidator detects cycles in delegation chain", () => {
  const validator = createTopologyValidator({ maxDepth: 5, maxFanout: 10 });

  const chain = ["pack-a", "pack-b", "pack-c"];

  // pack-d is not in chain, should pass
  validator.detectCycle("pack-d", chain);

  // pack-b IS in chain, should throw
  assert.throws(
    () => validator.detectCycle("pack-b", chain),
    DelegationCycleDetectedError,
  );
});

test("TopologyValidator validates pack_id against allowed list", () => {
  const validator = createTopologyValidator({
    maxDepth: 5,
    maxFanout: 10,
    allowedPackIds: ["pack-a", "pack-b"],
  });

  // pack-a is allowed
  validator.validatePackId("pack-a");
  validator.validatePackId("pack-b");

  // pack-c is not in allowed list
  assert.throws(
    () => validator.validatePackId("pack-c"),
    Error,
  );
});

test("TopologyValidator allows any pack_id when allowedPackIds not set", () => {
  const validator = createTopologyValidator({ maxDepth: 5, maxFanout: 10 });

  // Should not throw for any pack ID
  validator.validatePackId("any-pack");
  validator.validatePackId("another-pack");
});

test("TopologyValidator full validate() checks all constraints", () => {
  const validator = createTopologyValidator({ maxDepth: 3, maxFanout: 5 });

  // Valid case
  validator.validate({
    currentDepth: 1,
    activeDelegations: 2,
    targetPackId: "pack-new",
    delegationChain: ["pack-a", "pack-b"],
  });

  // Invalid depth
  assert.throws(
    () => validator.validate({
      currentDepth: 3,
      activeDelegations: 2,
      targetPackId: "pack-new",
      delegationChain: [],
    }),
    DelegationDepthExceededError,
  );

  // Invalid fanout
  assert.throws(
    () => validator.validate({
      currentDepth: 1,
      activeDelegations: 5,
      targetPackId: "pack-new",
      delegationChain: [],
    }),
    DelegationFanoutExceededError,
  );

  // Cycle detected
  assert.throws(
    () => validator.validate({
      currentDepth: 1,
      activeDelegations: 2,
      targetPackId: "pack-b",
      delegationChain: ["pack-a", "pack-b"],
    }),
    DelegationCycleDetectedError,
  );
});

test("TopologyValidator getters return configured values", () => {
  const validator = createTopologyValidator({ maxDepth: 7, maxFanout: 15 });

  assert.equal(validator.getMaxDepth(), 7);
  assert.equal(validator.getMaxFanout(), 15);
});

test("TopologyValidator uses defaults when not specified", () => {
  const validator = createTopologyValidator({});

  assert.equal(validator.getMaxDepth(), 3);
  assert.equal(validator.getMaxFanout(), 10);
});

test("DelegationDepthExceededError contains correct data", () => {
  const error = new DelegationDepthExceededError(5, 3);

  assert.equal(error.code, "delegation.depth_exceeded");
  assert.ok(error.message.includes("5"));
  assert.ok(error.message.includes("3"));
});

test("DelegationFanoutExceededError contains correct data", () => {
  const error = new DelegationFanoutExceededError(10, 5);

  assert.equal(error.code, "delegation.fanout_exceeded");
  assert.ok(error.message.includes("10"));
  assert.ok(error.message.includes("5"));
});

test("DelegationCycleDetectedError contains cycle information", () => {
  const error = new DelegationCycleDetectedError("pack-b", ["pack-a", "pack-b", "pack-c"]);

  assert.equal(error.code, "delegation.cycle_detected");
  assert.ok(error.message.includes("pack-b"));
});