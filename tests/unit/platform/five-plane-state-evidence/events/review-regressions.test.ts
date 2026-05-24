import assert from "node:assert/strict";
import test from "node:test";

import { hasEventSchema, validateEventPayload } from "../../../../../src/platform/five-plane-state-evidence/events/event-registry.js";
import type { TypedEventPayloadMap } from "../../../../../src/platform/five-plane-state-evidence/events/typed-event-bus.js";

test("event registry includes canonical tier-1 schemas beyond the legacy original nine", () => {
  assert.equal(hasEventSchema("platform.harness_run.created"), true);
  assert.equal(hasEventSchema("platform.node_run.failed"), true);
  assert.equal(hasEventSchema("platform.side_effect.failed"), true);
  assert.equal(hasEventSchema("platform.budget.actualized"), true);
  assert.equal(hasEventSchema("oapeflir.phase.transition"), true);
});

test("typed event payload map covers canonical harness, side-effect, budget, and oapeflir events", () => {
  const payloads: Pick<
    TypedEventPayloadMap,
    | "platform.harness_run.created"
    | "platform.node_run.failed"
    | "platform.side_effect.failed"
    | "platform.budget.actualized"
    | "oapeflir.phase.transition"
  > = {
    "platform.harness_run.created": { runId: "run-1", taskId: "task-1", occurredAt: "2026-05-04T00:00:00.000Z" },
    "platform.node_run.failed": { runId: "run-1", nodeId: "node-1", taskId: "task-1", occurredAt: "2026-05-04T00:00:00.000Z" },
    "platform.side_effect.failed": { runId: "run-1", sideEffectId: "se-1", taskId: "task-1", occurredAt: "2026-05-04T00:00:00.000Z" },
    "platform.budget.actualized": { budgetId: "budget-1", amount: 3.25, taskId: "task-1", occurredAt: "2026-05-04T00:00:00.000Z" },
    "oapeflir.phase.transition": { runId: "run-1", fromPhase: "observe", toPhase: "assess", occurredAt: "2026-05-04T00:00:00.000Z" },
  };

  assert.equal(payloads["platform.harness_run.created"].runId, "run-1");
  assert.equal(payloads["platform.budget.actualized"].amount, 3.25);
  assert.equal(payloads["oapeflir.phase.transition"].toPhase, "assess");
});

test("retired delegation prompt and tenant namespaces are not registered event schemas", () => {
  assert.equal(hasEventSchema("delegation:granted"), false);
  assert.equal(hasEventSchema("prompt:version_published"), false);
  assert.equal(hasEventSchema("tenant:quota_exceeded"), false);
});

test("canonical payloads validate against runtime event schema", () => {
  const actualized = validateEventPayload("platform.budget.actualized", {
    budgetId: "budget-1",
    amount: 7.5,
    taskId: "task-1",
    occurredAt: "2026-05-04T00:00:00.000Z",
  });
  const transition = validateEventPayload("oapeflir.phase.transition", {
    runId: "run-1",
    fromPhase: "plan",
    toPhase: "execute",
    occurredAt: "2026-05-04T00:00:00.000Z",
  });

  assert.equal(actualized["amount"], 7.5);
  assert.equal(transition["toPhase"], "execute");
});
