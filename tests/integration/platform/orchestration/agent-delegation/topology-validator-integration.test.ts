/**
 * Integration Test: Topology Validator
 *
 * Tests the TopologyValidator which validates delegation topology constraints
 * including depth limits, fanout limits, and cycle detection.
 * These integration tests verify the validator works correctly when
 * integrated with delegation workflows.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import {
  TopologyValidator,
  createTopologyValidator,
  DelegationDepthExceededError,
  DelegationFanoutExceededError,
  DelegationCycleDetectedError,
  DEFAULT_MAX_DEPTH,
  DEFAULT_MAX_FANOUT,
} from "../../../../../src/platform/five-plane-orchestration/agent-delegation/topology-validator.js";

test("topology-validator: integration validates depth constraint with delegation workflow", () => {
  const ctx = createIntegrationContext("aa-topo-depth-");
  try {
    // Simulate a delegation chain with increasing depth
    const validator = createTopologyValidator({ maxDepth: 3 });

    // Depth 0 should be allowed
    validator.validateDepth(0);

    // Depth 1 should be allowed
    validator.validateDepth(1);

    // Depth 2 should be allowed (one less than max)
    validator.validateDepth(2);

    // Depth 3 should throw (equals max)
    assert.throws(
      () => validator.validateDepth(3),
      DelegationDepthExceededError,
    );

    // Depth 5 should throw (exceeds max)
    assert.throws(
      () => validator.validateDepth(5),
      DelegationDepthExceededError,
    );
  } finally {
    ctx.cleanup();
  }
});

test("topology-validator: integration validates fanout constraint with delegation workflow", () => {
  const ctx = createIntegrationContext("aa-topo-fanout-");
  try {
    // Simulate active delegations from a parent agent
    const validator = createTopologyValidator({ maxFanout: 5 });

    // 0 active delegations should be allowed
    validator.validateFanout(0);

    // 3 active delegations should be allowed
    validator.validateFanout(3);

    // 4 active delegations should be allowed (one less than max)
    validator.validateFanout(4);

    // 5 active delegations should throw (equals max)
    assert.throws(
      () => validator.validateFanout(5),
      DelegationFanoutExceededError,
    );

    // 10 active delegations should throw (exceeds max)
    assert.throws(
      () => validator.validateFanout(10),
      DelegationFanoutExceededError,
    );
  } finally {
    ctx.cleanup();
  }
});

test("topology-validator: integration detects cycle in delegation chain", () => {
  const ctx = createIntegrationContext("aa-topo-cycle-");
  try {
    const validator = createTopologyValidator();

    // Empty chain - no cycle possible
    validator.detectCycle("pack-new", []);

    // Single different pack - no cycle
    validator.detectCycle("pack-new", ["pack-a", "pack-b", "pack-c"]);

    // Target pack in chain - cycle detected
    assert.throws(
      () => validator.detectCycle("pack-b", ["pack-a", "pack-b", "pack-c"]),
      DelegationCycleDetectedError,
    );

    // Same pack at start and end - cycle detected
    assert.throws(
      () => validator.detectCycle("pack-a", ["pack-a", "pack-b", "pack-a"]),
      DelegationCycleDetectedError,
    );
  } finally {
    ctx.cleanup();
  }
});

test("topology-validator: integration validates pack ID against allowed list", () => {
  const ctx = createIntegrationContext("aa-topo-packid-");
  try {
    const validator = createTopologyValidator({
      maxDepth: 5,
      maxFanout: 10,
      allowedPackIds: ["allowed-pack-a", "allowed-pack-b", "allowed-pack-c"],
    });

    // Allowed pack should pass
    validator.validatePackId("allowed-pack-a");
    validator.validatePackId("allowed-pack-b");
    validator.validatePackId("allowed-pack-c");

    // Disallowed pack should throw
    assert.throws(
      () => validator.validatePackId("disallowed-pack"),
      (err: Error & { code?: string }) => err.code === "delegation.pack_id_not_allowed",
    );

    // Case sensitive - different case should fail
    assert.throws(
      () => validator.validatePackId("ALLOWED-PACK-A"),
      (err: Error & { code?: string }) => err.code === "delegation.pack_id_not_allowed",
    );
  } finally {
    ctx.cleanup();
  }
});

test("topology-validator: integration performs full topology validation", () => {
  assert.doesNotThrow(() => {
    const ctx = createIntegrationContext("aa-topo-full-");
    try {
      const validator = createTopologyValidator({
        maxDepth: 3,
        maxFanout: 5,
        allowedPackIds: ["pack-a", "pack-b"],
      });

      // Valid topology - all constraints satisfied
      validator.validate({
        currentDepth: 1,
        activeDelegations: 2,
        targetPackId: "pack-a",
        delegationChain: ["pack-root"],
      });

      // Should not throw
    } finally {
      ctx.cleanup();
    }
  });
});

test("topology-validator: integration fails on depth in full validation", () => {
  const ctx = createIntegrationContext("aa-topo-full-depth-");
  try {
    const validator = createTopologyValidator({
      maxDepth: 2,
      maxFanout: 10,
      allowedPackIds: ["pack-a"],
    });

    // Depth equals max - should fail
    assert.throws(
      () => validator.validate({
        currentDepth: 2,
        activeDelegations: 1,
        targetPackId: "pack-a",
        delegationChain: [],
      }),
      DelegationDepthExceededError,
    );
  } finally {
    ctx.cleanup();
  }
});

test("topology-validator: integration fails on fanout in full validation", () => {
  const ctx = createIntegrationContext("aa-topo-full-fanout-");
  try {
    const validator = createTopologyValidator({
      maxDepth: 5,
      maxFanout: 3,
      allowedPackIds: ["pack-a"],
    });

    // Fanout equals max - should fail
    assert.throws(
      () => validator.validate({
        currentDepth: 1,
        activeDelegations: 3,
        targetPackId: "pack-a",
        delegationChain: [],
      }),
      DelegationFanoutExceededError,
    );
  } finally {
    ctx.cleanup();
  }
});

test("topology-validator: integration fails on cycle in full validation", () => {
  const ctx = createIntegrationContext("aa-topo-full-cycle-");
  try {
    const validator = createTopologyValidator({
      maxDepth: 5,
      maxFanout: 10,
      allowedPackIds: ["pack-a"],
    });

    // Cycle detected - pack-a already in chain
    assert.throws(
      () => validator.validate({
        currentDepth: 1,
        activeDelegations: 1,
        targetPackId: "pack-a",
        delegationChain: ["pack-a", "pack-b"],
      }),
      DelegationCycleDetectedError,
    );
  } finally {
    ctx.cleanup();
  }
});

test("topology-validator: integration fails on disallowed pack ID in full validation", () => {
  const ctx = createIntegrationContext("aa-topo-full-pack-");
  try {
    const validator = createTopologyValidator({
      maxDepth: 5,
      maxFanout: 10,
      allowedPackIds: ["only-allowed"],
    });

    // Pack ID not in allowed list
    assert.throws(
      () => validator.validate({
        currentDepth: 1,
        activeDelegations: 1,
        targetPackId: "not-allowed",
        delegationChain: [],
      }),
      (err: Error & { code?: string }) => err.code === "delegation.pack_id_not_allowed",
    );
  } finally {
    ctx.cleanup();
  }
});

test("topology-validator: integration with default configuration", () => {
  const ctx = createIntegrationContext("aa-topo-default-");
  try {
    const validator = createTopologyValidator();

    // Should use DEFAULT_MAX_DEPTH (3)
    assert.equal(validator.getMaxDepth(), DEFAULT_MAX_DEPTH);

    // Should use DEFAULT_MAX_FANOUT (10)
    assert.equal(validator.getMaxFanout(), DEFAULT_MAX_FANOUT);

    // Depth 2 should be allowed (less than 3)
    validator.validateDepth(2);

    // Depth 3 should throw (equals 3)
    assert.throws(
      () => validator.validateDepth(3),
      DelegationDepthExceededError,
    );
  } finally {
    ctx.cleanup();
  }
});

test("topology-validator: integration with custom configuration", () => {
  const ctx = createIntegrationContext("aa-topo-custom-");
  try {
    const validator = createTopologyValidator({
      maxDepth: 10,
      maxFanout: 20,
      allowedPackIds: ["custom-pack"],
    });

    assert.equal(validator.getMaxDepth(), 10);
    assert.equal(validator.getMaxFanout(), 20);

    // Custom limits should be respected
    validator.validateDepth(9); // Should pass
    assert.throws(() => validator.validateDepth(10), DelegationDepthExceededError);

    validator.validateFanout(19); // Should pass
    assert.throws(() => validator.validateFanout(20), DelegationFanoutExceededError);
  } finally {
    ctx.cleanup();
  }
});

test("topology-validator: integration handles complex delegation chain", () => {
  const ctx = createIntegrationContext("aa-topo-complex-");
  try {
    const validator = createTopologyValidator({ maxDepth: 5 });

    // Simulate a chain: root -> a -> b -> c -> d
    const chain = ["pack-root", "pack-a", "pack-b", "pack-c"];

    // New pack at depth 4 should be allowed (4 < 5)
    validator.validate({
      currentDepth: 4,
      activeDelegations: 1,
      targetPackId: "pack-d",
      delegationChain: chain,
    });

    // Same pack as root would create cycle
    assert.throws(
      () => validator.detectCycle("pack-root", chain),
      DelegationCycleDetectedError,
    );

    // New pack at depth 5 should fail (5 >= 5)
    assert.throws(
      () => validator.validate({
        currentDepth: 5,
        activeDelegations: 1,
        targetPackId: "pack-new",
        delegationChain: chain,
      }),
      DelegationDepthExceededError,
    );
  } finally {
    ctx.cleanup();
  }
});

test("topology-validator: integration error details contain correct information", () => {
  const ctx = createIntegrationContext("aa-topo-errors-");
  try {
    const depthError = new DelegationDepthExceededError(5, 3);
    assert.equal(depthError.code, "delegation.depth_exceeded");
    assert.ok(depthError.message.includes("5"));
    assert.ok(depthError.message.includes("3"));
    assert.deepEqual(depthError.details, { currentDepth: 5, maxDepth: 3 });

    const fanoutError = new DelegationFanoutExceededError(10, 5);
    assert.equal(fanoutError.code, "delegation.fanout_exceeded");
    assert.ok(fanoutError.message.includes("10"));
    assert.ok(fanoutError.message.includes("5"));
    assert.deepEqual(fanoutError.details, { currentFanout: 10, maxFanout: 5 });

    const cycleError = new DelegationCycleDetectedError("pack-x", ["a", "b", "pack-x"]);
    assert.equal(cycleError.code, "delegation.cycle_detected");
    assert.ok(cycleError.message.includes("pack-x"));
    assert.deepEqual(cycleError.details, { packId: "pack-x", chain: ["a", "b", "pack-x"] });
  } finally {
    ctx.cleanup();
  }
});

test("topology-validator: integration with zero limits", () => {
  const ctx = createIntegrationContext("aa-topo-zero-");
  try {
    const validator = createTopologyValidator({ maxDepth: 0, maxFanout: 0 });

    // Any depth >= 0 fails
    assert.throws(() => validator.validateDepth(0), DelegationDepthExceededError);
    assert.throws(() => validator.validateDepth(1), DelegationDepthExceededError);

    // Any fanout >= 0 fails
    assert.throws(() => validator.validateFanout(0), DelegationFanoutExceededError);
    assert.throws(() => validator.validateFanout(1), DelegationFanoutExceededError);
  } finally {
    ctx.cleanup();
  }
});

test("topology-validator: integration validation order is depth -> fanout -> cycle -> packId", () => {
  const ctx = createIntegrationContext("aa-topo-order-");
  try {
    const validator = createTopologyValidator({
      maxDepth: 2,
      maxFanout: 10,
      allowedPackIds: ["pack-a"],
    });

    // All constraints violated, but depth should fail first
    assert.throws(
      () => validator.validate({
        currentDepth: 5, // Exceeds maxDepth first
        activeDelegations: 15, // Also exceeds maxFanout
        targetPackId: "disallowed", // Also not in allowedPackIds
        delegationChain: ["pack-a", "pack-a"], // Also has cycle
      }),
      DelegationDepthExceededError, // Should be first error checked
    );
  } finally {
    ctx.cleanup();
  }
});

test("topology-validator: integration with empty allowed pack IDs list", () => {
  const ctx = createIntegrationContext("aa-topo-empty-packs-");
  try {
    const validator = createTopologyValidator({
      maxDepth: 5,
      maxFanout: 10,
      allowedPackIds: [],
    });

    // Empty allowedPackIds should reject any pack
    assert.throws(
      () => validator.validatePackId("any-pack"),
      (err: Error & { code?: string }) => err.code === "delegation.pack_id_not_allowed",
    );
  } finally {
    ctx.cleanup();
  }
});

test("topology-validator: integration getters return configured values", () => {
  const ctx = createIntegrationContext("aa-topo-getters-");
  try {
    const validator = new TopologyValidator({
      maxDepth: 7,
      maxFanout: 14,
      allowedPackIds: ["test-pack"],
    });

    assert.equal(validator.getMaxDepth(), 7);
    assert.equal(validator.getMaxFanout(), 14);

    // Test getters match configuration
    validator.validateDepth(6); // Should pass (6 < 7)
    assert.throws(() => validator.validateDepth(7), DelegationDepthExceededError);

    validator.validateFanout(13); // Should pass (13 < 14)
    assert.throws(() => validator.validateFanout(14), DelegationFanoutExceededError);
  } finally {
    ctx.cleanup();
  }
});
