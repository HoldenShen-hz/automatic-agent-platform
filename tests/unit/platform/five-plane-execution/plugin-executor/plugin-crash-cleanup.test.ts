/**
 * Unit Tests: Plugin Crash Cleanup
 *
 * Tests for the PluginCrashCleanupHook which handles cleanup of resources
 * when a plugin crashes during execution.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { PluginCrashCleanupHook, type PluginCrashCleanupRequest } from "../../../../../src/platform/five-plane-execution/plugin-executor/plugin-crash-cleanup.js";

function createTestRequest(overrides: Partial<PluginCrashCleanupRequest> = {}): PluginCrashCleanupRequest {
  return {
    pluginId: "plugin.test.adapter",
    runId: "run_123",
    crashedAt: "2026-05-02T12:00:00.000Z",
    resources: [],
    ...overrides,
  };
}

test("PluginCrashCleanupHook cleanup returns correct structure", () => {
  const hook = new PluginCrashCleanupHook();
  const request = createTestRequest();

  const receipt = hook.cleanup(request);

  assert.equal(receipt.pluginId, "plugin.test.adapter");
  assert.equal(receipt.runId, "run_123");
  assert.equal(receipt.cleanupHook, "plugin_crash_cleanup");
});

test("PluginCrashCleanupHook cleanup with empty resources", () => {
  const hook = new PluginCrashCleanupHook();
  const request = createTestRequest({ resources: [] });

  const receipt = hook.cleanup(request);

  assert.deepEqual(receipt.closedResources, []);
  assert.deepEqual(receipt.secretResourceIds, []);
  assert.equal(receipt.callbacksDetached, 0);
});

test("PluginCrashCleanupHook cleanup with file resources", () => {
  const hook = new PluginCrashCleanupHook();
  const request = createTestRequest({
    resources: [
      { resourceKind: "file", resourceId: "file_1" },
      { resourceKind: "file", resourceId: "file_2" },
    ],
  });

  const receipt = hook.cleanup(request);

  assert.equal(receipt.closedResources.length, 2);
  assert.deepEqual(receipt.secretResourceIds, []);
  assert.equal(receipt.callbacksDetached, 0);
});

test("PluginCrashCleanupHook cleanup with secret resources", () => {
  const hook = new PluginCrashCleanupHook();
  const request = createTestRequest({
    resources: [
      { resourceKind: "secret", resourceId: "secret_abc" },
      { resourceKind: "secret", resourceId: "secret_def" },
    ],
  });

  const receipt = hook.cleanup(request);

  assert.equal(receipt.closedResources.length, 2);
  assert.deepEqual(receipt.secretResourceIds, ["secret_abc", "secret_def"]);
  assert.equal(receipt.callbacksDetached, 0);
});

test("PluginCrashCleanupHook cleanup with callback resources", () => {
  const hook = new PluginCrashCleanupHook();
  const request = createTestRequest({
    resources: [
      { resourceKind: "callback", resourceId: "callback_1" },
      { resourceKind: "callback", resourceId: "callback_2" },
      { resourceKind: "callback", resourceId: "callback_3" },
    ],
  });

  const receipt = hook.cleanup(request);

  assert.equal(receipt.closedResources.length, 3);
  assert.deepEqual(receipt.callbacksDetached, 3);
});

test("PluginCrashCleanupHook cleanup with mixed resources", () => {
  const hook = new PluginCrashCleanupHook();
  const request = createTestRequest({
    resources: [
      { resourceKind: "file", resourceId: "file_1" },
      { resourceKind: "socket", resourceId: "socket_1" },
      { resourceKind: "secret", resourceId: "secret_xyz" },
      { resourceKind: "callback", resourceId: "callback_a" },
      { resourceKind: "browser", resourceId: "browser_session_1" },
    ],
  });

  const receipt = hook.cleanup(request);

  assert.equal(receipt.closedResources.length, 5);
  assert.deepEqual(receipt.secretResourceIds, ["secret_xyz"]);
  assert.equal(receipt.callbacksDetached, 1);
});

test("PluginCrashCleanupHook cleanup accepts custom completedAt", () => {
  const hook = new PluginCrashCleanupHook();
  const request = createTestRequest({
    crashedAt: "2026-05-02T10:00:00.000Z",
    resources: [],
  });

  const customCompletedAt = "2026-05-02T10:05:00.000Z";
  const receipt = hook.cleanup(request, customCompletedAt);

  assert.equal(receipt.completedAt, customCompletedAt);
});

test("PluginCrashCleanupHook cleanup preserves resource order", () => {
  const hook = new PluginCrashCleanupHook();
  const request = createTestRequest({
    resources: [
      { resourceKind: "file", resourceId: "first" },
      { resourceKind: "socket", resourceId: "second" },
      { resourceKind: "browser", resourceId: "third" },
    ],
  });

  const receipt = hook.cleanup(request);

  assert.equal(receipt.closedResources[0]?.resourceId, "first");
  assert.equal(receipt.closedResources[1]?.resourceId, "second");
  assert.equal(receipt.closedResources[2]?.resourceId, "third");
});

test("PluginCrashCleanupHook cleanup works with all resource kinds", () => {
  const hook = new PluginCrashCleanupHook();
  const request = createTestRequest({
    resources: [
      { resourceKind: "file", resourceId: "f" },
      { resourceKind: "socket", resourceId: "s" },
      { resourceKind: "browser", resourceId: "b" },
      { resourceKind: "secret", resourceId: "sec" },
      { resourceKind: "callback", resourceId: "cb" },
    ],
  });

  const receipt = hook.cleanup(request);

  assert.equal(receipt.closedResources.length, 5);
});

test("PluginCrashCleanupHook multiple cleanups are independent", () => {
  const hook = new PluginCrashCleanupHook();

  const request1 = createTestRequest({
    runId: "run_1",
    resources: [{ resourceKind: "secret", resourceId: "secret_1" }],
  });

  const request2 = createTestRequest({
    runId: "run_2",
    resources: [{ resourceKind: "callback", resourceId: "callback_1" }],
  });

  const receipt1 = hook.cleanup(request1);
  const receipt2 = hook.cleanup(request2);

  assert.equal(receipt1.runId, "run_1");
  assert.equal(receipt2.runId, "run_2");
  assert.deepEqual(receipt1.secretResourceIds, ["secret_1"]);
  assert.equal(receipt2.callbacksDetached, 1);
});