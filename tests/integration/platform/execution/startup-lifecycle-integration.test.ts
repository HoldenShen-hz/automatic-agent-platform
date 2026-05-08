import assert from "node:assert/strict";
import test from "node:test";

import {
  createGracefulShutdown,
  getGlobalGracefulShutdown,
  registerProcessErrorHandlers,
} from "../../../../src/platform/execution/startup/index.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("integration: getGlobalGracefulShutdown returns the singleton instance", async () => {
  const registry = new ServiceRegistry();

  try {
    // Note: getGlobalGracefulShutdown() does not accept a registry parameter
    // and does not integrate with ServiceRegistry - it returns a global singleton
    const shutdown1 = getGlobalGracefulShutdown();
    const shutdown2 = getGlobalGracefulShutdown();

    // The function should return the same singleton instance
    assert.strictEqual(shutdown1, shutdown2, "getGlobalGracefulShutdown should return the same singleton");

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

test("integration: registerProcessErrorHandlers can be called multiple times", async () => {
  const shutdown = createGracefulShutdown({
    registerSignalHandlers: false,
  });

  const beforeUncaught = new Set(process.listeners("uncaughtException"));
  const beforeUnhandled = new Set(process.listeners("unhandledRejection"));

  // Note: registerProcessErrorHandlers does not check for existing handlers
  // so calling it twice adds duplicate handlers
  registerProcessErrorHandlers(shutdown);
  registerProcessErrorHandlers(shutdown);

  const afterUncaught = process.listeners("uncaughtException");
  const afterUnhandled = process.listeners("unhandledRejection");
  const newUncaught = afterUncaught.filter((listener) => !beforeUncaught.has(listener));
  const newUnhandled = afterUnhandled.filter((listener) => !beforeUnhandled.has(listener));

  try {
    // Each call adds a new handler, so two calls means two handlers added
    assert.equal(newUncaught.length, 2, "should add two uncaughtException handlers when called twice");
    assert.equal(newUnhandled.length, 2, "should add two unhandledRejection handlers when called twice");
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
