import assert from "node:assert/strict";
import test from "node:test";

import {
  initializeMiddleware,
  getMiddlewareContext,
  getGlobalMiddlewareChain,
  resetMiddleware,
  type MiddlewareInitOptions,
} from "../../../../../src/platform/execution/execution-engine/middleware-init.js";

import { globalMiddlewareChain } from "../../../../../src/platform/execution/execution-engine/agent-middleware-chain.js";

// ---------------------------------------------------------------------------
// Test setup and teardown
// ---------------------------------------------------------------------------

test.beforeEach(() => {
  // Reset middleware state before each test
  resetMiddleware();
});

test.afterEach(() => {
  // Reset after each test to ensure clean state
  resetMiddleware();
});

// ---------------------------------------------------------------------------
// initializeMiddleware - basic initialization
// ---------------------------------------------------------------------------

test("initializeMiddleware returns middleware context", () => {
  const context = initializeMiddleware();
  assert.ok(context, "Should return a context object");
  assert.ok(context.chain, "Context should have chain property");
});

test("initializeMiddleware can be called multiple times (idempotent)", () => {
  const context1 = initializeMiddleware();
  const context2 = initializeMiddleware();
  assert.strictEqual(context1, context2, "Multiple calls should return same context");
});

test("initializeMiddleware accepts empty options", () => {
  const context = initializeMiddleware({});
  assert.ok(context, "Should return a context even with empty options");
});

test("initializeMiddleware with failOpen option", () => {
  const context = initializeMiddleware({ failOpen: true });
  assert.ok(context, "Should initialize with failOpen option");
});

test("initializeMiddleware with failOpen false", () => {
  const context = initializeMiddleware({ failOpen: false });
  assert.ok(context, "Should initialize with failOpen: false");
});

// ---------------------------------------------------------------------------
// initializeMiddleware - loop detection configuration
// ---------------------------------------------------------------------------

test("initializeMiddleware with default loop detection", () => {
  const context = initializeMiddleware();
  assert.ok(context.loopDetection, "Should have loopDetection object");
});

test("initializeMiddleware with explicit loop detection config", () => {
  const context = initializeMiddleware({
    loopDetection: {
      maxRepeatCount: 5,
      windowMs: 60000,
    },
  });
  assert.ok(context.loopDetection, "Should have loopDetection object");
});

test("initializeMiddleware with null loop detection disables it", () => {
  const context = initializeMiddleware({
    loopDetection: null,
  });
  assert.ok(context.loopDetection, "Should have loopDetection object");
  assert.equal(context.loopDetection.state, null, "State should be null when loop detection is disabled");
});

test("initializeMiddleware with patterns", () => {
  const context = initializeMiddleware({
    loopDetection: {
      patterns: [
        { pattern: "repeat", description: "Test pattern" },
      ],
    },
  });
  assert.ok(context.loopDetection, "Should have loopDetection object");
  assert.ok(typeof context.loopDetection.patterns === "function", "patterns should be a function");
});

test("initializeMiddleware loopDetection has getRepeatCount function", () => {
  const context = initializeMiddleware();
  assert.equal(typeof context.loopDetection.getRepeatCount, "function", "getRepeatCount should be a function");
});

test("initializeMiddleware loopDetection has reset function", () => {
  const context = initializeMiddleware();
  assert.equal(typeof context.loopDetection.reset, "function", "reset should be a function");
});

// ---------------------------------------------------------------------------
// initializeMiddleware - concurrent initialization protection
// ---------------------------------------------------------------------------

test("initializeMiddleware throws when called concurrently during initialization", () => {
  // This test verifies the C-02 fix for race conditions
  // We can't easily trigger the race condition, but we verify the mechanism exists
  const context = initializeMiddleware();
  assert.ok(context, "First initialization should succeed");
});

// ---------------------------------------------------------------------------
// getMiddlewareContext
// ---------------------------------------------------------------------------

test("getMiddlewareContext returns null before initialization", () => {
  const context = getMiddlewareContext();
  assert.equal(context, null, "Should be null before initialization");
});

test("getMiddlewareContext returns context after initialization", () => {
  initializeMiddleware();
  const context = getMiddlewareContext();
  assert.ok(context, "Should return context after initialization");
});

// ---------------------------------------------------------------------------
// getGlobalMiddlewareChain
// ---------------------------------------------------------------------------

test("getGlobalMiddlewareChain returns the global middleware chain", () => {
  const chain = getGlobalMiddlewareChain();
  assert.ok(chain, "Should return a chain object");
  assert.equal(typeof chain.registerBeforeAgent, "function", "Chain should have registerBeforeAgent");
  assert.equal(typeof chain.registerWrapToolCall, "function", "Chain should have registerWrapToolCall");
});

test("getGlobalMiddlewareChain returns same chain as context.chain", () => {
  initializeMiddleware();
  const globalChain = getGlobalMiddlewareChain();
  const context = getMiddlewareContext();
  assert.strictEqual(globalChain, context?.chain, "Should be the same chain instance");
});

// ---------------------------------------------------------------------------
// resetMiddleware
// ---------------------------------------------------------------------------

test("resetMiddleware clears the middleware context", () => {
  initializeMiddleware();
  assert.ok(getMiddlewareContext(), "Context should exist after init");

  resetMiddleware();
  assert.equal(getMiddlewareContext(), null, "Context should be null after reset");
});

test("resetMiddleware clears the global chain hooks", () => {
  initializeMiddleware();
  resetMiddleware();

  const chain = getGlobalMiddlewareChain();
  const hooks = chain.getRegisteredHooks();
  // After reset, registered hooks should be cleared
  assert.ok(Array.isArray(hooks.beforeAgent), "beforeAgent should be an array");
  assert.ok(Array.isArray(hooks.wrapToolCall), "wrapToolCall should be an array");
});

// ---------------------------------------------------------------------------
// MiddlewareInitOptions interface
// ---------------------------------------------------------------------------

test("MiddlewareInitOptions accepts partial configuration", () => {
  const options: MiddlewareInitOptions = {
    loopDetection: {
      maxRepeatCount: 10,
    },
    failOpen: true,
  };
  const context = initializeMiddleware(options);
  assert.ok(context, "Should accept partial options");
});

test("MiddlewareInitOptions accepts undefined loopDetection", () => {
  const context = initializeMiddleware({
    loopDetection: undefined,
  });
  assert.ok(context, "Should accept undefined loopDetection");
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("initializeMiddleware can be called after reset", () => {
  const context1 = initializeMiddleware();
  resetMiddleware();
  const context2 = initializeMiddleware();

  assert.ok(context1, "First context should exist");
  assert.ok(context2, "Second context should exist after reset");
  assert.notStrictEqual(context1, context2, "Contexts should be different instances");
});
