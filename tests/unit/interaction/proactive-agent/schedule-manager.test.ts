/**
 * Unit tests for schedule-manager utilities
 */

import assert from "node:assert/strict";
import test from "node:test";
import { shouldRunScheduleTrigger } from "../../../../src/interaction/proactive-agent/schedule-manager/index.js";

test("shouldRunScheduleTrigger returns true when lastFiredAt is null", () => {
  const result = shouldRunScheduleTrigger(null, "2026-04-19T01:00:00.000Z", "5m");
  assert.equal(result, true);
});

test("shouldRunScheduleTrigger returns true when cooldown has elapsed", () => {
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T01:06:00.000Z", "5m");
  assert.equal(result, true);
});

test("shouldRunScheduleTrigger returns false when within cooldown period", () => {
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T01:03:00.000Z", "5m");
  assert.equal(result, false);
});

test("shouldRunScheduleTrigger handles millisecond duration", () => {
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T01:00:00.500Z", "500ms");
  assert.equal(result, true);
});

test("shouldRunScheduleTrigger handles hour duration", () => {
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T02:00:00.000Z", "1h");
  assert.equal(result, true);
});

test("shouldRunScheduleTrigger handles day duration", () => {
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-20T01:00:01.000Z", "1d");
  assert.equal(result, true);
});

test("shouldRunScheduleTrigger returns false when cooldown not yet met", () => {
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T01:59:00.000Z", "1h");
  assert.equal(result, false);
});

test("shouldRunScheduleTrigger returns false when cooldown not yet met for 1d", () => {
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T23:00:00.000Z", "1d");
  assert.equal(result, false);
});

test("shouldRunScheduleTrigger exact boundary for second duration", () => {
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T01:00:03.000Z", "3s");
  assert.equal(result, true);
});

test("shouldRunScheduleTrigger still returns false just before second boundary", () => {
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T01:00:02.999Z", "3s");
  assert.equal(result, false);
});

test("shouldRunScheduleTrigger fires immediately for unparseable cooldown string (0ms cooldown)", () => {
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T01:10:00.000Z", "invalid");
  assert.equal(result, true);
});

test("shouldRunScheduleTrigger fires immediately for empty cooldown string (0ms cooldown)", () => {
  const result = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T01:10:00.000Z", "");
  assert.equal(result, true);
});
