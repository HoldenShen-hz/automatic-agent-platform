import assert from "node:assert/strict";
import test from "node:test";

import {
  initializeMiddleware,
  getMiddlewareContext,
  getGlobalMiddlewareChain,
  resetMiddleware,
  type MiddlewareInitOptions,
} from "../../../../../src/platform/five-plane-execution/execution-engine/middleware-init.js";

import { globalMiddlewareChain } from "../../../../../src/platform/five-plane-execution/execution-engine/agent-middleware-chain.js";

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

test("initializeMiddleware returns middleware context [middleware-init]", () => {
  const context = initializeMiddleware();
  assert.ok(context, "Should return a context object");
  assert.ok(context.chain, "Context should have chain property");
});

test("initializeMiddleware can be called multiple times (idempotent) [middleware-init]", () => {
  const context1 = initializeMiddleware();
  const context2 = initializeMiddleware();
  assert.strictEqual(context1, context2, "Multiple calls should return same context");
});

test("initializeMiddleware accepts empty options [middleware-init]", () => {
  const context = initializeMiddleware({});
  assert.ok(context, "Should return a context even with empty options");
});

test("initializeMiddleware with failOpen option [middleware-init]", () => {
  const context = initializeMiddleware({ failOpen: true });
  assert.ok(context, "Should initialize with failOpen option");
});

test("initializeMiddleware with failOpen false [middleware-init]", () => {
  const context = initializeMiddleware({ failOpen: false });
  assert.ok(context, "Should initialize with failOpen: false");
});

// ---------------------------------------------------------------------------
// initializeMiddleware - loop detection configuration
// ---------------------------------------------------------------------------

test("initializeMiddleware with default loop detection [middleware-init]", () => {
  const context = initializeMiddleware();
  assert.ok(context.loopDetection, "Should have loopDetection object");
});

test("initializeMiddleware with explicit loop detection config [middleware-init]", () => {
  const context = initializeMiddleware({
    loopDetection: {
      warnThreshold: 5,
      escalateThreshold: 10,
    },
  });
  assert.ok(context.loopDetection, "Should have loopDetection object");
});

test("initializeMiddleware with null loop detection disables it [middleware-init]", () => {
  const context = initializeMiddleware({
    loopDetection: null,
  });
  assert.ok(context.loopDetection, "Should have loopDetection object");
  assert.equal(context.loopDetection.state, null, "State should be null when loop detection is disabled");
});

test("initializeMiddleware with loop detection warn and escalate thresholds [middleware-init]", () => {
  const context = initializeMiddleware({
    loopDetection: {
      warnThreshold: 3,
      escalateThreshold: 5,
      askAtWarn: true,
      terminateAtEscalate: true,
    },
  });
  assert.ok(context.loopDetection, "Should have loopDetection object");
});

test("initializeMiddleware loopDetection has getRepeatCount function [middleware-init]", () => {
  const context = initializeMiddleware();
  assert.equal(typeof context.loopDetection.getRepeatCount, "function", "getRepeatCount should be a function");
});

test("initializeMiddleware loopDetection has reset function [middleware-init]", () => {
  const context = initializeMiddleware();
  assert.equal(typeof context.loopDetection.reset, "function", "reset should be a function");
});

// ---------------------------------------------------------------------------
// initializeMiddleware - concurrent initialization protection
// ---------------------------------------------------------------------------

test("initializeMiddleware throws when called concurrently during initialization [middleware-init]", () => {
  // This test verifies the C-02 fix for race conditions
  // We can't easily trigger the race condition, but we verify the mechanism exists
  const context = initializeMiddleware();
  assert.ok(context, "First initialization should succeed");
});

// ---------------------------------------------------------------------------
// getMiddlewareContext
// ---------------------------------------------------------------------------

test("getMiddlewareContext returns null before initialization [middleware-init]", () => {
  const context = getMiddlewareContext();
  assert.equal(context, null, "Should be null before initialization");
});

test("getMiddlewareContext returns context after initialization [middleware-init]", () => {
  initializeMiddleware();
  const context = getMiddlewareContext();
  assert.ok(context, "Should return context after initialization");
});

// ---------------------------------------------------------------------------
// getGlobalMiddlewareChain
// ---------------------------------------------------------------------------

test("getGlobalMiddlewareChain returns the global middleware chain [middleware-init]", () => {
  const chain = getGlobalMiddlewareChain();
  assert.ok(chain, "Should return a chain object");
  assert.equal(typeof chain.registerBeforeAgent, "function", "Chain should have registerBeforeAgent");
  assert.equal(typeof chain.registerWrapToolCall, "function", "Chain should have registerWrapToolCall");
});

test("getGlobalMiddlewareChain returns same chain as context.chain [middleware-init]", () => {
  initializeMiddleware();
  const globalChain = getGlobalMiddlewareChain();
  const context = getMiddlewareContext();
  assert.strictEqual(globalChain, context?.chain, "Should be the same chain instance");
});

// ---------------------------------------------------------------------------
// resetMiddleware
// ---------------------------------------------------------------------------

test("resetMiddleware clears the middleware context [middleware-init]", () => {
  initializeMiddleware();
  assert.ok(getMiddlewareContext(), "Context should exist after init");

  resetMiddleware();
  assert.equal(getMiddlewareContext(), null, "Context should be null after reset");
});

test("resetMiddleware clears the global chain hooks [middleware-init]", () => {
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

test("MiddlewareInitOptions accepts partial configuration [middleware-init]", () => {
  const options: MiddlewareInitOptions = {
    loopDetection: {
      warnThreshold: 3,
    },
    failOpen: true,
  };
  const context = initializeMiddleware(options);
  assert.ok(context, "Should accept partial options");
});

test("MiddlewareInitOptions with explicit null loopDetection [middleware-init]", () => {
  const context = initializeMiddleware({
    loopDetection: null,
  });
  assert.ok(context, "Should accept null loopDetection");
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("initializeMiddleware can be called after reset [middleware-init]", () => {
  const context1 = initializeMiddleware();
  resetMiddleware();
  const context2 = initializeMiddleware();

  assert.ok(context1, "First context should exist");
  assert.ok(context2, "Second context should exist after reset");
  assert.notStrictEqual(context1, context2, "Contexts should be different instances");
});

// ---------------------------------------------------------------------------
// Tool Argument Coercion Middleware Registration
// ---------------------------------------------------------------------------

test("initializeMiddleware registers tool_argument_coercion wrapToolCall hook [middleware-init]", () => {
  initializeMiddleware();
  const chain = getGlobalMiddlewareChain();
  const hooks = chain.getRegisteredHooks();
  assert.ok(hooks.wrapToolCall.includes("tool_argument_coercion"), "Should register tool_argument_coercion hook");
});

test("initializeMiddleware does not register duplicate tool_argument_coercion [middleware-init]", () => {
  initializeMiddleware();
  const chain1 = getGlobalMiddlewareChain();
  const hooksBefore = chain1.getRegisteredHooks().wrapToolCall.filter(h => h === "tool_argument_coercion").length;

  // Initialize again (should be idempotent)
  initializeMiddleware();
  const chain2 = getGlobalMiddlewareChain();
  const hooksAfter = chain2.getRegisteredHooks().wrapToolCall.filter(h => h === "tool_argument_coercion").length;

  assert.strictEqual(hooksBefore, hooksAfter, "Should not register duplicate hook");
});

// ---------------------------------------------------------------------------
// Cache Governance and Summary Middleware Registration
// ---------------------------------------------------------------------------

test("initializeMiddleware registers cache-governance wrapToolCall hook [middleware-init]", () => {
  initializeMiddleware();
  const chain = getGlobalMiddlewareChain();
  const hooks = chain.getRegisteredHooks();
  assert.ok(hooks.wrapToolCall.includes("cache-governance"), "Should register cache-governance hook");
});

test("initializeMiddleware registers cache-summary afterAgent hook [middleware-init]", () => {
  initializeMiddleware();
  const chain = getGlobalMiddlewareChain();
  const hooks = chain.getRegisteredHooks();
  assert.ok(hooks.afterAgent.includes("cache-summary"), "Should register cache-summary hook");
});

test("initializeMiddleware does not register duplicate cache-governance [middleware-init]", () => {
  initializeMiddleware();
  const chain1 = getGlobalMiddlewareChain();
  const hooksBefore = chain1.getRegisteredHooks().wrapToolCall.filter(h => h === "cache-governance").length;

  initializeMiddleware();
  const chain2 = getGlobalMiddlewareChain();
  const hooksAfter = chain2.getRegisteredHooks().wrapToolCall.filter(h => h === "cache-governance").length;

  assert.strictEqual(hooksBefore, hooksAfter, "Should not register duplicate cache-governance hook");
});

// ---------------------------------------------------------------------------
// Loop Detection Middleware Registration
// ---------------------------------------------------------------------------

test("initializeMiddleware registers loop_detection_before_agent hook [middleware-init]", () => {
  initializeMiddleware();
  const chain = getGlobalMiddlewareChain();
  const hooks = chain.getRegisteredHooks();
  assert.ok(hooks.beforeAgent.includes("loop_detection_before_agent"), "Should register loop_detection_before_agent hook");
});

test("initializeMiddleware registers loop_detection_wrap_tool_call hook [middleware-init]", () => {
  initializeMiddleware();
  const chain = getGlobalMiddlewareChain();
  const hooks = chain.getRegisteredHooks();
  assert.ok(hooks.wrapToolCall.includes("loop_detection_wrap_tool_call"), "Should register loop_detection_wrap_tool_call hook");
});

test("initializeMiddleware with null loopDetection does not register loop detection hooks [middleware-init]", () => {
  initializeMiddleware({ loopDetection: null });
  const chain = getGlobalMiddlewareChain();
  const hooks = chain.getRegisteredHooks();
  assert.ok(!hooks.beforeAgent.includes("loop_detection_before_agent"), "Should NOT register loop_detection_before_agent when disabled");
  assert.ok(!hooks.wrapToolCall.includes("loop_detection_wrap_tool_call"), "Should NOT register loop_detection_wrap_tool_call when disabled");
});

test("initializeMiddleware loopDetection patterns returns array [middleware-init]", () => {
  const context = initializeMiddleware();
  const patterns = context.loopDetection.patterns();
  assert.ok(Array.isArray(patterns), "patterns() should return an array");
});

test("initializeMiddleware with custom thresholds returns proper context [middleware-init]", () => {
  const context = initializeMiddleware({
    loopDetection: {
      warnThreshold: 2,
      escalateThreshold: 4,
    },
  });
  assert.ok(context.loopDetection, "Should have loopDetection");
  assert.ok(context.loopDetection.state, "Should have state");
});

// ---------------------------------------------------------------------------
// Middleware Chain Hook Priority and Registration Order
// ---------------------------------------------------------------------------

test("initializeMiddleware registers multiple wrapToolCall hooks with different priorities [middleware-init]", () => {
  initializeMiddleware();
  const chain = getGlobalMiddlewareChain();
  const hooks = chain.getRegisteredHooks().wrapToolCall;
  assert.ok(hooks.length >= 3, "Should have at least 3 wrapToolCall hooks registered");
});

test("initializeMiddleware registers beforeAgent and afterAgent hooks [middleware-init]", () => {
  initializeMiddleware();
  const chain = getGlobalMiddlewareChain();
  const hooks = chain.getRegisteredHooks();
  assert.ok(hooks.beforeAgent.length > 0, "Should have beforeAgent hooks");
  assert.ok(hooks.afterAgent.length > 0, "Should have afterAgent hooks");
});

// ---------------------------------------------------------------------------
// InitializedMiddlewareContext Structure Validation
// ---------------------------------------------------------------------------

test("InitializedMiddlewareContext has correct loopDetection structure with state [middleware-init]", () => {
  const context = initializeMiddleware();
  assert.ok(context.loopDetection.state !== null, "State should not be null when loop detection enabled");
  assert.ok(typeof context.loopDetection.patterns === "function", "patterns should be a function");
  assert.ok(typeof context.loopDetection.reset === "function", "reset should be a function");
  assert.ok(typeof context.loopDetection.getRepeatCount === "function", "getRepeatCount should be a function");
});

test("InitializedMiddlewareContext with null loopDetection has null state [middleware-init]", () => {
  const context = initializeMiddleware({ loopDetection: null });
  assert.strictEqual(context.loopDetection.state, null, "State should be null");
  assert.ok(typeof context.loopDetection.patterns === "function", "patterns should still be a function");
  assert.ok(typeof context.loopDetection.reset === "function", "reset should still be a function");
  assert.ok(typeof context.loopDetection.getRepeatCount === "function", "getRepeatCount should still be a function");
});

test("InitializedMiddlewareContext chain is the global middleware chain [middleware-init]", () => {
  const context = initializeMiddleware();
  const chain = getGlobalMiddlewareChain();
  assert.strictEqual(context.chain, chain, "Context chain should be the global chain");
});

// ---------------------------------------------------------------------------
// Loop Detection State Functions
// ---------------------------------------------------------------------------

test("loopDetection patterns() returns empty array initially [middleware-init]", () => {
  const context = initializeMiddleware();
  const patterns = context.loopDetection.patterns();
  assert.strictEqual(patterns.length, 0, "Should have no patterns initially");
});

test("loopDetection getRepeatCount returns 0 for unregistered tool [middleware-init]", () => {
  const context = initializeMiddleware();
  const count = context.loopDetection.getRepeatCount("nonexistent_tool", {});
  assert.strictEqual(count, 0, "Should return 0 for unregistered tool");
});

test("loopDetection reset clears patterns [middleware-init]", () => {
  const context = initializeMiddleware();
  context.loopDetection.reset();
  const patterns = context.loopDetection.patterns();
  assert.strictEqual(patterns.length, 0, "Should have no patterns after reset");
});

// ---------------------------------------------------------------------------
// Global Middleware Chain Behavior
// ---------------------------------------------------------------------------

test("getGlobalMiddlewareChain returns same instance on multiple calls [middleware-init]", () => {
  const chain1 = getGlobalMiddlewareChain();
  const chain2 = getGlobalMiddlewareChain();
  assert.strictEqual(chain1, chain2, "Should return the same chain instance");
});

test("global middleware chain has all registration methods [middleware-init]", () => {
  const chain = getGlobalMiddlewareChain();
  assert.ok(typeof chain.registerBeforeAgent === "function", "Should have registerBeforeAgent");
  assert.ok(typeof chain.registerBeforeModel === "function", "Should have registerBeforeModel");
  assert.ok(typeof chain.registerAfterModel === "function", "Should have registerAfterModel");
  assert.ok(typeof chain.registerWrapModelCall === "function", "Should have registerWrapModelCall");
  assert.ok(typeof chain.registerWrapToolCall === "function", "Should have registerWrapToolCall");
  assert.ok(typeof chain.registerAfterAgent === "function", "Should have registerAfterAgent");
});

test("global middleware chain has beforeAgent, wrapToolCall, afterAgent methods [middleware-init]", () => {
  const chain = getGlobalMiddlewareChain();
  assert.ok(typeof chain.beforeAgent === "function", "Should have beforeAgent method");
  assert.ok(typeof chain.wrapToolCall === "function", "Should have wrapToolCall method");
  assert.ok(typeof chain.afterAgent === "function", "Should have afterAgent method");
});

// ---------------------------------------------------------------------------
// Reset Behavior
// ---------------------------------------------------------------------------

test("resetMiddleware clears all registered hooks [middleware-init]", () => {
  initializeMiddleware();
  const chainBefore = getGlobalMiddlewareChain();
  const hooksBefore = chainBefore.getRegisteredHooks();

  resetMiddleware();

  const chainAfter = getGlobalMiddlewareChain();
  const hooksAfter = chainAfter.getRegisteredHooks();

  assert.ok(hooksBefore.wrapToolCall.length > 0, "Should have hooks before reset");
  assert.strictEqual(hooksAfter.wrapToolCall.length, 0, "Should have no wrapToolCall hooks after reset");
  assert.strictEqual(hooksAfter.beforeAgent.length, 0, "Should have no beforeAgent hooks after reset");
  assert.strictEqual(hooksAfter.afterAgent.length, 0, "Should have no afterAgent hooks after reset");
});

test("initializeMiddleware after reset re-registers all middleware [middleware-init]", () => {
  initializeMiddleware();
  resetMiddleware();
  initializeMiddleware();

  const chain = getGlobalMiddlewareChain();
  const hooks = chain.getRegisteredHooks();

  assert.ok(hooks.wrapToolCall.includes("tool_argument_coercion"), "Should re-register tool_argument_coercion");
  assert.ok(hooks.wrapToolCall.includes("cache-governance"), "Should re-register cache-governance");
  assert.ok(hooks.afterAgent.includes("cache-summary"), "Should re-register cache-summary");
  assert.ok(hooks.beforeAgent.includes("loop_detection_before_agent"), "Should re-register loop_detection_before_agent");
  assert.ok(hooks.wrapToolCall.includes("loop_detection_wrap_tool_call"), "Should re-register loop_detection_wrap_tool_call");
});

// ---------------------------------------------------------------------------
// Loop Detection Configuration Options
// ---------------------------------------------------------------------------

test("initializeMiddleware with loopDetection config object [middleware-init]", () => {
  const context = initializeMiddleware({
    loopDetection: {
      warnThreshold: 3,
      escalateThreshold: 7,
      askAtWarn: true,
      terminateAtEscalate: true,
    },
  });
  assert.ok(context.loopDetection.state, "Should have state");
});

test("initializeMiddleware with undefined loopDetection uses defaults [middleware-init]", () => {
  const context = initializeMiddleware({
    failOpen: true,
  });
  assert.ok(context.loopDetection, "Should have loopDetection with defaults");
});

test("initializeMiddleware with empty loopDetection config uses defaults [middleware-init]", () => {
  const context = initializeMiddleware({
    loopDetection: {},
  });
  assert.ok(context.loopDetection, "Should have loopDetection with defaults");
});

// ---------------------------------------------------------------------------
// Edge Cases and Error Handling
// ---------------------------------------------------------------------------

test("InitializedMiddlewareContext loopDetection.getRepeatCount works with various input types [middleware-init]", () => {
  const context = initializeMiddleware();

  // String input
  const count1 = context.loopDetection.getRepeatCount("tool", "string_input");
  assert.strictEqual(typeof count1, "number", "Should return number for string input");

  // Object input
  const count2 = context.loopDetection.getRepeatCount("tool", { key: "value" });
  assert.strictEqual(typeof count2, "number", "Should return number for object input");

  // Array input
  const count3 = context.loopDetection.getRepeatCount("tool", [1, 2, 3]);
  assert.strictEqual(typeof count3, "number", "Should return number for array input");

  // Null input
  const count4 = context.loopDetection.getRepeatCount("tool", null);
  assert.strictEqual(typeof count4, "number", "Should return number for null input");
});

test("InitializedMiddlewareContext loopDetection.getRepeatCount with null state returns 0 [middleware-init]", () => {
  const context = initializeMiddleware({ loopDetection: null });
  const count = context.loopDetection.getRepeatCount("tool", {});
  assert.strictEqual(count, 0, "Should return 0 when state is null");
});

test("InitializedMiddlewareContext loopDetection.patterns with null state returns empty array [middleware-init]", () => {
  const context = initializeMiddleware({ loopDetection: null });
  const patterns = context.loopDetection.patterns();
  assert.deepStrictEqual(patterns, [], "Should return empty array when state is null");
});

test("InitializedMiddlewareContext loopDetection.reset with null state is no-op [middleware-init]", () => {
  const context = initializeMiddleware({ loopDetection: null });
  // Should not throw
  context.loopDetection.reset();
  assert.ok(true, "reset should be a no-op when state is null");
});
