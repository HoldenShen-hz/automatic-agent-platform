import assert from "node:assert/strict";
import test from "node:test";

import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("api-external-support exports nowIso", () => {
  assert.ok(nowIso !== undefined);
  assert.equal(typeof nowIso, "function");
});

test("nowIso returns current time in ISO format", () => {
  const before = new Date().toISOString();
  const result = nowIso();
  const after = new Date().toISOString();
  assert.ok(result >= before, "nowIso should return a time >= before");
  assert.ok(result <= after, "nowIso should return a time <= after");
});
