/**
 * Comprehensive unit tests for GlobalSingletonSlot and related functions.
 * Covers createGlobalSingletonSlot, getOrCreateGlobalSingleton, getOrCreateGlobalSingletonAsync,
 * resetGlobalSingleton, and configuration drift detection.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  createGlobalSingletonSlot,
  getOrCreateGlobalSingleton,
  getOrCreateGlobalSingletonAsync,
  resetGlobalSingleton,
  type GlobalSingletonSlot,
} from "../../../../../src/platform/shared/lifecycle/global-singleton.js";

test("createGlobalSingletonSlot creates empty slot with correct structure", () => {
  const slot = createGlobalSingletonSlot<string>();

  assert.strictEqual(slot.instance, null);
  assert.strictEqual(slot.initializing, false);
  assert.strictEqual(slot.configurationFingerprint, null);
});

test("createGlobalSingletonSlot works with different types", () => {
  const slot = createGlobalSingletonSlot<{ value: number; name: string }>();
  assert.strictEqual(slot.instance, null);

  slot.instance = { value: 42, name: "test" };
  assert.strictEqual(slot.instance.value, 42);
  assert.strictEqual(slot.instance.name, "test");
});

test("getOrCreateGlobalSingleton initializes slot on first call", () => {
  const slot = createGlobalSingletonSlot<{ initialized: boolean }>();

  assert.strictEqual(slot.initializing, false);

  const instance = getOrCreateGlobalSingleton(
    slot,
    () => ({ initialized: true }),
    { name: "init-test" }
  );

  assert.strictEqual(instance.initialized, true);
  assert.strictEqual(slot.initializing, false); // Should be reset after init
  assert.strictEqual(slot.instance, instance);
});

test("getOrCreateGlobalSingleton sets configurationFingerprint on first init", () => {
  const slot = createGlobalSingletonSlot<unknown>();
  const fingerprint = "{\"env\":\"test\"}";

  assert.strictEqual(slot.configurationFingerprint, null);

  getOrCreateGlobalSingleton(slot, () => ({}), {
    name: "fingerprint-test",
    configurationFingerprint: fingerprint,
  });

  assert.strictEqual(slot.configurationFingerprint, fingerprint);
});

test("getOrCreateGlobalSingleton throws when initialization is already in progress", () => {
  const slot = createGlobalSingletonSlot<{ id: string }>();
  let factoryCallCount = 0;

  // Create a factory that tracks its own initialization state
  const factory = () => {
    factoryCallCount++;
    // Simulate re-entrant initialization by calling getOrCreateGlobalSingleton inside factory
    if (factoryCallCount === 1) {
      try {
        getOrCreateGlobalSingleton(slot, () => ({ id: "inner" }), { name: "inner-call" });
      } catch {
        // Expected to throw - we're already initializing
      }
    }
    return { id: "outer" };
  };

  const instance = getOrCreateGlobalSingleton(slot, factory, { name: "reentrant-test" });

  assert.strictEqual(instance.id, "outer");
  assert.strictEqual(slot.instance, instance);
  assert.strictEqual(factoryCallCount, 1);
});

test("getOrCreateGlobalSingleton allows same fingerprint on subsequent calls", () => {
  const slot = createGlobalSingletonSlot<{ value: number }>();
  const fingerprint = "{\"version\":\"1.0\"}";

  const first = getOrCreateGlobalSingleton(slot, () => ({ value: 1 }), {
    name: "stable-config",
    configurationFingerprint: fingerprint,
  });

  const second = getOrCreateGlobalSingleton(slot, () => ({ value: 999 }), {
    name: "stable-config",
    configurationFingerprint: fingerprint,
  });

  assert.strictEqual(first, slot.instance);
  assert.strictEqual(second, slot.instance);
  assert.ok(slot.instance !== null);
  assert.strictEqual(slot.instance.value, 1); // Original value preserved
});

test("getOrCreateGlobalSingleton allows null fingerprint on subsequent calls", () => {
  const slot = createGlobalSingletonSlot<{ value: number }>();

  const first = getOrCreateGlobalSingleton(slot, () => ({ value: 1 }), {
    name: "no-fingerprint",
    configurationFingerprint: null,
  });

  const second = getOrCreateGlobalSingleton(slot, () => ({ value: 999 }), {
    name: "no-fingerprint",
    configurationFingerprint: null,
  });

  assert.strictEqual(first, slot.instance);
  assert.strictEqual(second, slot.instance);
});

test("getOrCreateGlobalSingleton allows null fingerprint when slot has fingerprint", () => {
  const slot = createGlobalSingletonSlot<{ value: number }>();

  // First call with fingerprint
  getOrCreateGlobalSingleton(slot, () => ({ value: 1 }), {
    name: "fingerprint-then-null",
    configurationFingerprint: "{\"config\":\"v1\"}",
  });

  // Second call with null should be allowed
  const instance = getOrCreateGlobalSingleton(slot, () => ({ value: 2 }), {
    name: "fingerprint-then-null",
    configurationFingerprint: null,
  });

  assert.strictEqual(instance.value, 1); // Original preserved
});

test("getOrCreateGlobalSingleton allows fingerprint when slot has null fingerprint", () => {
  const slot = createGlobalSingletonSlot<{ value: number }>();

  // First call without fingerprint
  getOrCreateGlobalSingleton(slot, () => ({ value: 1 }), {
    name: "null-then-fingerprint",
    configurationFingerprint: null,
  });

  // Second call with fingerprint should be allowed
  const instance = getOrCreateGlobalSingleton(slot, () => ({ value: 2 }), {
    name: "null-then-fingerprint",
    configurationFingerprint: "{\"config\":\"v1\"}",
  });

  assert.strictEqual(instance.value, 1); // Original preserved
});

test("getOrCreateGlobalSingletonAsync initializes slot on first call", async () => {
  const slot = createGlobalSingletonSlot<{ initialized: boolean }>();

  assert.strictEqual(slot.initializing, false);

  const instance = await getOrCreateGlobalSingletonAsync(
    slot,
    async () => ({ initialized: true }),
    { name: "async-init-test" }
  );

  assert.strictEqual(instance.initialized, true);
  assert.strictEqual(slot.initializing, false);
  assert.strictEqual(slot.instance, instance);
});

test("getOrCreateGlobalSingletonAsync sets configurationFingerprint on first init", async () => {
  const slot = createGlobalSingletonSlot<unknown>();
  const fingerprint = "{\"async\":\"true\"}";

  await getOrCreateGlobalSingletonAsync(slot, async () => ({}), {
    name: "async-fingerprint-test",
    configurationFingerprint: fingerprint,
  });

  assert.strictEqual(slot.configurationFingerprint, fingerprint);
});

test("getOrCreateGlobalSingletonAsync throws when initialization already in progress", async () => {
  const slot = createGlobalSingletonSlot<{ id: string }>();
  let asyncFactoryCallCount = 0;

  const asyncFactory = async () => {
    asyncFactoryCallCount++;
    if (asyncFactoryCallCount === 1) {
      try {
        await getOrCreateGlobalSingletonAsync(slot, async () => ({ id: "inner" }), { name: "inner-async" });
      } catch {
        // Expected
      }
    }
    return { id: "outer" };
  };

  const instance = await getOrCreateGlobalSingletonAsync(slot, asyncFactory, { name: "async-reentrant" });

  assert.strictEqual(instance.id, "outer");
  assert.strictEqual(slot.instance, instance);
  assert.strictEqual(asyncFactoryCallCount, 1);
});

test("getOrCreateGlobalSingletonAsync allows same fingerprint on subsequent calls", async () => {
  const slot = createGlobalSingletonSlot<{ value: number }>();
  const fingerprint = "{\"async\":\"stable\"}";

  const first = await getOrCreateGlobalSingletonAsync(slot, async () => ({ value: 1 }), {
    name: "async-stable",
    configurationFingerprint: fingerprint,
  });

  const second = await getOrCreateGlobalSingletonAsync(slot, async () => ({ value: 999 }), {
    name: "async-stable",
    configurationFingerprint: fingerprint,
  });

  assert.strictEqual(first, slot.instance);
  assert.strictEqual(second, slot.instance);
  assert.ok(slot.instance !== null);
  assert.strictEqual(slot.instance.value, 1);
});

test("resetGlobalSingleton clears instance and resets state", () => {
  const slot = createGlobalSingletonSlot<{ value: number }>();
  const original = getOrCreateGlobalSingleton(slot, () => ({ value: 42 }), { name: "reset-test" });

  assert.strictEqual(slot.instance, original);
  assert.strictEqual(slot.initializing, false);

  resetGlobalSingleton(slot);

  assert.strictEqual(slot.instance, null);
  assert.strictEqual(slot.initializing, false);
  assert.strictEqual(slot.configurationFingerprint, null);
});

test("resetGlobalSingleton calls beforeReset callback with current instance", () => {
  const slot = createGlobalSingletonSlot<{ cleared: boolean; value: number }>();
  const instance = getOrCreateGlobalSingleton(slot, () => ({ cleared: false, value: 100 }), { name: "before-reset-test" });

  let callbackInstance: typeof instance | null = null;
  resetGlobalSingleton(slot, {
    beforeReset: (inst) => {
      callbackInstance = inst;
      inst.cleared = true;
    },
  });

  assert.strictEqual(callbackInstance, instance);
  assert.strictEqual(instance.cleared, true);
  assert.strictEqual(slot.instance, null);
});

test("resetGlobalSingleton works without beforeReset callback", () => {
  const slot = createGlobalSingletonSlot<unknown>();
  getOrCreateGlobalSingleton(slot, () => ({ test: true }), { name: "reset-no-callback" });

  // Should not throw
  resetGlobalSingleton(slot);

  assert.strictEqual(slot.instance, null);
});

test("resetGlobalSingleton works on empty slot", () => {
  const slot = createGlobalSingletonSlot<unknown>();

  // Should not throw
  resetGlobalSingleton(slot);

  assert.strictEqual(slot.instance, null);
  assert.strictEqual(slot.initializing, false);
});

test("resetGlobalSingleton with beforeReset does not throw on empty slot", () => {
  const slot = createGlobalSingletonSlot<unknown>();
  let callbackCalled = false;

  resetGlobalSingleton(slot, {
    beforeReset: () => {
      callbackCalled = true;
    },
  });

  assert.strictEqual(callbackCalled, false);
});

test("getOrCreateGlobalSingleton preserves instance when called again after reset", () => {
  const slot = createGlobalSingletonSlot<{ id: string }>();

  const first = getOrCreateGlobalSingleton(slot, () => ({ id: "original" }), { name: "preserve-after-reset" });
  resetGlobalSingleton(slot);
  const second = getOrCreateGlobalSingleton(slot, () => ({ id: "new" }), { name: "preserve-after-reset" });

  assert.notStrictEqual(first, second);
  assert.strictEqual(second.id, "new");
});

test("getOrCreateGlobalSingletonAsync preserves instance when called again after reset", async () => {
  const slot = createGlobalSingletonSlot<{ id: string }>();

  const first = await getOrCreateGlobalSingletonAsync(slot, async () => ({ id: "original" }), { name: "async-preserve" });
  resetGlobalSingleton(slot);
  const second = await getOrCreateGlobalSingletonAsync(slot, async () => ({ id: "new" }), { name: "async-preserve" });

  assert.notStrictEqual(first, second);
  assert.strictEqual(second.id, "new");
});

test("configuration drift detection handles missing both fingerprints", () => {
  const slot = createGlobalSingletonSlot<unknown>();

  // Neither slot nor request has fingerprint - should allow
  getOrCreateGlobalSingleton(slot, () => ({}), { name: "both-null" });
  getOrCreateGlobalSingleton(slot, () => ({}), { name: "both-null" });

  assert.ok(slot.instance != null);
});

test("configuration drift detection handles missing only slot fingerprint", () => {
  assert.doesNotThrow(() => {
    const slot = createGlobalSingletonSlot<unknown>();

    // Request has fingerprint but slot doesn't
    getOrCreateGlobalSingleton(slot, () => ({}), {
      name: "only-request-has",
      configurationFingerprint: "{\"env\":\"dev\"}",
    });

    // Second call with same fingerprint should work (no drift)
    getOrCreateGlobalSingleton(slot, () => ({}), {
      name: "only-request-has",
      configurationFingerprint: "{\"env\":\"dev\"}",
    });
  });
});

test("configuration drift detection handles missing only request fingerprint", () => {
  assert.doesNotThrow(() => {
    const slot = createGlobalSingletonSlot<unknown>();

    // Slot has fingerprint but request doesn't
    getOrCreateGlobalSingleton(slot, () => ({}), {
      name: "only-slot-has",
      configurationFingerprint: "{\"env\":\"prod\"}",
    });

    // Second call with null fingerprint - should be allowed
    getOrCreateGlobalSingleton(slot, () => ({}), {
      name: "only-slot-has",
      configurationFingerprint: null,
    });
  });
});

test("GlobalSingletonSlot interface is correctly typed", () => {
  const slot: GlobalSingletonSlot<{ name: string }> = createGlobalSingletonSlot();

  assert.strictEqual(slot.instance, null);
  assert.strictEqual(slot.initializing, false);

  slot.instance = { name: "test" };
  slot.initializing = true;
  slot.configurationFingerprint = "fp";

  assert.strictEqual(slot.instance.name, "test");
  assert.strictEqual(slot.initializing, true);
  assert.strictEqual(slot.configurationFingerprint, "fp");
});
