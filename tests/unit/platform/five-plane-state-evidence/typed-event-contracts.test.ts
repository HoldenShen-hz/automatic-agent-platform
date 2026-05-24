import assert from "node:assert/strict";
import test from "node:test";

import {
  getEventReplayMetadata,
  getEventSchema,
  isCanonicalEventName,
} from "../../../../src/platform/five-plane-state-evidence/events/event-registry.js";
import type { TypedEventPayloadMap } from "../../../../src/platform/five-plane-state-evidence/events/typed-event-bus.js";

test("typed event payload map uses the current observe and plugin payload contracts", () => {
  const observePayload: TypedEventPayloadMap["observe:signals_collected"] = {
    runId: "run-1",
    loopIteration: 1,
    signalCount: 2,
    signalTypes: ["telemetry", "logs"],
    observedAt: "2026-05-09T00:00:00.000Z",
  };
  const pluginIsolationPayload: TypedEventPayloadMap["plugin:error_isolated"] = {
    pluginId: "plugin-1",
    domainId: "domain-1",
    spiType: "tool",
    phase: "execute",
    lifecycleState: "isolated",
    occurredAt: "2026-05-09T00:00:00.000Z",
  };

  assert.equal(observePayload.signalTypes.length, 2);
  assert.equal(pluginIsolationPayload.phase, "execute");
});

test("event registry exposes stable schema and replay metadata for canonical events", () => {
  const observeSchema = getEventSchema("observe:signals_collected");
  const replayMetadata = getEventReplayMetadata("platform.harness_run.status_changed");

  assert.equal(observeSchema.producer, "oapeflir_orchestrator");
  assert.deepEqual(observeSchema.consumers, ["oapeflir_projection", "truth_projector"]);
  assert.equal(observeSchema.compatibilityPolicy, "backward_compatible_additive");
  assert.match(observeSchema.payloadSchemaRef, /observe\/signals_collected\/v1$/);
  assert.equal(replayMetadata.sourceOfTruth, "platform");
  assert.equal(replayMetadata.replayBehavior, "replay_as_fact");
  assert.equal(isCanonicalEventName("oapeflir.stage.completed"), true);
  assert.equal(isCanonicalEventName("task:status_changed"), false);
});
