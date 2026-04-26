import assert from "node:assert/strict";
import test from "node:test";

import { safeLoadDivisionRegistry } from "../../../../src/domains/governance/safe-load-division-registry.js";

test("safeLoadDivisionRegistry is a function", () => {
  assert.equal(typeof safeLoadDivisionRegistry, "function");
});

test("safeLoadDivisionRegistry returns a registry object with divisions", () => {
  const result = safeLoadDivisionRegistry();
  assert.ok(result !== null);
  assert.ok(typeof result === "object");
  assert.ok("divisions" in result);
  assert.ok(result.divisions instanceof Map);
});

test("safeLoadDivisionRegistry returns divisions map", () => {
  const result = safeLoadDivisionRegistry();
  assert.ok(result !== null);
  assert.ok(result.divisions.size > 0);
});

test("safeLoadDivisionRegistry returns divisions with expected shape", () => {
  const result = safeLoadDivisionRegistry();
  assert.ok(result !== null);
  const firstDivision = result.divisions.values().next().value;
  assert.ok(firstDivision !== undefined);
  assert.equal(typeof firstDivision.id, "string");
  assert.equal(typeof firstDivision.name, "string");
});
