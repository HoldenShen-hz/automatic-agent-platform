import test from "node:test";
import assert from "node:assert/strict";
import { HARNESS_PLANNER_ROLE } from "../../../../../src/platform/orchestration/harness/planner/index.js";

/**
 * Tests for src/platform/orchestration/harness/planner/index.ts
 *
 * This module exports HARNESS_PLANNER_ROLE, which is a string constant
 * used to identify the planner role within the harness system.
 */

test("HARNESS_PLANNER_ROLE is a string literal 'planner'", () => {
  assert.equal(HARNESS_PLANNER_ROLE, "planner");
  assert.equal(typeof HARNESS_PLANNER_ROLE, "string");
});

test("HARNESS_PLANNER_ROLE is not an empty string", () => {
  assert.ok(HARNESS_PLANNER_ROLE.length > 0, "HARNESS_PLANNER_ROLE should not be empty");
});

test("HARNESS_PLANNER_ROLE matches expected role identifier pattern", () => {
  // Role identifiers follow a specific naming pattern
  assert.ok(/^[a-z][a-z_]*$/.test(HARNESS_PLANNER_ROLE), "should match lowercase with underscores pattern");
});

test("HARNESS_PLANNER_ROLE can be used in role comparison", () => {
  const stepRole = "planner";

  // Direct equality check - the primary use case
  assert.equal(HARNESS_PLANNER_ROLE === stepRole, true, "should match planner role string");

  // In array membership check
  const validRoles = ["planner", "generator", "evaluator", "hitl_operator", "loop_controller"];
  assert.ok(validRoles.includes(HARNESS_PLANNER_ROLE), "should be a valid harness role");
});

test("HARNESS_PLANNER_ROLE works with HarnessRole type checks", () => {
  // Define a type guard pattern that would be used in the codebase
  const isPlannerRole = (role: string): boolean => role === HARNESS_PLANNER_ROLE;

  assert.equal(isPlannerRole("planner"), true);
  assert.equal(isPlannerRole("generator"), false);
  assert.equal(isPlannerRole(""), false);
});

test("HARNESS_PLANNER_ROLE integrates with HarnessRole type", () => {
  // HarnessRole union type from the harness index
  type HarnessRole = "planner" | "generator" | "evaluator" | "hitl_operator" | "loop_controller";

  // Type-level assertion that HARNESS_PLANNER_ROLE is a valid HarnessRole
  const role: HarnessRole = HARNESS_PLANNER_ROLE;
  assert.equal(role, "planner");
});

test("HARNESS_PLANNER_ROLE has expected length", () => {
  assert.equal(HARNESS_PLANNER_ROLE.length, 7, "'planner' has 7 characters");
});

test("HARNESS_PLANNER_ROLE char codes are correct", () => {
  // 'p' = 112, 'l' = 108, 'a' = 97, 'n' = 110, 'n' = 110, 'e' = 101, 'r' = 114
  assert.equal(HARNESS_PLANNER_ROLE.charCodeAt(0), 112);
  assert.equal(HARNESS_PLANNER_ROLE.charCodeAt(1), 108);
  assert.equal(HARNESS_PLANNER_ROLE.charCodeAt(2), 97);
  assert.equal(HARNESS_PLANNER_ROLE.charCodeAt(3), 110);
  assert.equal(HARNESS_PLANNER_ROLE.charCodeAt(4), 110);
  assert.equal(HARNESS_PLANNER_ROLE.charCodeAt(5), 101);
  assert.equal(HARNESS_PLANNER_ROLE.charCodeAt(6), 114);
});

test("HARNESS_PLANNER_ROLE substring and slice operations work correctly", () => {
  assert.equal(HARNESS_PLANNER_ROLE.substring(0, 3), "pla");
  assert.equal(HARNESS_PLANNER_ROLE.slice(-3), "ner");
  assert.equal(HARNESS_PLANNER_ROLE.split("").join(""), "planner");
});

test("HARNESS_PLANNER_ROLE is case sensitive", () => {
  assert.notEqual(HARNESS_PLANNER_ROLE, "Planner");
  assert.notEqual(HARNESS_PLANNER_ROLE, "PLANNER");
  assert.notEqual(HARNESS_PLANNER_ROLE, "planne");
});

test("HARNESS_PLANNER_ROLE can be used in switch statements for role routing", () => {
  const getRoleDescription = (role: string): string => {
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

  assert.equal(getRoleDescription(HARNESS_PLANNER_ROLE), "Creates execution plans");
});

test("HARNESS_PLANNER_ROLE works with Object.keys on role objects", () => {
  // Common pattern: building a map of roles
  const rolePriorities: Record<string, number> = {
    planner: 1,
    generator: 2,
    evaluator: 3,
    hitl_operator: 4,
    loop_controller: 5,
  };

  assert.equal(rolePriorities[HARNESS_PLANNER_ROLE], 1);
});

test("HARNESS_PLANNER_ROLE is distinct from HARNESS_GENERATOR_ROLE", async () => {
  const { HARNESS_GENERATOR_ROLE } = await import("../../../../../src/platform/orchestration/harness/generator/index.js");

  assert.notEqual(HARNESS_PLANNER_ROLE, HARNESS_GENERATOR_ROLE, "planner and generator roles should be different");
  assert.equal(HARNESS_PLANNER_ROLE, "planner");
  assert.equal(HARNESS_GENERATOR_ROLE, "generator");
});

test("HARNESS_PLANNER_ROLE is distinct from other harness roles", async () => {
  const { HARNESS_GENERATOR_ROLE } = await import("../../../../../src/platform/orchestration/harness/generator/index.js");
  const { HARNESS_PLANNER_ROLE: PLANNER_ROLE } = await import("../../../../../src/platform/orchestration/harness/planner/index.js");

  // These should all be different from planner
  const otherRoles = [
    { name: "generator", role: HARNESS_GENERATOR_ROLE },
    { name: "evaluator", role: "evaluator" },
    { name: "hitl_operator", role: "hitl_operator" },
    { name: "loop_controller", role: "loop_controller" },
  ];

  for (const { name, role } of otherRoles) {
    assert.notEqual(PLANNER_ROLE, role, `planner should be different from ${name}`);
  }
});

test("HARNESS_PLANNER_ROLE value is stable across module reloads", async () => {
  const { HARNESS_PLANNER_ROLE: role1 } = await import("../../../../../src/platform/orchestration/harness/planner/index.js");
  const { HARNESS_PLANNER_ROLE: role2 } = await import("../../../../../src/platform/orchestration/harness/planner/index.js");

  assert.equal(role1, role2, "constant should be identical across imports");
  assert.equal(role1, "planner");
});
