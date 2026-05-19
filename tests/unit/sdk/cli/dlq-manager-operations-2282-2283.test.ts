import assert from "node:assert/strict";
import test from "node:test";

import { buildUsageText, parseArguments } from "../../../../src/sdk/cli/dlq-manager.ts";

test("2282: parseArguments validates retry limit and confirmation", () => {
  const parsed = parseArguments({
    action: "retry",
    queue: "jobs",
    "retry-limit": "12",
    yes: true,
  });
  assert.equal(parsed.retryLimit, 12);
  assert.equal(parsed.confirmed, true);
});

test("2282: parseArguments rejects invalid retry-limit", () => {
  assert.throws(
    () => parseArguments({ action: "retry", queue: "jobs", "retry-limit": "abc" }),
    /Invalid retry-limit/,
  );
});

test("2282: parseArguments clamps list limit to safe bounds", () => {
  assert.equal(parseArguments({ action: "list", queue: "gateway", limit: "0" }).limit, 1);
  assert.equal(parseArguments({ action: "list", queue: "gateway", limit: "9999" }).limit, 500);
});

test("2283: parseArguments exposes help text and explicit purge confirmation", () => {
  const parsed = parseArguments({ help: true });
  assert.equal(parsed.help, true);
  assert.match(buildUsageText(), /AA_DLQ_PURGE_CONFIRM=yes/);
  assert.equal(parseArguments({ action: "purge", queue: "events", yes: true }).confirmed, true);
});
