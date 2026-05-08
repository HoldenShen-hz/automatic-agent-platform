import assert from "node:assert/strict";
import test from "node:test";

import {
  getEventSchema,
  hasEventSchema,
  validateEventPayload,
} from "../../../../../src/platform/state-evidence/events/event-registry.js";

const CONFIG_EVENT_TYPES = [
  "config.changed",
  "config.rollout.started",
  "config.rollout.promoted",
  "config.rollout.cancelled",
  "config.rollout.auto_progressed",
  "config.drift_detected",
] as const;

test("config-center event types are registered in the durable event registry", () => {
  for (const eventType of CONFIG_EVENT_TYPES) {
    assert.equal(hasEventSchema(eventType), true, `${eventType} should be registered`);
    assert.equal(getEventSchema(eventType).tier, "tier_2");
  }
});

test("config-center event payloads accept generic object records", () => {
  const payload = validateEventPayload("config.drift_detected", {
    generatedAt: "2026-05-08T00:00:00.000Z",
    baselineSource: "defaults",
    observedSources: ["runtime"],
    blocking: true,
    findingCount: 1,
    findings: [
      {
        key: "sandboxMode",
        expectedValue: "strict",
        observedValue: "permissive",
        observedSource: "runtime",
        severity: "blocking",
      },
    ],
  });

  assert.equal(payload.findingCount, 1);
  assert.equal(payload.blocking, true);
});
