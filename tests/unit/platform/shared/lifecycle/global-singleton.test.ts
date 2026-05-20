import assert from "node:assert/strict";
import test from "node:test";

import {
  createGlobalSingletonSlot,
  getOrCreateGlobalSingleton,
  getOrCreateGlobalSingletonAsync,
  resetGlobalSingleton,
} from "../../../../../src/platform/shared/lifecycle/global-singleton.js";

test("getOrCreateGlobalSingleton returns the same instance for repeated calls", () => {
  const slot = createGlobalSingletonSlot<{ id: string }>();
  const first = getOrCreateGlobalSingleton(slot, () => ({ id: "singleton" }), { name: "test-singleton" });
  const second = getOrCreateGlobalSingleton(slot, () => ({ id: "other" }), { name: "test-singleton" });

  assert.strictEqual(first, second);
});

test("getOrCreateGlobalSingleton rejects configuration drift after initialization", () => {
  const slot = createGlobalSingletonSlot<{ id: string }>();
  getOrCreateGlobalSingleton(slot, () => ({ id: "singleton" }), {
    name: "configured-singleton",
    configurationFingerprint: "{\"mode\":\"enforce\"}",
  });

  assert.throws(
    () =>
      getOrCreateGlobalSingleton(slot, () => ({ id: "other" }), {
        name: "configured-singleton",
        configurationFingerprint: "{\"mode\":\"audit_only\"}",
      }),
    /global_singleton\.configuration_drift:configured-singleton/,
  );
});

test("resetGlobalSingleton clears the slot and runs beforeReset cleanup", () => {
  const slot = createGlobalSingletonSlot<{ cleared: boolean }>();
  const instance = getOrCreateGlobalSingleton(slot, () => ({ cleared: false }), { name: "resettable-singleton" });

  resetGlobalSingleton(slot, {
    beforeReset: (activeInstance) => {
      activeInstance.cleared = true;
    },
  });

  assert.equal(instance.cleared, true);
  const recreated = getOrCreateGlobalSingleton(slot, () => ({ cleared: false }), { name: "resettable-singleton" });
  assert.notStrictEqual(recreated, instance);
});

test("getOrCreateGlobalSingletonAsync also enforces configuration drift fail-closed", async () => {
  const slot = createGlobalSingletonSlot<{ id: string }>();
  await getOrCreateGlobalSingletonAsync(slot, async () => ({ id: "singleton" }), {
    name: "async-singleton",
    configurationFingerprint: "{\"mode\":\"strict\"}",
  });

  await assert.rejects(
    () =>
      getOrCreateGlobalSingletonAsync(slot, async () => ({ id: "other" }), {
        name: "async-singleton",
        configurationFingerprint: "{\"mode\":\"relaxed\"}",
      }),
    /global_singleton\.configuration_drift:async-singleton/,
  );
});
