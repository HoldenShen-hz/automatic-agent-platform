/**
 * Unit tests for domains/governance/index.ts barrel exports
 *
 * @see src/domains/governance/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  parseLimitedYaml,
  throwDivisionValidationError,
  throwDivisionWorkflowError,
  throwDivisionSandboxError,
  expectNonEmptyString,
  isPlainObject,
  toInteger,
  toStringArray,
  toObjectArray,
  DEFAULT_DIVISIONS_ROOT,
  type RawDivisionConfig,
  type RawDivisionRoleConfig,
  type RawWorkflowConfig,
  type RawWorkflowStepConfig,
  type SandboxPolicy,
} from "../../../../src/domains/governance/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// parseLimitedYaml
// ─────────────────────────────────────────────────────────────────────────────

test("parseLimitedYaml parses valid YAML", () => {
  const result = parseLimitedYaml("key: value", "test.yaml");
  assert.equal(result.key, "value");
});

test("parseLimitedYaml parses nested YAML", () => {
  const result = parseLimitedYaml("outer:\n  inner: value", "test.yaml");
  assert.equal(result.outer.inner, "value");
});

test("parseLimitedYaml returns plain object", () => {
  const result = parseLimitedYaml("a: 1\nb: 2", "test.yaml");
  assert.ok(isPlainObject(result));
});

test("parseLimitedYaml handles empty string", () => {
  const result = parseLimitedYaml("", "test.yaml");
  assert.ok(isPlainObject(result));
});

test("parseLimitedYaml handles malformed YAML without throwing", () => {
  // parseLimitedYaml uses tokenizeYaml which filters lines - malformed YAML may not throw
  const result = parseLimitedYaml("key: [unclosed", "test.yaml");
  assert.ok(isPlainObject(result));
});

// ─────────────────────────────────────────────────────────────────────────────
// isPlainObject
// ─────────────────────────────────────────────────────────────────────────────

test("isPlainObject returns true for plain objects", () => {
  assert.equal(isPlainObject({}), true);
  assert.equal(isPlainObject({ a: 1 }), true);
});

test("isPlainObject returns false for arrays", () => {
  assert.equal(isPlainObject([]), false);
  assert.equal(isPlainObject([1, 2, 3]), false);
});

test("isPlainObject returns false for null", () => {
  assert.equal(isPlainObject(null), false);
});

test("isPlainObject returns false for non-objects", () => {
  assert.equal(isPlainObject("string"), false);
  assert.equal(isPlainObject(123), false);
  assert.equal(isPlainObject(undefined), false);
});

// ─────────────────────────────────────────────────────────────────────────────
// expectNonEmptyString
// ─────────────────────────────────────────────────────────────────────────────

test("expectNonEmptyString returns value when valid", () => {
  assert.equal(expectNonEmptyString("test", "error.code"), "test");
  assert.equal(expectNonEmptyString("  trimmed  ", "error.code"), "trimmed"); // trims whitespace
});

test("expectNonEmptyString throws when value is empty", () => {
  assert.throws(() => expectNonEmptyString("", "error.empty"));
  assert.throws(() => expectNonEmptyString("   ", "error.whitespace"));
});

test("expectNonEmptyString throws with correct error code", () => {
  try {
    expectNonEmptyString("", "my.error.code");
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("my.error.code"));
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// toInteger
// ─────────────────────────────────────────────────────────────────────────────

test("toInteger parses valid integer strings", () => {
  assert.equal(toInteger("123", 0), 123);
  assert.equal(toInteger("0", 0), 0);
  assert.equal(toInteger("42", -1), 42);
});

test("toInteger returns default for non-numeric strings", () => {
  assert.equal(toInteger("abc", 99), 99);
  assert.equal(toInteger("", 99), 99);
});

test("toInteger handles floating point numbers", () => {
  // toInteger only matches integers, so "12.34" returns the fallback
  assert.equal(toInteger("12.34", 0), 0); // "12.34" doesn't match integer pattern
});

// ─────────────────────────────────────────────────────────────────────────────
// toStringArray
// ─────────────────────────────────────────────────────────────────────────────

test("toStringArray returns array as-is for string arrays", () => {
  assert.deepEqual(toStringArray(["a", "b"]), ["a", "b"]);
});

test("toStringArray returns empty array for non-array input", () => {
  // toStringArray only processes arrays - strings return empty array
  assert.deepEqual(toStringArray("single"), []);
});

test("toStringArray returns empty array for undefined", () => {
  assert.deepEqual(toStringArray(undefined), []);
});

test("toStringArray handles mixed input", () => {
  assert.deepEqual(toStringArray(["item1", "item2"]), ["item1", "item2"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// toObjectArray
// ─────────────────────────────────────────────────────────────────────────────

test("toObjectArray returns array as-is", () => {
  const input = [{ a: 1 }, { b: 2 }];
  assert.deepEqual(toObjectArray(input), input);
});

test("toObjectArray returns empty array for undefined", () => {
  assert.deepEqual(toObjectArray(undefined), []);
  assert.deepEqual(toObjectArray(null), []);
});

test("toObjectArray returns empty array for non-array input", () => {
  assert.deepEqual(toObjectArray("string"), []);
  assert.deepEqual(toObjectArray(123), []);
});

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT_DIVISIONS_ROOT
// ─────────────────────────────────────────────────────────────────────────────

test("DEFAULT_DIVISIONS_ROOT is a string", () => {
  assert.equal(typeof DEFAULT_DIVISIONS_ROOT, "string");
});

test("DEFAULT_DIVISIONS_ROOT is not empty", () => {
  assert.ok(DEFAULT_DIVISIONS_ROOT.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Type exports
// ─────────────────────────────────────────────────────────────────────────────

test("RawDivisionConfig accepts valid structure", () => {
  const config: RawDivisionConfig = {
    id: "division-1",
    version: "1.0",
    name: "Test Division",
    description: "A test division",
    priority: 100,
    default_workflow: "wf-1",
    triggers: ["trigger-1"],
    roles: [],
  };
  assert.equal(config.id, "division-1");
});

test("RawDivisionRoleConfig accepts valid structure", () => {
  const role: RawDivisionRoleConfig = {
    id: "role-1",
    name: "Test Role",
    prompt: "/path/to/prompt.txt",
    model: "balanced",
    tools: ["tool-a"],
  };
  assert.equal(role.id, "role-1");
  assert.equal(role.model, "balanced");
});

test("RawWorkflowConfig accepts valid structure", () => {
  const wf: RawWorkflowConfig = {
    id: "wf-1",
    division_id: "division-1",
    steps: [],
  };
  assert.equal(wf.id, "wf-1");
  assert.equal(wf.division_id, "division-1");
});

test("RawWorkflowStepConfig accepts valid structure", () => {
  const step: RawWorkflowStepConfig = {
    step_id: "step-1",
    role_id: "role-1",
    input_keys: ["input-a"],
    output_key: "output-a",
  };
  assert.equal(step.step_id, "step-1");
  assert.equal(step.role_id, "role-1");
});

test("SandboxPolicy is properly structured", () => {
  const policy: SandboxPolicy = {
    policyId: "policy-1",
    mode: "read_only",
    allowedRoots: ["/allowed"],
    deniedRoots: [],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
  };
  assert.equal(policy.policyId, "policy-1");
  assert.equal(policy.mode, "read_only");
  assert.ok(Array.isArray(policy.allowedRoots));
});

// ─────────────────────────────────────────────────────────────────────────────
// Error throwing functions (verify they throw)
// ─────────────────────────────────────────────────────────────────────────────

test("throwDivisionValidationError throws with code and details", () => {
  assert.throws(() => throwDivisionValidationError("test.code", { key: "value" }));
});

test("throwDivisionWorkflowError throws with code and details", () => {
  assert.throws(() => throwDivisionWorkflowError("workflow.error", { workflowId: "wf-1" }));
});

test("throwDivisionSandboxError throws with code and details", () => {
  assert.throws(() => throwDivisionSandboxError("sandbox.denied", { path: "/test" }));
});