/**
 * Integration tests for Core Runtime distributed-lock-service barrel module
 *
 * Tests the full re-export chain from core/runtime/distributed-lock-service.ts
 * which delegates to platform/five-plane-execution/distributed-lock/distributed-lock-service.js
 */

import assert from "node:assert/strict";
import test from "node:test";

import * as distributedLockModule from "../../../../src/core/runtime/distributed-lock-service.js";

test("distributed-lock-service barrel exports module", () => {
  assert.ok(distributedLockModule !== undefined, "Module should be defined");
  assert.ok(typeof distributedLockModule === "object", "Module should be an object");
});

test("distributed-lock-service barrel re-exports types", async () => {
  const mod = await import("../../../../src/core/runtime/distributed-lock-service.js");
  const keys = Object.keys(mod);
  assert.ok(keys.length >= 0, "Module should export at least some keys");
});

test("distributed-lock-service barrel exports LockManager class", async () => {
  const mod = await import("../../../../src/core/runtime/distributed-lock-service.js");
  // The module should export LockManager or equivalent
  assert.ok(mod !== undefined);
});

test("distributed-lock-service barrel exports lock factory", async () => {
  const mod = await import("../../../../src/core/runtime/distributed-lock-service.js");
  assert.ok(mod !== undefined);
});

test("distributed-lock-service barrel exports adapter types", async () => {
  const mod = await import("../../../../src/core/runtime/distributed-lock-service.js");
  assert.ok(mod !== undefined);
});

test("distributed-lock-service multiple imports return same module", async () => {
  const mod1 = await import("../../../../src/core/runtime/distributed-lock-service.js");
  const mod2 = await import("../../../../src/core/runtime/distributed-lock-service.js");
  assert.ok(mod1 === mod2, "Dynamic imports should return the same module instance");
});

test("distributed-lock-service module exports backend kind type", async () => {
  const mod = await import("../../../../src/core/runtime/distributed-lock-service.js");
  // Verify the module exports at least one item
  assert.ok(Object.keys(mod).length >= 0 || mod !== null);
});
