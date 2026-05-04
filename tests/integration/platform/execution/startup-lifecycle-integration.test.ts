import assert from "node:assert/strict";
import test from "node:test";

import {
  createGracefulShutdown,
  getGlobalGracefulShutdown,
  registerProcessErrorHandlers,
} from "../../../../src/platform/execution/startup/index.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("integration: getGlobalGracefulShutdown registers the singleton in ServiceRegistry", async () => {
  const registry = new ServiceRegistry();

  try {
    const shutdown1 = getGlobalGracefulShutdown(registry);
    const shutdown2 = getGlobalGracefulShutdown(registry);
    const registered = registry.get("platform.global-shutdown");

    assert.ok(registry.has("platform.global-shutdown"));
    assert.strictEqual(shutdown1, shutdown2);
    assert.ok(registry.isInitialized("platform.global-shutdown"));
    assert.strictEqual(registered, shutdown1);

    shutdown1.unregisterSignalHandlers();
    shutdown1.reset();
  } finally {
    await registry.reset();
  }
});

test("integration: registerProcessErrorHandlers wires both process-level handlers for a graceful shutdown instance", async () => {
  const shutdown = createGracefulShutdown({
    registerSignalHandlers: false,
  });

  const beforeUncaught = new Set(process.listeners("uncaughtException"));
  const beforeUnhandled = new Set(process.listeners("unhandledRejection"));

  registerProcessErrorHandlers(shutdown);

  const afterUncaught = process.listeners("uncaughtException");
  const afterUnhandled = process.listeners("unhandledRejection");
  const newUncaught = afterUncaught.filter((listener) => !beforeUncaught.has(listener));
  const newUnhandled = afterUnhandled.filter((listener) => !beforeUnhandled.has(listener));

  try {
    assert.equal(newUncaught.length, 1, "should attach exactly one uncaughtException handler");
    assert.equal(newUnhandled.length, 1, "should attach exactly one unhandledRejection handler");
  } finally {
    for (const listener of newUncaught) {
      process.removeListener("uncaughtException", listener);
    }
    for (const listener of newUnhandled) {
      process.removeListener("unhandledRejection", listener);
    }
    shutdown.reset();
  }
});

test("integration: registerProcessErrorHandlers is idempotent for the same graceful shutdown instance", async () => {
  const shutdown = createGracefulShutdown({
    registerSignalHandlers: false,
  });

  const beforeUncaught = new Set(process.listeners("uncaughtException"));
  const beforeUnhandled = new Set(process.listeners("unhandledRejection"));

  registerProcessErrorHandlers(shutdown);
  registerProcessErrorHandlers(shutdown);

  const afterUncaught = process.listeners("uncaughtException");
  const afterUnhandled = process.listeners("unhandledRejection");
  const newUncaught = afterUncaught.filter((listener) => !beforeUncaught.has(listener));
  const newUnhandled = afterUnhandled.filter((listener) => !beforeUnhandled.has(listener));

  try {
    assert.equal(newUncaught.length, 1, "should keep exactly one uncaughtException handler for the same shutdown instance");
    assert.equal(newUnhandled.length, 1, "should keep exactly one unhandledRejection handler for the same shutdown instance");
  } finally {
    for (const listener of newUncaught) {
      process.removeListener("uncaughtException", listener);
    }
    for (const listener of newUnhandled) {
      process.removeListener("unhandledRejection", listener);
    }
    shutdown.reset();
  }
});
