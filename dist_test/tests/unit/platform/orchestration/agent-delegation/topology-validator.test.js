/**
 * TopologyValidator Unit Tests
 *
 * Tests for:
 * - Depth validation
 * - Fanout validation
 * - Cycle detection
 * - Pack ID validation
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createTopologyValidator, DelegationDepthExceededError, DelegationFanoutExceededError, DelegationCycleDetectedError, DEFAULT_MAX_DEPTH, DEFAULT_MAX_FANOUT, } from "../../../../../src/platform/orchestration/agent-delegation/topology-validator.js";
// ─────────────────────────────────────────────────────────────────────────────
// Configuration Tests
// ─────────────────────────────────────────────────────────────────────────────
test("createTopologyValidator uses default values", () => {
    const validator = createTopologyValidator();
    assert.equal(validator.getMaxDepth(), DEFAULT_MAX_DEPTH);
    assert.equal(validator.getMaxFanout(), DEFAULT_MAX_FANOUT);
});
test("createTopologyValidator accepts custom config", () => {
    const validator = createTopologyValidator({
        maxDepth: 7,
        maxFanout: 15,
    });
    assert.equal(validator.getMaxDepth(), 7);
    assert.equal(validator.getMaxFanout(), 15);
});
test("createTopologyValidator accepts allowedPackIds", () => {
    const validator = createTopologyValidator({
        maxDepth: 5,
        maxFanout: 10,
        allowedPackIds: ["pack-a", "pack-b"],
    });
    // pack-a should be allowed
    validator.validatePackId("pack-a");
    // pack-c should throw
    assert.throws(() => validator.validatePackId("pack-c"), (err) => err.message.includes("not in the allowed delegation list"));
});
// ─────────────────────────────────────────────────────────────────────────────
// Depth Validation Tests
// ─────────────────────────────────────────────────────────────────────────────
test("validateDepth allows depth below maximum", () => {
    const validator = createTopologyValidator({ maxDepth: 3 });
    // Depth 2 should be allowed (since 2 < 3)
    validator.validateDepth(2);
    // No error means success
});
test("validateDepth throws when depth equals maximum", () => {
    const validator = createTopologyValidator({ maxDepth: 3 });
    assert.throws(() => validator.validateDepth(3), (err) => {
        return err instanceof DelegationDepthExceededError &&
            err.message.includes("exceeds maximum");
    });
});
test("validateDepth throws when depth exceeds maximum", () => {
    const validator = createTopologyValidator({ maxDepth: 3 });
    assert.throws(() => validator.validateDepth(5), (err) => {
        return err instanceof DelegationDepthExceededError;
    });
});
test("DelegationDepthExceededError contains correct details", () => {
    const err = new DelegationDepthExceededError(5, 3);
    assert.equal(err.code, "delegation.depth_exceeded");
    assert.ok(err.message.includes("5"));
    assert.ok(err.message.includes("3"));
});
// ─────────────────────────────────────────────────────────────────────────────
// Fanout Validation Tests
// ─────────────────────────────────────────────────────────────────────────────
test("validateFanout allows fanout below maximum", () => {
    const validator = createTopologyValidator({ maxFanout: 10 });
    // Fanout 9 should be allowed (since 9 < 10)
    validator.validateFanout(9);
    // No error means success
});
test("validateFanout throws when fanout equals maximum", () => {
    const validator = createTopologyValidator({ maxFanout: 10 });
    assert.throws(() => validator.validateFanout(10), (err) => {
        return err instanceof DelegationFanoutExceededError;
    });
});
test("validateFanout throws when fanout exceeds maximum", () => {
    const validator = createTopologyValidator({ maxFanout: 10 });
    assert.throws(() => validator.validateFanout(15), (err) => {
        return err instanceof DelegationFanoutExceededError;
    });
});
test("DelegationFanoutExceededError contains correct details", () => {
    const err = new DelegationFanoutExceededError(15, 10);
    assert.equal(err.code, "delegation.fanout_exceeded");
    assert.ok(err.message.includes("15"));
    assert.ok(err.message.includes("10"));
});
// ─────────────────────────────────────────────────────────────────────────────
// Cycle Detection Tests
// ─────────────────────────────────────────────────────────────────────────────
test("detectCycle allows non-cyclical chain", () => {
    const validator = createTopologyValidator();
    // chain is ["a", "b", "c"], adding "d" is fine
    validator.detectCycle("d", ["a", "b", "c"]);
    // No error means success
});
test("detectCycle throws when packId already in chain", () => {
    const validator = createTopologyValidator();
    assert.throws(() => validator.detectCycle("b", ["a", "b", "c"]), (err) => {
        return err instanceof DelegationCycleDetectedError;
    });
});
test("detectCycle throws for single-element cycle", () => {
    const validator = createTopologyValidator();
    assert.throws(() => validator.detectCycle("a", ["a"]), (err) => {
        return err instanceof DelegationCycleDetectedError;
    });
});
test("DelegationCycleDetectedError contains correct details", () => {
    const err = new DelegationCycleDetectedError("b", ["a", "b", "c"]);
    assert.equal(err.code, "delegation.cycle_detected");
    assert.ok(err.message.includes("b"));
});
// ─────────────────────────────────────────────────────────────────────────────
// Full Validation Tests
// ─────────────────────────────────────────────────────────────────────────────
test("validate performs all topology checks", () => {
    const validator = createTopologyValidator({
        maxDepth: 3,
        maxFanout: 10,
        allowedPackIds: ["pack-x"],
    });
    // Valid parameters should not throw
    validator.validate({
        currentDepth: 1,
        activeDelegations: 5,
        targetPackId: "pack-x",
        delegationChain: ["pack-a", "pack-b"],
    });
});
test("validate fails depth check", () => {
    const validator = createTopologyValidator({ maxDepth: 2 });
    assert.throws(() => validator.validate({
        currentDepth: 2,
        activeDelegations: 5,
        targetPackId: "any-pack",
        delegationChain: [],
    }), DelegationDepthExceededError);
});
test("validate fails fanout check", () => {
    const validator = createTopologyValidator({ maxFanout: 5 });
    assert.throws(() => validator.validate({
        currentDepth: 0,
        activeDelegations: 5,
        targetPackId: "any-pack",
        delegationChain: [],
    }), DelegationFanoutExceededError);
});
test("validate fails cycle check", () => {
    const validator = createTopologyValidator();
    assert.throws(() => validator.validate({
        currentDepth: 0,
        activeDelegations: 5,
        targetPackId: "pack-b",
        delegationChain: ["pack-a", "pack-b"],
    }), DelegationCycleDetectedError);
});
test("validate fails packId check", () => {
    const validator = createTopologyValidator({
        allowedPackIds: ["allowed-pack"],
    });
    assert.throws(() => validator.validate({
        currentDepth: 0,
        activeDelegations: 5,
        targetPackId: "disallowed-pack",
        delegationChain: [],
    }), (err) => err.message.includes("not_allowed"));
});
// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────
test("validateDepth allows depth 0", () => {
    const validator = createTopologyValidator({ maxDepth: 3 });
    validator.validateDepth(0); // No error
});
test("validateFanout allows fanout 0", () => {
    const validator = createTopologyValidator({ maxFanout: 10 });
    validator.validateFanout(0); // No error
});
test("detectCycle handles empty chain", () => {
    const validator = createTopologyValidator();
    validator.detectCycle("new-pack", []); // No error
});
test("validatePackId allows when no allowedPackIds configured", () => {
    const validator = createTopologyValidator();
    // Should not throw since no whitelist is enforced
    validator.validatePackId("any-pack");
});
//# sourceMappingURL=topology-validator.test.js.map