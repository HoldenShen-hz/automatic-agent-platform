import assert from "node:assert/strict";
import test from "node:test";

import { shouldRunScheduleTrigger } from "../../../../../src/interaction/proactive-agent/schedule-manager/index.js";

test("shouldRunScheduleTrigger returns true when lastFiredAt is null", () => {
  assert.equal(shouldRunScheduleTrigger(null, "2026-04-26T12:00:00Z", "1h"), true);
});

test("shouldRunScheduleTrigger returns true when cooldown has passed", () => {
  const lastFiredAt = "2026-04-26T10:00:00Z";
  const nowIso = "2026-04-26T12:00:00Z";
  assert.equal(shouldRunScheduleTrigger(lastFiredAt, nowIso, "1h"), true);
});

test("shouldRunScheduleTrigger returns false when cooldown has not passed", () => {
  const lastFiredAt = "2026-04-26T11:00:00Z";
  const nowIso = "2026-04-26T11:30:00Z";
  assert.equal(shouldRunScheduleTrigger(lastFiredAt, nowIso, "1h"), false);
});

test("shouldRunScheduleTrigger handles exact cooldown boundary", () => {
  const lastFiredAt = "2026-04-26T11:00:00Z";
  const nowIso = "2026-04-26T12:00:00Z";
  assert.equal(shouldRunScheduleTrigger(lastFiredAt, nowIso, "1h"), true);
});

test("shouldRunScheduleTrigger handles seconds cooldown", () => {
  const lastFiredAt = "2026-04-26T11:59:30Z";
  const nowIso = "2026-04-26T12:00:00Z";
  assert.equal(shouldRunScheduleTrigger(lastFiredAt, nowIso, "30s"), true);
});

test("shouldRunScheduleTrigger handles day cooldown", () => {
  const lastFiredAt = "2026-04-20T12:00:00Z";
  const nowIso = "2026-04-26T12:00:00Z";
  assert.equal(shouldRunScheduleTrigger(lastFiredAt, nowIso, "1d"), true);
});

test("shouldRunScheduleTrigger handles minutes cooldown", () => {
  const lastFiredAt = "2026-04-26T11:58:00Z";
  const nowIso = "2026-04-26T12:00:00Z";
  assert.equal(shouldRunScheduleTrigger(lastFiredAt, nowIso, "2m"), true);
});

test("shouldRunScheduleTrigger handles millisecond cooldown", () => {
  const lastFiredAt = "2026-04-26T11:59:59.500Z";
  const nowIso = "2026-04-26T12:00:00.000Z";
  assert.equal(shouldRunScheduleTrigger(lastFiredAt, nowIso, "500ms"), true);
});

test("shouldRunScheduleTrigger cooldown not met with sub-minute remaining", () => {
  const lastFiredAt = "2026-04-26T11:59:45Z";
  const nowIso = "2026-04-26T12:00:00Z";
  assert.equal(shouldRunScheduleTrigger(lastFiredAt, nowIso, "30m"), false);
});