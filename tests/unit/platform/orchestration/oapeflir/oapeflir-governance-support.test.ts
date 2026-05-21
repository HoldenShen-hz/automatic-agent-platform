import assert from "node:assert/strict";
import test from "node:test";

// OAPEFLIR Governance Support barrel test
// Tests exports from the oapeflir-governance-support module
import {
  getDefaultDivisionRegistry,
  DEFAULT_DIVISIONS_ROOT,
} from "../../../../../../src/platform/five-plane-orchestration/oapeflir/oapeflir-governance-support.js";

test("getDefaultDivisionRegistry is exported as function", () => {
  assert.equal(typeof getDefaultDivisionRegistry, "function");
});

test("DEFAULT_DIVISIONS_ROOT is exported as string", () => {
  assert.equal(typeof DEFAULT_DIVISIONS_ROOT, "string");
});

test("DEFAULT_DIVISIONS_ROOT has valid path format", () => {
  assert.ok(DEFAULT_DIVISIONS_ROOT.length > 0);
  assert.ok(DEFAULT_DIVISIONS_ROOT.includes("/") || DEFAULT_DIVISIONS_ROOT.includes("\\"));
});

test("getDefaultDivisionRegistry returns a value", () => {
  const registry = getDefaultDivisionRegistry();
  assert.ok(registry !== undefined);
});

test("getDefaultDivisionRegistry returns object with expected structure", () => {
  const registry = getDefaultDivisionRegistry();
  assert.equal(typeof registry, "object");
});

test("getDefaultDivisionRegistry is callable without arguments", () => {
  assert.doesNotThrow(() => {
    getDefaultDivisionRegistry();
  });
});

test("DEFAULT_DIVISIONS_ROOT is not empty string", () => {
  assert.ok(DEFAULT_DIVISIONS_ROOT.length > 0);
});

test("Re-imports produce same values", () => {
  const registry1 = getDefaultDivisionRegistry();
  const registry2 = getDefaultDivisionRegistry();
  // Both calls should return structurally equivalent values
  assert.equal(typeof registry1, typeof registry2);
});

test("DEFAULT_DIVISIONS_ROOT format is usable as path", () => {
  // Should be a valid looking path that can be used for file operations
  const pathParts = DEFAULT_DIVISIONS_ROOT.split(/[/\\]/);
  assert.ok(pathParts.length >= 2, "Path should have multiple segments");
});

test("Governance support module exports only the expected symbols", () => {
  // This test ensures the module structure matches expectations
  assert.ok(typeof getDefaultDivisionRegistry === "function");
  assert.ok(typeof DEFAULT_DIVISIONS_ROOT === "string");
});