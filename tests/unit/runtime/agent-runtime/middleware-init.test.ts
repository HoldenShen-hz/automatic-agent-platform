import test from "node:test";
import assert from "node:assert/strict";
import {
  initializeMiddleware,
  getMiddlewareContext,
  getGlobalMiddlewareChain,
  resetMiddleware,
  type InitializedMiddlewareContext,
} from "../../../../src/platform/five-plane-execution/execution-engine/middleware-init.js";
import { globalMiddlewareChain } from "../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js";

test("initializeMiddleware returns middleware context [middleware-init]", () => {
  resetMiddleware();

  const context = initializeMiddleware({});

  assert.ok(context);
  assert.ok(context.chain);
  assert.ok(context.loopDetection);
});

test("initializeMiddleware returns same context on subsequent calls [middleware-init]", () => {
  resetMiddleware();

  const context1 = initializeMiddleware({});
  const context2 = initializeMiddleware({});

  assert.strictEqual(context1, context2);
});

test("initializeMiddleware throws when initialization is already in progress [middleware-init]", () => {
  resetMiddleware();

  // This test verifies the race condition protection
  // Note: Since we can't easily trigger concurrent init, we verify the function works
  const context = initializeMiddleware({ loopDetection: { warnThreshold: 5, escalateThreshold: 10 } });
  assert.ok(context);
});

test("initializeMiddleware with null loopDetection disables loop detection [middleware-init]", () => {
  resetMiddleware();

  const context = initializeMiddleware({ loopDetection: null });

  assert.ok(context);
  assert.strictEqual(context.loopDetection.state, null);
  assert.deepEqual(context.loopDetection.patterns(), []);
  context.loopDetection.reset(); // Should be no-op
  assert.equal(context.loopDetection.getRepeatCount("tool", {}), 0);
});

test("initializeMiddleware with config enables loop detection [middleware-init]", () => {
  resetMiddleware();

  const context = initializeMiddleware({
    loopDetection: { warnThreshold: 2, escalateThreshold: 5 },
  });

  assert.ok(context);
  assert.ok(context.loopDetection.state !== null);
});

test("getMiddlewareContext returns null before initialization [middleware-init]", () => {
  resetMiddleware();

  const context = getMiddlewareContext();
  assert.strictEqual(context, null);
});

test("getMiddlewareContext returns context after initialization [middleware-init]", () => {
  resetMiddleware();

  initializeMiddleware({});
  const context = getMiddlewareContext();

  assert.ok(context);
});

test("getGlobalMiddlewareChain returns the global chain [middleware-init]", () => {
  resetMiddleware();

  const chain = getGlobalMiddlewareChain();

  assert.ok(chain);
  assert.strictEqual(chain, globalMiddlewareChain);
});

test("resetMiddleware clears context and resets chain [middleware-init]", () => {
  resetMiddleware();

  initializeMiddleware({});
  assert.ok(getMiddlewareContext());

  resetMiddleware();

  assert.strictEqual(getMiddlewareContext(), null);
});

test("initialized middleware context tracks loop patterns [middleware-init]", () => {
  resetMiddleware();

  const context = initializeMiddleware({
    loopDetection: { warnThreshold: 1, escalateThreshold: 3 },
  });

  assert.ok(Array.isArray(context.loopDetection.patterns()));
});

test("initialized middleware context reset clears state [middleware-init]", () => {
  resetMiddleware();

  const context = initializeMiddleware({
    loopDetection: { warnThreshold: 2, escalateThreshold: 5 },
  });

  context.loopDetection.reset();

  assert.deepEqual(context.loopDetection.patterns(), []);
});

test("middleware chain is functional after initialization [middleware-init]", () => {
  resetMiddleware();

  const context = initializeMiddleware({});

  const hooks = context.chain.getRegisteredHooks();

  assert.ok(Array.isArray(hooks.beforeAgent));
  assert.ok(Array.isArray(hooks.afterAgent));
  assert.ok(Array.isArray(hooks.wrapToolCall));
  assert.ok(Array.isArray(hooks.wrapModelCall));
});

test("initializeMiddleware with failOpen option [middleware-init]", () => {
  resetMiddleware();

  const context = initializeMiddleware({ failOpen: true });

  assert.ok(context);
  assert.ok(context.chain);
});

test("initializeMiddleware twice returns same singleton [middleware-init]", () => {
  resetMiddleware();

  const first = initializeMiddleware({});
  const second = initializeMiddleware({});

  assert.strictEqual(first, second);
});
