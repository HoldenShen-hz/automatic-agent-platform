import assert from "node:assert/strict";
import test from "node:test";

import * as stableChaosSmoke from "../../../../../src/platform/shared/stability/stable-chaos-smoke.js";

test("stable-chaos-smoke module exports something", () => {
  const exports = Object.keys(stableChaosSmoke);
  assert.ok(exports.length > 0, "stable-chaos-smoke should export something");
});

test("stable-chaos-smoke module exports chaos smoke related symbols", () => {
  // Check for any export that contains "Chaos" or "Smoke"
  const exports = Object.keys(stableChaosSmoke);
  const hasRelevantExport = exports.some(e => e.includes("Chaos") || e.includes("Smoke"));
  assert.ok(hasRelevantExport, `Expected export containing 'Chaos' or 'Smoke', got: ${exports.join(", ")}`);
});