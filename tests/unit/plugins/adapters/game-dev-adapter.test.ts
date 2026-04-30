/**
 * Unit Tests: Game Dev Adapter
 *
 * Tests for issue #2014: Game dev adapter authenticate is no-op, execute no auth guard
 *
 * These tests verify the Game Dev Unity Cloud Build adapter's behavior including:
 * - No-op authenticate (issue #2014)
 * - No auth guard on execute (issue #2014)
 * - Plugin metadata
 * - Action execution
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createGameDevAdapterPlugin } from "../../../../src/plugins/adapters/game-dev-adapter.js";

// =============================================================================
// Issue #2014: authenticate is no-op - no credentials validated
// =============================================================================

test("GameDevAdapter.authenticate is no-op and accepts any credentials (issue #2014)", async () => {
  const adapter = createGameDevAdapterPlugin();

  // authenticate should NOT throw even with empty/missing credentials
  await adapter.authenticate({});
  await adapter.authenticate({ token: "unity-token-123" });
  await adapter.authenticate({ apiKey: "sk-unity-123" });
  await adapter.authenticate({ username: "dev", password: "secret" });

  // If we get here, the no-op behavior is confirmed
  assert.ok(true, "authenticate should accept any credentials without validation");
});

test("GameDevAdapter.authenticate accepts null/undefined params (issue #2014)", async () => {
  const adapter = createGameDevAdapterPlugin();

  // These should NOT throw due to no-op authenticate
  await adapter.authenticate({} as Record<string, unknown>);
  // @ts-ignore - testing runtime behavior
  await adapter.authenticate(null);
  // @ts-ignore - testing runtime behavior
  await adapter.authenticate(undefined);
});

// =============================================================================
// Issue #2014: execute has no auth guard
// =============================================================================

test("GameDevAdapter.execute has no auth guard and works without authenticate (issue #2014)", async () => {
  const adapter = createGameDevAdapterPlugin();

  // Execute should work WITHOUT calling authenticate first
  const result = await adapter.execute("get_build_status", {
    projectSlug: "my-project",
    buildTarget: "ios",
  });

  assert.equal(result.success, true);
  assert.equal((result.output as Record<string, unknown>).action, "get_build_status");
});

test("GameDevAdapter.execute works after authenticate is called (issue #2014)", async () => {
  const adapter = createGameDevAdapterPlugin();

  // Call authenticate first
  await adapter.authenticate({ token: "unity-token-123" });

  // Execute should still work (same behavior as without authenticate)
  const result = await adapter.execute("get_build_status", {
    projectSlug: "my-project",
    buildTarget: "android",
  });

  assert.equal(result.success, true);
  assert.equal((result.output as Record<string, unknown>).projectSlug, "my-project");
  assert.equal((result.output as Record<string, unknown>).buildTarget, "android");
});

// =============================================================================
// Plugin metadata tests
// =============================================================================

test("GameDevAdapter has correct plugin metadata", () => {
  const adapter = createGameDevAdapterPlugin();

  assert.equal(adapter.pluginId, "plugin.gamedev.unity_adapter");
  assert.equal(adapter.spiType, "adapter");
  assert.equal(adapter.adapterType, "unity_cloud_build");
});

test("GameDevAdapter has correct capabilityIds", () => {
  const adapter = createGameDevAdapterPlugin();

  assert.deepEqual(adapter.capabilityIds, ["build.status", "build.logs", "build.artifacts"]);
});

// =============================================================================
// Lifecycle method tests
// =============================================================================

test("GameDevAdapter.initialize returns undefined", async () => {
  const adapter = createGameDevAdapterPlugin();
  const result = await adapter.initialize();
  assert.equal(result, undefined);
});

test("GameDevAdapter.healthCheck returns true", async () => {
  const adapter = createGameDevAdapterPlugin();
  const result = await adapter.healthCheck();
  assert.equal(result, true);
});

test("GameDevAdapter.shutdown returns undefined", async () => {
  const adapter = createGameDevAdapterPlugin();
  const result = await adapter.shutdown();
  assert.equal(result, undefined);
});

// =============================================================================
// Execute action tests
// =============================================================================

test("GameDevAdapter.execute returns success with action", async () => {
  const adapter = createGameDevAdapterPlugin();

  const result = await adapter.execute("get_build_status", {
    projectSlug: "my-project",
    buildTarget: "ios",
  });

  assert.equal(result.success, true);
  assert.equal((result.output as Record<string, unknown>).action, "get_build_status");
  assert.equal((result.output as Record<string, unknown>).projectSlug, "my-project");
  assert.equal((result.output as Record<string, unknown>).buildTarget, "ios");
  assert.equal((result.output as Record<string, unknown>).status, "success");
});

test("GameDevAdapter.execute handles different actions", async () => {
  const adapter = createGameDevAdapterPlugin();

  const result = await adapter.execute("get_build_logs", {
    projectSlug: "other-project",
    buildTarget: "windows",
  });

  assert.equal(result.success, true);
  assert.equal((result.output as Record<string, unknown>).action, "get_build_logs");
});

test("GameDevAdapter.execute handles missing optional params", async () => {
  const adapter = createGameDevAdapterPlugin();

  const result = await adapter.execute("get_build_status", {});

  assert.equal(result.success, true);
  assert.equal((result.output as Record<string, unknown>).projectSlug, null);
  assert.equal((result.output as Record<string, unknown>).buildTarget, null);
});

test("GameDevAdapter.execute builds correct message", async () => {
  const adapter = createGameDevAdapterPlugin();

  const result = await adapter.execute("get_build_artifacts", {
    projectSlug: "my-game",
    buildTarget: "linux",
  });

  const output = result.output as Record<string, unknown>;
  assert.ok(output.message.includes("Unity Cloud Build"));
  assert.ok(output.message.includes("get_build_artifacts"));
  assert.ok(output.message.includes("my-game"));
  assert.ok(output.message.includes("linux"));
});

test("GameDevAdapter.execute handles undefined params gracefully", async () => {
  const adapter = createGameDevAdapterPlugin();

  // Passing undefined for params should not throw
  const result = await adapter.execute("get_build_status", undefined as unknown as Record<string, unknown>);

  assert.equal(result.success, true);
  assert.equal((result.output as Record<string, unknown>).status, "success");
});

test("GameDevAdapter.execute handles null params gracefully", async () => {
  const adapter = createGameDevAdapterPlugin();

  // Passing null for params should not throw
  const result = await adapter.execute("get_build_status", null as unknown as Record<string, unknown>);

  assert.equal(result.success, true);
  assert.equal((result.output as Record<string, unknown>).status, "success");
});
