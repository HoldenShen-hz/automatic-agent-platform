import test from "node:test";
import assert from "node:assert/strict";
import { HARNESS_GENERATOR_ROLE } from "../../../../../src/platform/orchestration/harness/generator/index.js";
/**
 * Tests for src/platform/orchestration/harness/generator/index.ts
 *
 * This module exports HARNESS_GENERATOR_ROLE, which is a string constant
 * used to identify the generator role within the harness system.
 */
test("HARNESS_GENERATOR_ROLE is a string literal 'generator'", () => {
    assert.equal(HARNESS_GENERATOR_ROLE, "generator");
    assert.equal(typeof HARNESS_GENERATOR_ROLE, "string");
});
test("HARNESS_GENERATOR_ROLE is not an empty string", () => {
    assert.ok(HARNESS_GENERATOR_ROLE.length > 0, "HARNESS_GENERATOR_ROLE should not be empty");
});
test("HARNESS_GENERATOR_ROLE matches expected role identifier pattern", () => {
    // Role identifiers follow a specific naming pattern
    assert.ok(/^[a-z][a-z_]*$/.test(HARNESS_GENERATOR_ROLE), "should match lowercase with underscores pattern");
});
test("HARNESS_GENERATOR_ROLE can be used in role comparison", () => {
    const stepRole = "generator";
    // Direct equality check - the primary use case
    assert.equal(HARNESS_GENERATOR_ROLE === stepRole, true, "should match generator role string");
    // In array membership check
    const validRoles = ["planner", "generator", "evaluator", "hitl_operator", "loop_controller"];
    assert.ok(validRoles.includes(HARNESS_GENERATOR_ROLE), "should be a valid harness role");
});
test("HARNESS_GENERATOR_ROLE works with HarnessRole type checks", () => {
    // Define a type guard pattern that would be used in the codebase
    const isGeneratorRole = (role) => role === HARNESS_GENERATOR_ROLE;
    assert.equal(isGeneratorRole("generator"), true);
    assert.equal(isGeneratorRole("planner"), false);
    assert.equal(isGeneratorRole(""), false);
});
test("HARNESS_GENERATOR_ROLE integrates with HarnessRole type", () => {
    // Type-level assertion that HARNESS_GENERATOR_ROLE is a valid HarnessRole
    const role = HARNESS_GENERATOR_ROLE;
    assert.equal(role, "generator");
});
test("HARNESS_GENERATOR_ROLE has expected length", () => {
    assert.equal(HARNESS_GENERATOR_ROLE.length, 9, "'generator' has 9 characters");
});
test("HARNESS_GENERATOR_ROLE char codes are correct", () => {
    // 'g' = 103, 'e' = 101, 'n' = 110, 'e' = 101, 'r' = 114, 'a' = 97, 't' = 116, 'o' = 111, 'r' = 114
    assert.equal(HARNESS_GENERATOR_ROLE.charCodeAt(0), 103);
    assert.equal(HARNESS_GENERATOR_ROLE.charCodeAt(1), 101);
    assert.equal(HARNESS_GENERATOR_ROLE.charCodeAt(2), 110);
    assert.equal(HARNESS_GENERATOR_ROLE.charCodeAt(3), 101);
    assert.equal(HARNESS_GENERATOR_ROLE.charCodeAt(4), 114);
    assert.equal(HARNESS_GENERATOR_ROLE.charCodeAt(5), 97);
    assert.equal(HARNESS_GENERATOR_ROLE.charCodeAt(6), 116);
    assert.equal(HARNESS_GENERATOR_ROLE.charCodeAt(7), 111);
    assert.equal(HARNESS_GENERATOR_ROLE.charCodeAt(8), 114);
});
test("HARNESS_GENERATOR_ROLE substring and slice operations work correctly", () => {
    assert.equal(HARNESS_GENERATOR_ROLE.substring(0, 3), "gen");
    assert.equal(HARNESS_GENERATOR_ROLE.slice(-3), "tor");
    assert.equal(HARNESS_GENERATOR_ROLE.split("").join(""), "generator");
});
test("HARNESS_GENERATOR_ROLE is case sensitive", () => {
    assert.notEqual(HARNESS_GENERATOR_ROLE, "Generator");
    assert.notEqual(HARNESS_GENERATOR_ROLE, "GENERATOR");
    assert.notEqual(HARNESS_GENERATOR_ROLE, "generate");
});
test("HARNESS_GENERATOR_ROLE can be used in switch statements for role routing", () => {
    const getRoleDescription = (role) => {
        switch (role) {
            case "planner":
                return "Creates execution plans";
            case "generator":
                return "Produces work products";
            case "evaluator":
                return "Assesses outcomes";
            case "hitl_operator":
                return "Handles human-in-the-loop";
            case "loop_controller":
                return "Manages iteration logic";
            default:
                return "Unknown role";
        }
    };
    assert.equal(getRoleDescription(HARNESS_GENERATOR_ROLE), "Produces work products");
});
test("HARNESS_GENERATOR_ROLE works with Object.keys on role objects", () => {
    // Common pattern: building a map of roles
    const rolePriorities = {
        planner: 1,
        generator: 2,
        evaluator: 3,
        hitl_operator: 4,
        loop_controller: 5,
    };
    assert.equal(rolePriorities[HARNESS_GENERATOR_ROLE], 2);
});
test("HARNESS_GENERATOR_ROLE is distinct from HARNESS_PLANNER_ROLE", async () => {
    const { HARNESS_PLANNER_ROLE } = await import("../../../../../src/platform/orchestration/harness/planner/index.js");
    assert.notEqual(HARNESS_GENERATOR_ROLE, HARNESS_PLANNER_ROLE, "generator and planner roles should be different");
    assert.equal(HARNESS_GENERATOR_ROLE, "generator");
    assert.equal(HARNESS_PLANNER_ROLE, "planner");
});
test("HARNESS_GENERATOR_ROLE is distinct from other harness roles", async () => {
    const { HARNESS_GENERATOR_ROLE: GENERATOR_ROLE } = await import("../../../../../src/platform/orchestration/harness/generator/index.js");
    const { HARNESS_PLANNER_ROLE } = await import("../../../../../src/platform/orchestration/harness/planner/index.js");
    // These should all be different from generator
    const otherRoles = [
        { name: "planner", role: HARNESS_PLANNER_ROLE },
        { name: "evaluator", role: "evaluator" },
        { name: "hitl_operator", role: "hitl_operator" },
        { name: "loop_controller", role: "loop_controller" },
    ];
    for (const { name, role } of otherRoles) {
        assert.notEqual(GENERATOR_ROLE, role, `generator should be different from ${name}`);
    }
});
test("HARNESS_GENERATOR_ROLE value is stable across module reloads", async () => {
    const { HARNESS_GENERATOR_ROLE: role1 } = await import("../../../../../src/platform/orchestration/harness/generator/index.js");
    const { HARNESS_GENERATOR_ROLE: role2 } = await import("../../../../../src/platform/orchestration/harness/generator/index.js");
    assert.equal(role1, role2, "constant should be identical across imports");
    assert.equal(role1, "generator");
});
//# sourceMappingURL=generator.test.js.map