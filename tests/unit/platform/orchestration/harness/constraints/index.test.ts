import assert from "node:assert/strict";
import test from "node:test";

import type { ConstraintPack } from "../../../../../../src/platform/orchestration/harness/constraints/index.js";

test("ConstraintPack type can be used as interface", () => {
  const pack: ConstraintPack = {
    maxRetries: 3,
    timeoutMs: 30000,
  };
  assert.equal(pack.maxRetries, 3);
  assert.equal(pack.timeoutMs, 30000);
});

test("ConstraintPack allows additional constraint fields", () => {
  const pack: ConstraintPack = {
    maxRetries: 5,
    timeoutMs: 60000,
    allowedTools: ["web-search", "calculator"],
    blockedTools: ["delete-file"],
  };
  assert.equal(pack.maxRetries, 5);
  assert.ok(Array.isArray(pack.allowedTools));
  assert.ok(Array.isArray(pack.blockedTools));
});

test("ConstraintPack can be empty object", () => {
  const pack: ConstraintPack = {};
  assert.ok(pack != null);
});

test("ConstraintPack type is exported correctly", () => {
  // This test just verifies the type is exported and usable
  const useConstraintPack = (pack: ConstraintPack): number => pack.maxRetries ?? 0;
  assert.equal(useConstraintPack({ maxRetries: 10 }), 10);
});