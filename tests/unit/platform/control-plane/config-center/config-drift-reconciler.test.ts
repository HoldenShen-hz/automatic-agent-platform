import assert from "node:assert/strict";
import test from "node:test";

import { ConfigDriftReconciler } from "../../../../../src/platform/five-plane-control-plane/config-center/config-drift-reconciler.js";

interface MockEventBus {
  publish: (event: { eventType: string; payload: Record<string, unknown> }) => void;
  getEvents: () => Array<{ eventType: string; payload: Record<string, unknown> }>;
}

function createMockEventBus(): MockEventBus {
  const events: Array<{ eventType: string; payload: Record<string, unknown> }> = [];
  return {
    publish(event: { eventType: string; payload: Record<string, unknown> }) {
      events.push(event);
    },
    getEvents() {
      return events;
    },
  };
}

test("ConfigDriftReconciler emits config.drift_detected when drift is found", () => {
  const eventBus = createMockEventBus();
  const reconciler = new ConfigDriftReconciler({
    eventBus: eventBus as unknown as import("../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js").DurableEventBus,
  });

  const report = reconciler.reconcile({
    baseline: {
      sourceName: "defaults",
      values: { sandboxMode: "strict", timeoutMs: 30000 },
    },
    observed: [
      {
        sourceName: "runtime",
        values: { sandboxMode: "permissive", timeoutMs: 30000 },
      },
    ],
    blockingKeys: ["sandboxMode"],
    generatedAt: "2026-05-08T00:00:00.000Z",
  });

  assert.equal(report.blocking, true);
  assert.equal(report.findings.length, 1);

  const events = eventBus.getEvents();
  assert.equal(events.length, 1);
  assert.equal(events[0]?.eventType, "config.drift_detected");
  assert.equal(events[0]?.payload.blocking, true);
  assert.equal(events[0]?.payload.findingCount, 1);
});

test("ConfigDriftReconciler does not emit incident when no drift is found", () => {
  const eventBus = createMockEventBus();
  const reconciler = new ConfigDriftReconciler({
    eventBus: eventBus as unknown as import("../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js").DurableEventBus,
  });

  const report = reconciler.reconcile({
    baseline: {
      sourceName: "defaults",
      values: { sandboxMode: "strict" },
    },
    observed: [
      {
        sourceName: "runtime",
        values: { sandboxMode: "strict" },
      },
    ],
    generatedAt: "2026-05-08T00:00:00.000Z",
  });

  assert.equal(report.findings.length, 0);
  assert.equal(eventBus.getEvents().length, 0);
});

test("ConfigDriftReconciler can disable incident emission", () => {
  const eventBus = createMockEventBus();
  const reconciler = new ConfigDriftReconciler({
    eventBus: eventBus as unknown as import("../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js").DurableEventBus,
    emitIncidents: false,
  });

  reconciler.reconcile({
    baseline: {
      sourceName: "defaults",
      values: { maxAgentRounds: 6 },
    },
    observed: [
      {
        sourceName: "environment",
        values: { maxAgentRounds: 8 },
      },
    ],
    generatedAt: "2026-05-08T00:00:00.000Z",
  });

  assert.equal(eventBus.getEvents().length, 0);
});
