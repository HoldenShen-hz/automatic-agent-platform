/**
 * Unit tests for LogTransport interface.
 */

import test from "node:test";
import assert from "node:assert/strict";

import type { LogTransport } from "../../../../../src/platform/shared/observability/log-transport.js";

test("LogTransport interface can be satisfied by a concrete implementation", () => {
  // Verify LogTransport can be implemented
  const transport: LogTransport = {
    name: "test-transport",
    write(entry) {
      assert.ok(entry);
      assert.equal(entry.message, "test");
    },
    async flush() {
      // flush is optional but can be implemented
    },
    async close() {
      // close is optional but can be implemented
    },
  };

  assert.equal(transport.name, "test-transport");
});

test("LogTransport write can return void or Promise<void>", () => {
  const transportVoid: LogTransport = {
    name: "void-transport",
    write() {
      // void return
    },
  };

  assert.equal(transportVoid.name, "void-transport");
});

test("LogTransport methods can be optional", () => {
  // flush and close are optional
  const minimalTransport: LogTransport = {
    name: "minimal",
    write() {},
  };

  assert.equal(minimalTransport.name, "minimal");
  assert.equal(minimalTransport.flush, undefined);
  assert.equal(minimalTransport.close, undefined);
});

test("LogTransport implementation can store entries", async () => {
  const entries: unknown[] = [];
  const capturingTransport: LogTransport = {
    name: "capturing",
    write(entry) {
      entries.push(entry);
    },
    async flush() {
      // no-op
    },
    async close() {
      entries.length = 0;
    },
  };

  capturingTransport.write({ level: "info", message: "first" } as never);
  capturingTransport.write({ level: "error", message: "second" } as never);

  assert.equal(entries.length, 2);
  await capturingTransport.close!();
  assert.equal(entries.length, 0);
});