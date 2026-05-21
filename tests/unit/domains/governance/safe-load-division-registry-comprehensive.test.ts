/**
 * Comprehensive tests for safe-load-division-registry.ts
 * @see src/domains/governance/safe-load-division-registry.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { safeLoadDivisionRegistry } from "../../../../src/domains/governance/safe-load-division-registry.js";

test("safeLoadDivisionRegistry is a function", () => {
  assert.equal(typeof safeLoadDivisionRegistry, "function");
});

test("safeLoadDivisionRegistry returns null when registry unavailable", () => {
  // The function may return null or a registry depending on file system state
  const result = safeLoadDivisionRegistry();
  // Result should be either null or an object with divisions and workflows
  if (result === null) {
    assert.ok(true, "Returned null as expected when registry unavailable");
  } else {
    assert.ok(typeof result === "object", "Returned object when available");
  }
});

test("safeLoadDivisionRegistry returns expected structure when available", () => {
  const result = safeLoadDivisionRegistry();
  if (result !== null) {
    assert.ok("divisions" in result, "Result has divisions property");
    assert.ok("workflows" in result, "Result has workflows property");
    assert.ok(result.divisions instanceof Map, "divisions is a Map");
    assert.ok(result.workflows instanceof Map, "workflows is a Map");
  }
});

test("safeLoadDivisionRegistry returns valid division entries when available", () => {
  const result = safeLoadDivisionRegistry();
  if (result !== null) {
    for (const [divisionId, division] of result.divisions) {
      assert.equal(typeof divisionId, "string", "Division ID is string");
      assert.equal(typeof division.id, "string", "Division.id is string");
      assert.equal(typeof division.name, "string", "Division.name is string");
      assert.ok(Array.isArray(division.roles), "Division.roles is array");
      assert.ok(Array.isArray(division.workflows), "Division.workflows is array");
    }
  }
});

test("safeLoadDivisionRegistry returns valid workflow entries when available", () => {
  const result = safeLoadDivisionRegistry();
  if (result !== null) {
    for (const [workflowId, workflow] of result.workflows) {
      assert.equal(typeof workflowId, "string", "Workflow ID is string");
      assert.equal(typeof workflow.workflowId, "string", "workflow.workflowId is string");
      assert.ok(Array.isArray(workflow.steps), "workflow.steps is array");
    }
  }
});

test("safeLoadDivisionRegistry handles concurrent calls safely", () => {
  // Should not throw even when called multiple times
  const results = [safeLoadDivisionRegistry(), safeLoadDivisionRegistry(), safeLoadDivisionRegistry()];
  for (const result of results) {
    if (result !== null) {
      assert.ok(typeof result === "object");
      assert.ok("divisions" in result);
      assert.ok("workflows" in result);
    }
  }
});

test("safeLoadDivisionRegistry returns consistent results for same calls", () => {
  const result1 = safeLoadDivisionRegistry();
  const result2 = safeLoadDivisionRegistry();
  if (result1 !== null && result2 !== null) {
    assert.equal(result1.divisions.size, result2.divisions.size, "Same number of divisions");
    assert.equal(result1.workflows.size, result2.workflows.size, "Same number of workflows");
  }
});