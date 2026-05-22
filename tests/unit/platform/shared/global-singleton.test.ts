import test from "node:test";
import assert from "node:assert/strict";

import {
  createGlobalSingletonSlot,
  getOrCreateGlobalSingleton,
  getOrCreateGlobalSingletonAsync,
  resetGlobalSingleton,
  type GlobalSingletonSlot,
} from "../../../../src/platform/shared/lifecycle/global-singleton.js";

test("createGlobalSingletonSlot creates empty slot", () => {
  const slot = createGlobalSingletonSlot<string>();

  assert.strictEqual(slot.instance, null);
  assert.strictEqual(slot.initializing, false);
  assert.strictEqual(slot.configurationFingerprint, null);
});

test("createGlobalSingletonSlot works with different types", () => {
  const stringSlot = createGlobalSingletonSlot<string>();
  const numberSlot = createGlobalSingletonSlot<number>();
  const objectSlot = createGlobalSingletonSlot<object>();

  assert.strictEqual(stringSlot.instance, null);
  assert.strictEqual(numberSlot.instance, null);
  assert.strictEqual(objectSlot.instance, null);
});

test("getOrCreateGlobalSingleton creates instance on first call", () => {
  const slot = createGlobalSingletonSlot<string>();
  const factory = () => "test-instance";

  const instance = getOrCreateGlobalSingleton(slot, factory, { name: "test" });

  assert.strictEqual(instance, "test-instance");
  assert.strictEqual(slot.instance, "test-instance");
  assert.strictEqual(slot.configurationFingerprint, null);
});

test("getOrCreateGlobalSingleton returns existing instance on subsequent calls", () => {
  const slot = createGlobalSingletonSlot<string>();
  const instance1 = getOrCreateGlobalSingleton(slot, () => "new-instance", { name: "test" });
  const instance2 = getOrCreateGlobalSingleton(slot, () => "replacement-instance", { name: "test" });

  assert.strictEqual(instance1, instance2);
  assert.strictEqual(instance1, "new-instance");
  assert.strictEqual(slot.instance, "new-instance");
});

test("getOrCreateGlobalSingleton throws when initialization in progress", () => {
  const slot = createGlobalSingletonSlot<string>();
  let factoryCallCount = 0;
  const factory = () => {
    factoryCallCount++;
    if (factoryCallCount === 1) {
      // First call sets initializing to true, then recursive call should throw
      return getOrCreateGlobalSingleton(slot, () => "nested", { name: "nested" });
    }
    return "instance";
  };

  assert.throws(
    () => getOrCreateGlobalSingleton(slot, factory, { name: "test" }),
    /global_singleton.initialization_in_progress/,
  );
});

test("getOrCreateGlobalSingleton accepts configuration fingerprint", () => {
  const slot = createGlobalSingletonSlot<string>();
  const factory = () => "test-instance";

  getOrCreateGlobalSingleton(slot, factory, {
    name: "test",
    configurationFingerprint: "fingerprint-123",
  });

  assert.strictEqual(slot.configurationFingerprint, "fingerprint-123");
});

test("getOrCreateGlobalSingleton throws on configuration drift", () => {
  const slot = createGlobalSingletonSlot<string>();
  getOrCreateGlobalSingleton(slot, () => "original-instance", {
    name: "test",
    configurationFingerprint: "original-fingerprint",
  });

  assert.throws(
    () => getOrCreateGlobalSingleton(slot, () => "new-instance", {
      name: "test",
      configurationFingerprint: "different-fingerprint",
    }),
    /global_singleton.configuration_drift/,
  );
});

test("getOrCreateGlobalSingleton allows same fingerprint", () => {
  const slot = createGlobalSingletonSlot<string>();
  slot.configurationFingerprint = "same-fingerprint";

  const factory = () => "test-instance";

  const instance = getOrCreateGlobalSingleton(slot, factory, {
    name: "test",
    configurationFingerprint: "same-fingerprint",
  });

  assert.strictEqual(instance, "test-instance");
});

test("getOrCreateGlobalSingleton allows null fingerprint", () => {
  const slot = createGlobalSingletonSlot<string>();
  slot.configurationFingerprint = "some-fingerprint";

  const factory = () => "test-instance";

  const instance = getOrCreateGlobalSingleton(slot, factory, {
    name: "test",
    configurationFingerprint: null,
  });

  assert.strictEqual(instance, "test-instance");
});

test("resetGlobalSingleton clears slot", () => {
  const slot = createGlobalSingletonSlot<string>();
  slot.instance = "test-instance";
  slot.configurationFingerprint = "fingerprint";

  resetGlobalSingleton(slot);

  assert.strictEqual(slot.instance, null);
  assert.strictEqual(slot.initializing, false);
  assert.strictEqual(slot.configurationFingerprint, null);
});

test("resetGlobalSingleton calls beforeReset callback", () => {
  const slot = createGlobalSingletonSlot<string>();
  slot.instance = "test-instance";

  let callbackCalled = false;
  let capturedInstance: string | null = null;

  resetGlobalSingleton(slot, {
    beforeReset: (instance) => {
      callbackCalled = true;
      capturedInstance = instance;
    },
  });

  assert.strictEqual(callbackCalled, true);
  assert.strictEqual(capturedInstance, "test-instance");
});

test("resetGlobalSingleton works on empty slot", () => {
  const slot = createGlobalSingletonSlot<string>();

  resetGlobalSingleton(slot);

  assert.strictEqual(slot.instance, null);
  assert.strictEqual(slot.initializing, false);
});

test("getOrCreateGlobalSingletonAsync creates instance asynchronously", async () => {
  const slot = createGlobalSingletonSlot<string>();
  const factory = async () => {
    await Promise.resolve();
    return "async-instance";
  };

  const instance = await getOrCreateGlobalSingletonAsync(slot, factory, { name: "async-test" });

  assert.strictEqual(instance, "async-instance");
  assert.strictEqual(slot.instance, "async-instance");
});

test("getOrCreateGlobalSingletonAsync returns existing instance", async () => {
  const slot = createGlobalSingletonSlot<string>();
  slot.instance = "existing";

  const factory = async () => "new-instance";

  const instance = await getOrCreateGlobalSingletonAsync(slot, factory, { name: "test" });

  assert.strictEqual(instance, "existing");
});

test("getOrCreateGlobalSingletonAsync throws when initialization in progress", async () => {
  const slot = createGlobalSingletonSlot<string>();
  let callCount = 0;
  const factory = async () => {
    callCount++;
    if (callCount === 1) {
      return getOrCreateGlobalSingletonAsync(slot, async () => "nested", { name: "nested" });
    }
    return "instance";
  };

  await assert.rejects(
    async () => getOrCreateGlobalSingletonAsync(slot, factory, { name: "test" }),
    /global_singleton.initialization_in_progress/,
  );
});

test("getOrCreateGlobalSingletonAsync handles configuration fingerprint", async () => {
  const slot = createGlobalSingletonSlot<string>();
  const factory = async () => "test-instance";

  await getOrCreateGlobalSingletonAsync(slot, factory, {
    name: "test",
    configurationFingerprint: "async-fingerprint",
  });

  assert.strictEqual(slot.configurationFingerprint, "async-fingerprint");
});

test("resetGlobalSingletonAsync clears slot with async beforeReset", async () => {
  const slot = createGlobalSingletonSlot<string>();
  slot.instance = "async-test-instance";

  let callbackCalled = false;

  resetGlobalSingleton(slot, {
    beforeReset: (instance) => {
      callbackCalled = true;
      assert.strictEqual(instance, "async-test-instance");
    },
  });

  assert.strictEqual(callbackCalled, true);
  assert.strictEqual(slot.instance, null);
});

test("GlobalSingletonSlot interface structure", () => {
  const slot: GlobalSingletonSlot<object> = {
    instance: null,
    initializing: false,
    configurationFingerprint: null,
  };

  assert.strictEqual(slot.instance, null);
  assert.strictEqual(slot.initializing, false);
  assert.strictEqual(slot.configurationFingerprint, null);
});

test("Multiple slots are independent", () => {
  const slot1 = createGlobalSingletonSlot<string>();
  const slot2 = createGlobalSingletonSlot<number>();

  const instance1 = getOrCreateGlobalSingleton(slot1, () => "string-instance", { name: "slot1" });
  const instance2 = getOrCreateGlobalSingleton(slot2, () => 42, { name: "slot2" });

  assert.strictEqual(instance1, "string-instance");
  assert.strictEqual(instance2, 42);
  assert.notStrictEqual(slot1.instance, slot2.instance);
});
