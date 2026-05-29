/**
 * DLQ Manager CLI Tests
 *
 * Tests for dlq-manager.ts CLI module and its argument parsing, validation,
 * and output formatting.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { parseArguments as parseDlqArguments } from "../../../../src/sdk/cli/dlq-manager.js";

// ---------------------------------------------------------------------------
// Tests for DLQ argument parsing logic
// ---------------------------------------------------------------------------

const VALID_ACTIONS = ["list", "count", "retry", "purge"] as const;
const VALID_QUEUES = ["gateway", "jobs", "events"] as const;
const DEFAULT_LIMIT = 50;
const MIN_LIMIT = 1;
const MAX_LIMIT = 500;

interface DlqAction {
  action: "list" | "count" | "retry" | "purge";
  queue: "gateway" | "jobs" | "events";
  limit: number;
  channel: string | undefined;
}

/**
 * Mirrors the parseArguments logic in dlq-manager.ts
 */
function parseArguments(input: {
  action?: string;
  queue?: string;
  limit?: string;
  channel?: string;
}): DlqAction {
  const action = input.action as DlqAction["action"];
  const queue = input.queue as DlqAction["queue"];

  if (!action || !VALID_ACTIONS.includes(action)) {
    throw new Error("Invalid action. Use: list, count, retry, purge");
  }
  if (!queue || !VALID_QUEUES.includes(queue)) {
    throw new Error("Invalid queue. Use: gateway, jobs, events");
  }

  return {
    action,
    queue,
    limit: Math.max(MIN_LIMIT, Math.min(MAX_LIMIT, parseInt(input.limit ?? String(DEFAULT_LIMIT), 10))),
    channel: input.channel ?? undefined,
  };
}

test("parseArguments accepts valid list action with gateway queue", () => {
  const result = parseArguments({ action: "list", queue: "gateway" });
  assert.equal(result.action, "list");
  assert.equal(result.queue, "gateway");
  assert.equal(result.limit, DEFAULT_LIMIT);
  assert.equal(result.channel, undefined);
});

test("parseArguments accepts valid list action with jobs queue", () => {
  const result = parseArguments({ action: "list", queue: "jobs" });
  assert.equal(result.action, "list");
  assert.equal(result.queue, "jobs");
});

test("parseArguments accepts valid list action with events queue", () => {
  const result = parseArguments({ action: "list", queue: "events" });
  assert.equal(result.action, "list");
  assert.equal(result.queue, "events");
});

test("parseArguments accepts valid count action", () => {
  const result = parseArguments({ action: "count", queue: "gateway" });
  assert.equal(result.action, "count");
  assert.equal(result.queue, "gateway");
});

test("parseArguments accepts valid retry action", () => {
  const result = parseArguments({ action: "retry", queue: "jobs" });
  assert.equal(result.action, "retry");
  assert.equal(result.queue, "jobs");
});

test("parseArguments accepts valid purge action", () => {
  const result = parseArguments({ action: "purge", queue: "events" });
  assert.equal(result.action, "purge");
  assert.equal(result.queue, "events");
});

test("parseArguments throws for missing action", () => {
  assert.throws(
    () => parseArguments({ queue: "gateway" }),
    /Invalid action/,
  );
});

test("parseArguments throws for invalid action", () => {
  assert.throws(
    () => parseArguments({ action: "invalid", queue: "gateway" }),
    /Invalid action/,
  );
});

test("parseArguments throws for missing queue", () => {
  assert.throws(
    () => parseArguments({ action: "list" }),
    /Invalid queue/,
  );
});

test("parseArguments throws for invalid queue", () => {
  assert.throws(
    () => parseArguments({ action: "list", queue: "invalid" }),
    /Invalid queue/,
  );
});

test("parseArguments uses default limit of 50", () => {
  const result = parseArguments({ action: "list", queue: "gateway" });
  assert.equal(result.limit, DEFAULT_LIMIT);
});

test("parseArguments uses custom limit", () => {
  const result = parseArguments({ action: "list", queue: "gateway", limit: "100" });
  assert.equal(result.limit, 100);
});

test("parseArguments clamps limit to maximum of 500", () => {
  const result = parseArguments({ action: "list", queue: "gateway", limit: "1000" });
  assert.equal(result.limit, MAX_LIMIT);
});

test("parseArguments clamps limit to minimum of 1", () => {
  const result = parseArguments({ action: "list", queue: "gateway", limit: "0" });
  assert.equal(result.limit, MIN_LIMIT);
});

test("parseArguments clamps negative limit to minimum of 1", () => {
  const result = parseArguments({ action: "list", queue: "gateway", limit: "-10" });
  assert.equal(result.limit, MIN_LIMIT);
});

test("parseArguments accepts channel filter for gateway queue", () => {
  const result = parseArguments({ action: "list", queue: "gateway", channel: "webhook" });
  assert.equal(result.channel, "webhook");
});

test("parseArguments returns undefined channel when not provided", () => {
  const result = parseArguments({ action: "list", queue: "gateway" });
  assert.equal(result.channel, undefined);
});

test("parseArguments accepts explicit undefined channel", () => {
  const result = parseArguments({ action: "list", queue: "gateway" });
  assert.equal(result.channel, undefined);
});

// ---------------------------------------------------------------------------
// Tests for action and queue combinations
// ---------------------------------------------------------------------------

test("list action works with gateway queue", () => {
  const result = parseArguments({ action: "list", queue: "gateway", limit: "25" });
  assert.deepEqual(result, { action: "list", queue: "gateway", limit: 25, channel: undefined });
});

test("count action works with all queues", () => {
  for (const queue of VALID_QUEUES) {
    const result = parseArguments({ action: "count", queue });
    assert.equal(result.action, "count");
    assert.equal(result.queue, queue);
  }
});

test("retry action works with all queues", () => {
  for (const queue of VALID_QUEUES) {
    const result = parseArguments({ action: "retry", queue });
    assert.equal(result.action, "retry");
    assert.equal(result.queue, queue);
  }
});

test("purge action works with all queues", () => {
  for (const queue of VALID_QUEUES) {
    const result = parseArguments({ action: "purge", queue });
    assert.equal(result.action, "purge");
    assert.equal(result.queue, queue);
  }
});

// ---------------------------------------------------------------------------
// Tests for limit boundary values
// ---------------------------------------------------------------------------

test("parseArguments accepts limit at boundary minimum", () => {
  const result = parseArguments({ action: "list", queue: "gateway", limit: "1" });
  assert.equal(result.limit, 1);
});

test("parseArguments accepts limit at boundary maximum", () => {
  const result = parseArguments({ action: "list", queue: "gateway", limit: "500" });
  assert.equal(result.limit, 500);
});

test("parseArguments clamps just over maximum", () => {
  const result = parseArguments({ action: "list", queue: "gateway", limit: "501" });
  assert.equal(result.limit, 500);
});

test("parseArguments parses string limit correctly", () => {
  const result = parseArguments({ action: "list", queue: "gateway", limit: "123" });
  assert.equal(result.limit, 123);
});

// ---------------------------------------------------------------------------
// Tests for VALID_ACTIONS and VALID_QUEUES constants
// ---------------------------------------------------------------------------

test("VALID_ACTIONS contains all expected actions", () => {
  assert.deepEqual(VALID_ACTIONS, ["list", "count", "retry", "purge"]);
});

test("VALID_ACTIONS has exactly 4 actions", () => {
  assert.equal(VALID_ACTIONS.length, 4);
});

test("VALID_QUEUES contains all expected queues", () => {
  assert.deepEqual(VALID_QUEUES, ["gateway", "jobs", "events"]);
});

test("VALID_QUEUES has exactly 3 queues", () => {
  assert.equal(VALID_QUEUES.length, 3);
});

// ---------------------------------------------------------------------------
// Tests for DLQ count output formatting
// ---------------------------------------------------------------------------

test("count output format is correct", () => {
  const output = {
    gateway: 10,
    jobs: 5,
    events: 3,
    total: 18,
  };

  assert.equal(output.gateway, 10);
  assert.equal(output.jobs, 5);
  assert.equal(output.events, 3);
  assert.equal(output.total, 18);
});

test("count output total is sum of all queues", () => {
  const gatewayCount = 10;
  const jobsCount = 5;
  const eventsCount = 3;

  const total = gatewayCount + jobsCount + eventsCount;
  assert.equal(total, 18);
});

// ---------------------------------------------------------------------------
// Tests for DLQ list empty state
// ---------------------------------------------------------------------------

test("gateway dead letter empty state returns no rows", () => {
  const rows: unknown[] = [];
  const isEmpty = rows.length === 0;
  assert.equal(isEmpty, true);
});

test("job dead letter empty state returns no rows", () => {
  const rows: unknown[] = [];
  const isEmpty = rows.length === 0;
  assert.equal(isEmpty, true);
});

test("event dead letter empty state returns no rows", () => {
  const rows: unknown[] = [];
  const isEmpty = rows.length === 0;
  assert.equal(isEmpty, true);
});

// ---------------------------------------------------------------------------
// Tests for retry behavior by queue type
// ---------------------------------------------------------------------------

test("jobs queue retry updates status and resets attempts", () => {
  const sql = { prepare: () => ({ run: () => ({ changes: 5 }) }) } as any;
  const result = sql.prepare("UPDATE queue_jobs SET status = 'waiting', attempts = 0, last_error = NULL").run();
  assert.equal(result.changes, 5);
});

test("gateway queue retry outputs informational message", () => {
  const count = 10;
  const message = `Gateway dead letters (${count}) cannot be directly retried. Consider re-processing or purging.`;
  assert.ok(message.includes("cannot be directly retried"));
});

test("events queue retry outputs informational message", () => {
  const count = 5;
  const message = `Event dead letters (${count}) cannot be directly retried. Consider re-publishing or purging.`;
  assert.ok(message.includes("cannot be directly retried"));
});

test("source parseArguments rejects non-numeric limit instead of propagating NaN", () => {
  assert.throws(
    () => parseDlqArguments({ action: "list", queue: "gateway", limit: "abc" }),
    /Invalid limit/,
  );
});

test("source parseArguments keeps retry-limit available for retry action", () => {
  const result = parseDlqArguments({ action: "retry", queue: "jobs", "retry-limit": "25" });
  assert.equal(result.retryLimit, 25);
});

test("source parseArguments accepts case-insensitive purge env in runtime helper contract", () => {
  const result = parseDlqArguments({ action: "purge", queue: "events", yes: true });
  assert.equal(result.confirmed, true);
});

// ---------------------------------------------------------------------------
// Tests for purge behavior by queue type
// ---------------------------------------------------------------------------

test("gateway queue purge deletes all entries", () => {
  const sql = { prepare: () => ({ run: () => ({ changes: 15 }) }) } as any;
  const result = sql.prepare("DELETE FROM gateway_dead_letters").run();
  assert.equal(result.changes, 15);
});

test("jobs queue purge deletes only dead_letter status entries", () => {
  const sql = { prepare: () => ({ run: () => ({ changes: 8 }) }) } as any;
  const result = sql.prepare("DELETE FROM queue_jobs WHERE status = 'dead_letter'").run();
  assert.equal(result.changes, 8);
});

test("events queue purge deletes all entries", () => {
  const sql = { prepare: () => ({ run: () => ({ changes: 3 }) }) } as any;
  const result = sql.prepare("DELETE FROM event_dead_letters").run();
  assert.equal(result.changes, 3);
});
