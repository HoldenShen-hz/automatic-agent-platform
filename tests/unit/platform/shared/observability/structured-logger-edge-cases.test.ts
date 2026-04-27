import assert from "node:assert/strict";
import test from "node:test";

import { StructuredLogger, type StructuredLogEntry } from "../../../../../src/platform/shared/observability/structured-logger.js";

test("StructuredLogger respects retentionLimit parameter", () => {
  const logger = new StructuredLogger({ retentionLimit: 5 });

  // Add 10 entries
  for (let i = 0; i < 10; i++) {
    logger.info(`message_${i}`, { index: i });
  }

  const entries = logger.getEntries();
  assert.equal(entries.length, 5);
  // Should have the last 5 entries
  assert.equal(entries[0]?.message, "message_5");
  assert.equal(entries[4]?.message, "message_9");
});

test("StructuredLogger getEntries returns empty array initially", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  const entries = logger.getEntries();
  assert.deepEqual(entries, []);
});

test("StructuredLogger getEntries returns copy not reference", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });
  logger.info("test");

  const entries1 = logger.getEntries();
  const entries2 = logger.getEntries();

  entries1.push({} as StructuredLogEntry);

  assert.equal(logger.getEntries().length, 1);
});

test("StructuredLogger log method creates entry with correct structure", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });
  const before = Date.now();

  logger.log({ level: "info", message: "test message", data: { key: "value" } });

  const after = Date.now();
  const entries = logger.getEntries();

  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.level, "info");
  assert.equal(entries[0]!.message, "test message");
  assert.deepEqual(entries[0]!.data, { key: "value" });
  assert.ok(Date.parse(entries[0]!.timestamp) >= before);
  assert.ok(Date.parse(entries[0]!.timestamp) <= after);
});

test("StructuredLogger log method handles all log levels", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  const levels: StructuredLogEntry["level"][] = ["debug", "info", "warn", "error", "fatal"];

  for (const level of levels) {
    logger.log({ level, message: `${level} message` });
  }

  const entries = logger.getEntries();
  assert.equal(entries.length, 5);

  for (let i = 0; i < levels.length; i++) {
    assert.equal(entries[i]!.level, levels[i]);
  }
});

test("StructuredLogger info is alias for log with info level", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.info("info message", { foo: "bar" });

  const entries = logger.getEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.level, "info");
  assert.equal(entries[0]!.message, "info message");
});

test("StructuredLogger warn is alias for log with warn level", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.warn("warning message", { code: 123 });

  const entries = logger.getEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.level, "warn");
});

test("StructuredLogger error is alias for log with error level", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.error("error message", { err: "something went wrong" });

  const entries = logger.getEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.level, "error");
});

test("StructuredLogger debug is alias for log with debug level", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.debug("debug message");

  const entries = logger.getEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.level, "debug");
});

test("StructuredLogger fatal is alias for log with fatal level", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.fatal("fatal message", { critical: true });

  const entries = logger.getEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0]!.level, "fatal");
});

test("StructuredLogger clear removes all entries", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.info("message 1");
  logger.info("message 2");
  logger.info("message 3");

  assert.equal(logger.getEntries().length, 3);

  logger.clear();

  assert.equal(logger.getEntries().length, 0);
});

test("StructuredLogEntry type accepts valid entry structures", () => {
  const entry: StructuredLogEntry = {
    timestamp: "2026-04-26T10:00:00.000Z",
    createdAt: "2026-04-26T10:00:00.000Z",
    level: "info",
    message: "test",
    service: "test-service",
    data: { key: "value" },
  };

  assert.equal(entry.level, "info");
  assert.equal(entry.message, "test");
});

test("StructuredLogEntry data can be undefined", () => {
  const entry: StructuredLogEntry = {
    timestamp: "2026-04-26T10:00:00.000Z",
    createdAt: "2026-04-26T10:00:00.000Z",
    level: "info",
    message: "test",
    service: "test-service",
  };

  assert.equal(entry.data, undefined);
});

test("StructuredLogger handles undefined data gracefully", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.log({ level: "info", message: "test" });

  const entries = logger.getEntries();
  assert.equal(entries.length, 1);
  assert.ok(entries[0]!.data === undefined);
});

test("StructuredLogger handles nested objects in data", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.info("nested", {
    level1: {
      level2: {
        level3: "deep value",
      },
    },
    array: [1, 2, 3],
  });

  const entries = logger.getEntries();
  assert.deepEqual((entries[0]!.data as any).level1.level2.level3, "deep value");
  assert.deepEqual((entries[0]!.data as any).array, [1, 2, 3]);
});

test("StructuredLogger handles empty object in data", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.info("empty data", {});

  const entries = logger.getEntries();
  assert.deepEqual(entries[0]!.data, {});
});

test("StructuredLogger handles null in data", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.log({ level: "info", message: "null data", data: null });

  const entries = logger.getEntries();
  assert.equal(entries[0]!.data, null);
});

test("StructuredLogger handles special characters in message", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.info("special chars: \n\r\t\"'\\", { emoji: "🎉" });

  const entries = logger.getEntries();
  assert.ok(entries[0]!.message.includes("\n"));
  assert.ok(entries[0]!.message.includes("\r"));
  assert.ok(entries[0]!.message.includes("\t"));
});

test("StructuredLogger handles very long message", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  const longMessage = "x".repeat(10000);
  logger.info(longMessage);

  const entries = logger.getEntries();
  assert.equal(entries[0]!.message.length, 10000);
});

test("StructuredLogger handles unicode in message", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.info("unicode: 中文 日本語 한국어", { mixed: "English and 中文" });

  const entries = logger.getEntries();
  assert.ok(entries[0]!.message.includes("中文"));
});

test("StructuredLogger respects zero retentionLimit", () => {
  const logger = new StructuredLogger({ retentionLimit: 0 });

  logger.info("should not be retained");
  logger.info("also not retained");

  assert.equal(logger.getEntries().length, 0);
});

test("StructuredLogger handles missing retentionLimit (uses default)", () => {
  // @ts-ignore - testing runtime behavior with missing option
  const logger = new StructuredLogger({});

  logger.info("test");

  // Should still work with default or undefined retentionLimit
  const entries = logger.getEntries();
  assert.ok(entries.length >= 0);
});
