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

test("DEFAULT_MAX_DEPTH is 3", () => {
  assert.equal(DEFAULT_MAX_DEPTH, 3);
});

test("DEFAULT_MAX_FANOUT is 10", () => {
  assert.equal(DEFAULT_MAX_FANOUT, 10);
});

test("TopologyValidator.validateDepth throws when depth equals max", () => {
  const validator = new TopologyValidator({ maxDepth: 3, maxFanout: 10 });
  
  assert.throws(
    () => validator.validateDepth(3),
    DelegationDepthExceededError,
  );
});

test("TopologyValidator.validateDepth allows depth below max", () => {
  const validator = new TopologyValidator({ maxDepth: 3, maxFanout: 10 });
  
  validator.validateDepth(2); // Should not throw
});

test("TopologyValidator.validateDepth throws when depth exceeds max", () => {
  const validator = new TopologyValidator({ maxDepth: 3, maxFanout: 10 });
  
  assert.throws(
    () => validator.validateDepth(5),
    DelegationDepthExceededError,
  );
});

test("TopologyValidator.validateFanout throws when fanout equals max", () => {
  const validator = new TopologyValidator({ maxDepth: 3, maxFanout: 10 });
  
  assert.throws(
    () => validator.validateFanout(10),
    DelegationFanoutExceededError,
  );
});

test("TopologyValidator.validateFanout allows fanout below max", () => {
  const validator = new TopologyValidator({ maxDepth: 3, maxFanout: 10 });
  
  validator.validateFanout(9); // Should not throw
});

test("TopologyValidator.validateFanout throws when fanout exceeds max", () => {
  const validator = new TopologyValidator({ maxDepth: 3, maxFanout: 10 });
  
  assert.throws(
    () => validator.validateFanout(15),
    DelegationFanoutExceededError,
  );
});

test("TopologyValidator.detectCycle throws when packId in chain", () => {
  const validator = new TopologyValidator({ maxDepth: 3, maxFanout: 10 });
  
  assert.throws(
    () => validator.detectCycle("pack-1", ["pack-1", "pack-2", "pack-3"]),
    DelegationCycleDetectedError,
  );
});

test("TopologyValidator.detectCycle allows new packId", () => {
  const validator = new TopologyValidator({ maxDepth: 3, maxFanout: 10 });
  
  validator.detectCycle("pack-4", ["pack-1", "pack-2", "pack-3"]); // Should not throw
});

test("TopologyValidator.detectCycle allows empty chain", () => {
  const validator = new TopologyValidator({ maxDepth: 3, maxFanout: 10 });
  
  validator.detectCycle("pack-1", []); // Should not throw
});

test("TopologyValidator.validatePackId throws when packId not allowed", () => {
  const validator = new TopologyValidator({
    maxDepth: 3,
    maxFanout: 10,
    allowedPackIds: ["allowed-pack-1", "allowed-pack-2"],
  });
  
  assert.throws(
    () => validator.validatePackId("forbidden-pack"),
    (err: unknown) => (err as { code: string }).code === "delegation.pack_id_not_allowed",
  );
});

test("TopologyValidator.validatePackId allows allowed packId", () => {
  const validator = new TopologyValidator({
    maxDepth: 3,
    maxFanout: 10,
    allowedPackIds: ["allowed-pack-1"],
  });
  
  validator.validatePackId("allowed-pack-1"); // Should not throw
});

test("TopologyValidator.validatePackId allows when no restriction", () => {
  const validator = new TopologyValidator({ maxDepth: 3, maxFanout: 10 });
  
  validator.validatePackId("any-pack"); // Should not throw
});

test("TopologyValidator.validate performs full validation", () => {
  const validator = new TopologyValidator({ maxDepth: 3, maxFanout: 10 });
  
  validator.validate({
    currentDepth: 1,
    activeDelegations: 5,
    targetPackId: "pack-new",
    delegationChain: ["pack-root"],
  }); // Should not throw
});

test("TopologyValidator.validate detects depth exceeded", () => {
  const validator = new TopologyValidator({ maxDepth: 2, maxFanout: 10 });
  
  assert.throws(
    () => validator.validate({
      currentDepth: 2,
      activeDelegations: 5,
      targetPackId: "pack-new",
      delegationChain: [],
    }),
    DelegationDepthExceededError,
  );
});

test("TopologyValidator.validate detects fanout exceeded", () => {
  const validator = new TopologyValidator({ maxDepth: 3, maxFanout: 5 });
  
  assert.throws(
    () => validator.validate({
      currentDepth: 1,
      activeDelegations: 5,
      targetPackId: "pack-new",
      delegationChain: [],
    }),
    DelegationFanoutExceededError,
  );
});

test("TopologyValidator.validate detects cycle", () => {
  const validator = new TopologyValidator({ maxDepth: 3, maxFanout: 10 });
  
  assert.throws(
    () => validator.validate({
      currentDepth: 1,
      activeDelegations: 1,
      targetPackId: "pack-1",
      delegationChain: ["pack-1", "pack-2"],
    }),
    DelegationCycleDetectedError,
  );
});

test("TopologyValidator.getMaxDepth returns configured value", () => {
  const validator = new TopologyValidator({ maxDepth: 5, maxFanout: 10 });
  
  assert.equal(validator.getMaxDepth(), 5);
});

test("TopologyValidator.getMaxFanout returns configured value", () => {
  const validator = new TopologyValidator({ maxDepth: 3, maxFanout: 20 });
  
  assert.equal(validator.getMaxFanout(), 20);
});

test("createTopologyValidator uses defaults", () => {
  const validator = createTopologyValidator();
  
  assert.equal(validator.getMaxDepth(), DEFAULT_MAX_DEPTH);
  assert.equal(validator.getMaxFanout(), DEFAULT_MAX_FANOUT);
});

test("createTopologyValidator allows custom config", () => {
  const validator = createTopologyValidator({ maxDepth: 5, maxFanout: 15 });
  
  assert.equal(validator.getMaxDepth(), 5);
  assert.equal(validator.getMaxFanout(), 15);
});

test("createTopologyValidator passes allowedPackIds", () => {
  const validator = createTopologyValidator({
    maxDepth: 3,
    maxFanout: 10,
    allowedPackIds: ["pack-a", "pack-b"],
  });
  
  // Should allow pack-a
  validator.validatePackId("pack-a"); // Does not throw
  
  // Should reject pack-c
  assert.throws(
    () => validator.validatePackId("pack-c"),
    (err: unknown) => (err as { code: string }).code === "delegation.pack_id_not_allowed",
  );
});

test("DelegationDepthExceededError has correct properties", () => {
  const error = new DelegationDepthExceededError(5, 3);
  
  assert.equal(error.code, "delegation.depth_exceeded");
  assert.ok(error.message.includes("5"));
  assert.ok(error.message.includes("3"));
  assert.deepEqual(error.details, { currentDepth: 5, maxDepth: 3 });
});

test("DelegationFanoutExceededError has correct properties", () => {
  const error = new DelegationFanoutExceededError(15, 10);
  
  assert.equal(error.code, "delegation.fanout_exceeded");
  assert.ok(error.message.includes("15"));
  assert.ok(error.message.includes("10"));
  assert.deepEqual(error.details, { currentFanout: 15, maxFanout: 10 });
});

test("DelegationCycleDetectedError has correct properties", () => {
  const error = new DelegationCycleDetectedError("pack-1", ["pack-1", "pack-2"]);
  
  assert.equal(error.code, "delegation.cycle_detected");
  assert.ok(error.message.includes("pack-1"));
  assert.deepEqual(error.details, { packId: "pack-1", chain: ["pack-1", "pack-2"] });
});
