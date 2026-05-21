import test from "node:test";
import assert from "node:assert/strict";
import {
  initializeMiddleware,
  getMiddlewareContext,
  getGlobalMiddlewareChain,
  resetMiddleware,
  type MiddlewareInitOptions,
  type InitializedMiddlewareContext,
} from "../../../../src/platform/five-plane-execution/execution-engine/middleware-init.js";

test("initializeMiddleware returns middleware context with loop detection", () => {
  resetMiddleware(); // Ensure clean state

  const ctx = initializeMiddleware({
    loopDetection: { warnThreshold: 3, escalateThreshold: 5 },
  });

  assert.ok(ctx.chain != null);
  assert.ok(ctx.loopDetection.state != null);
  assert.equal(typeof ctx.loopDetection.patterns, "function");
  assert.equal(typeof ctx.loopDetection.reset, "function");
  assert.equal(typeof ctx.loopDetection.getRepeatCount, "function");
});

test("initializeMiddleware returns null loopDetection state when loopConfig is null", () => {
  resetMiddleware();

  const ctx = initializeMiddleware({
    loopDetection: null,
  });

  assert.ok(ctx.chain != null);
  assert.equal(ctx.loopDetection.state, null);
  assert.deepEqual(ctx.loopDetection.patterns(), []);
  ctx.loopDetection.reset(); // Should be no-op
  assert.equal(ctx.loopDetection.getRepeatCount("tool", {}), 0);
});

test("initializeMiddleware is idempotent - returns same context on repeated calls", () => {
  resetMiddleware();

  const ctx1 = initializeMiddleware({});
  const ctx2 = initializeMiddleware({});

  assert.strictEqual(ctx1, ctx2);
});

test("getMiddlewareContext returns null before initialization", () => {
  resetMiddleware();
  assert.equal(getMiddlewareContext(), null);
});

test("getMiddlewareContext returns context after initialization", () => {
  resetMiddleware();

  initializeMiddleware({});
  const ctx = getMiddlewareContext();

  assert.ok(ctx != null);
});

test("getGlobalMiddlewareChain returns the global middleware chain", () => {
  resetMiddleware();

  const ctx = initializeMiddleware({});
  const chain = getGlobalMiddlewareChain();

  assert.ok(chain != null);
  assert.strictEqual(chain, ctx.chain);
});

test("resetMiddleware clears context", () => {
  resetMiddleware();

  initializeMiddleware({});
  assert.ok(getMiddlewareContext() != null);

  resetMiddleware();
  assert.equal(getMiddlewareContext(), null);
});

test("resetMiddleware allows re-initialization with different options", () => {
  resetMiddleware();

  const ctx1 = initializeMiddleware({
    loopDetection: { warnThreshold: 3, escalateThreshold: 5 },
  });
  const state1 = ctx1.loopDetection.state;
  resetMiddleware();

  const ctx2 = initializeMiddleware({
    loopDetection: { warnThreshold: 10, escalateThreshold: 20 },
  });

  // Should get a fresh loop detection state
  assert.ok(ctx2.loopDetection.state != null);
  assert.notStrictEqual(ctx2.loopDetection.state, state1);
});

test("initializeMiddleware registers loop detection hooks when config provided", () => {
  resetMiddleware();

  const ctx = initializeMiddleware({
    loopDetection: { warnThreshold: 2, escalateThreshold: 4 },
  });

  const hooks = ctx.chain.getRegisteredHooks();
  assert.ok(hooks.beforeAgent.length > 0);
  assert.ok(hooks.wrapToolCall.length > 0);
});

test("MiddlewareInitOptions accepts loopDetection, failOpen", () => {
  resetMiddleware();

  const options: MiddlewareInitOptions = {
    loopDetection: { warnThreshold: 3, escalateThreshold: 5 },
    failOpen: true,
  };

  const ctx = initializeMiddleware(options);
  assert.ok(ctx.chain != null);
});

test("InitializedMiddlewareContext has correct structure", () => {
  resetMiddleware();

  const ctx = initializeMiddleware({});

  // Verify structure
  assert.ok(ctx.chain != null);
  assert.ok(typeof ctx.loopDetection === "object");
  assert.ok(typeof ctx.loopDetection.state === "object" || ctx.loopDetection.state === null);
  assert.ok(typeof ctx.loopDetection.patterns === "function");
  assert.ok(typeof ctx.loopDetection.reset === "function");
  assert.ok(typeof ctx.loopDetection.getRepeatCount === "function");
});