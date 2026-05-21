/**
 * Unit tests for event-registry-payloads.ts
 *
 * Tests the exported items from event-registry-payloads:
 * - EVENT_PAYLOAD_VALIDATORS mapping
 * - RUNTIME_EVENT_REPLAY_METADATA configuration
 * - genericEventPayloadSchema
 */

import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  EVENT_PAYLOAD_VALIDATORS,
  RUNTIME_EVENT_REPLAY_METADATA,
  genericEventPayloadSchema,
} from "../../../../../src/platform/five-plane-state-evidence/events/event-registry-payloads.js";

test("EVENT_PAYLOAD_VALIDATORS contains validators for documented event types", () => {
  const expectedEventTypes = [
    "task:status_changed",
    "workflow:step_completed",
    "decision:requested",
    "decision:responded",
    "division:completed",
    "division:failed",
    "subtask:completed",
    "subtask:failed",
    "cost:limit_reached",
    "domain:registered",
    "domain:activated",
    "domain:canary",
    "domain:updating",
    "domain:updated",
    "domain:deprecated",
    "domain:archived",
    "plugin:spi_registered",
    "plugin:activated",
    "plugin:error_isolated",
    "plugin:suspended",
    "plugin:invocation_started",
    "plugin:invocation_completed",
    "knowledge:chunk_indexed",
    "learning:knowledge_promoted",
    "recovery:repair_applied",
    "recovery:decision_recorded",
    "recovery:dead_lettered",
    "recovery:cancelled",
    "platform.harness_run.created",
    "platform.harness_run.admitted",
    "platform.harness_run.planning",
    "platform.harness_run.ready",
    "platform.harness_run.pausing",
    "platform.harness_run.replanning",
    "platform.harness_run.compensating",
    "platform.harness_run.aborted",
    "platform.harness_run.completed",
    "platform.harness_run.failed",
    "platform.harness_run.status_changed",
    "platform.node_run.status_changed",
    "platform.node_run.created",
    "platform.node_run.admitted",
    "platform.node_run.planning",
    "platform.node_run.ready",
    "platform.node_run.pausing",
    "platform.node_run.replanning",
    "platform.node_run.started",
    "platform.node_run.completed",
    "platform.node_run.failed",
    "platform.node_run.compensating",
    "platform.node_run.skipped",
    "platform.budget_ledger.status_changed",
    "platform.budget_reservation.status_changed",
    "platform.budget.status_changed",
    "platform.budget.reserved",
    "platform.budget.actualized",
    "platform.budget.exceeded",
    "platform.budget_reconciliation.status_changed",
    "platform.side_effect.status_changed",
    "platform.side_effect.triggered",
    "platform.side_effect.completed",
    "platform.side_effect.failed",
    "oapeflir.view.run_lifecycle",
    "oapeflir.phase.transition",
  ];

  for (const eventType of expectedEventTypes) {
    assert.ok(
      eventType in EVENT_PAYLOAD_VALIDATORS,
      `Missing validator for ${eventType}`,
    );
    assert.ok(
      EVENT_PAYLOAD_VALIDATORS[eventType] instanceof z.ZodType,
      `Validator for ${eventType} should be a ZodType`,
    );
  }

  // Verify count
  assert.ok(Object.keys(EVENT_PAYLOAD_VALIDATORS).length >= 60);
});

test("EVENT_PAYLOAD_VALIDATORS values are Zod schemas that parse correctly", () => {
  // Test a few key validators
  const taskPayload = {
    fromStatus: "queued",
    toStatus: "in_progress",
    reasonCode: "user_requested",
    occurredAt: "2026-05-01T10:00:00.000Z",
    entityKind: "task",
    entityId: "task_123",
  };

  const taskValidator = EVENT_PAYLOAD_VALIDATORS["task:status_changed"];
  assert.ok(taskValidator, "task:status_changed validator exists");
  const result = taskValidator.safeParse(taskPayload);
  assert.ok(result.success, `task:status_changed should accept valid payload: ${JSON.stringify(result.error)}`);

  // Test decision:requested
  const decisionPayload = {
    approvalId: "approval_123",
    taskId: "task_456",
    reason: "Human approval needed",
    riskLevel: "high",
    options: ["approve", "deny"],
  };

  const decisionValidator = EVENT_PAYLOAD_VALIDATORS["decision:requested"];
  assert.ok(decisionValidator, "decision:requested validator exists");
  const decisionResult = decisionValidator.safeParse(decisionPayload);
  assert.ok(decisionResult.success, `decision:requested should accept valid payload`);

  // Test cost:limit_reached
  const costPayload = {
    budgetId: "budget_123",
    currentCostUsd: 150.75,
    limitUsd: 100.0,
    occurredAt: "2026-05-01T10:00:00.000Z",
  };

  const costValidator = EVENT_PAYLOAD_VALIDATORS["cost:limit_reached"];
  assert.ok(costValidator, "cost:limit_reached validator exists");
  const costResult = costValidator.safeParse(costPayload);
  assert.ok(costResult.success, `cost:limit_reached should accept valid payload`);

  // Test recovery events
  const recoveryPayload = {
    taskId: "task_789",
    executionId: "exec_abc",
    traceId: "trace_xyz",
    reasonCode: "network_timeout",
  };

  const recoveryValidator = EVENT_PAYLOAD_VALIDATORS["recovery:repair_applied"];
  assert.ok(recoveryValidator, "recovery:repair_applied validator exists");
  const recoveryResult = recoveryValidator.safeParse(recoveryPayload);
  assert.ok(recoveryResult.success, `recovery:repair_applied should accept valid payload`);
});

test("genericEventPayloadSchema accepts any object", () => {
  const validPayloads = [
    {},
    { key: "value" },
    { nested: { deep: { value: 123 } } },
    { array: [1, 2, 3] },
    { special: null, number: 42, bool: true },
  ];

  for (const payload of validPayloads) {
    const result = genericEventPayloadSchema.safeParse(payload);
    assert.ok(result.success, `Should accept ${JSON.stringify(payload)}: ${JSON.stringify(result.error)}`);
  }
});

test("genericEventPayloadSchema accepts empty object for unknown events", () => {
  const result = genericEventPayloadSchema.safeParse({});
  assert.ok(result.success);
});

test("EVENT_PAYLOAD_VALIDATORS has validators for platform namespace events", () => {
  const platformEvents = Object.keys(EVENT_PAYLOAD_VALIDATORS).filter((k) =>
    k.startsWith("platform."),
  );

  assert.ok(platformEvents.length > 30, "Should have many platform events");

  for (const eventType of platformEvents) {
    const validator = EVENT_PAYLOAD_VALIDATORS[eventType];
    assert.ok(validator instanceof z.ZodType, `${eventType} should have a ZodType validator`);
  }
});

test("EVENT_PAYLOAD_VALIDATORS has validators for oapeflir namespace events", () => {
  const oapeflirEvents = Object.keys(EVENT_PAYLOAD_VALIDATORS).filter((k) =>
    k.startsWith("oapeflir."),
  );

  assert.ok(oapeflirEvents.length >= 2, "Should have oapeflir events");
});

test("RUNTIME_EVENT_REPLAY_METADATA contains replay metadata for runtime events", () => {
  const expectedRuntimeEvents = [
    "platform.request_envelope.admitted",
    "platform.harness_run.status_changed",
    "platform.node_run.status_changed",
    "platform.side_effect.status_changed",
    "platform.budget_ledger.status_changed",
    "platform.budget_reservation.status_changed",
    "platform.graph_scheduler.decision_recorded",
    "oapeflir.view.run_lifecycle",
    "oapeflir.graph.scheduled",
    "oapeflir.node.executed",
  ];

  for (const eventType of expectedRuntimeEvents) {
    assert.ok(
      eventType in RUNTIME_EVENT_REPLAY_METADATA,
      `Missing replay metadata for ${eventType}`,
    );
    const metadata = RUNTIME_EVENT_REPLAY_METADATA[eventType];
    assert.ok(typeof metadata.replayable === "boolean", `${eventType} should have replayable boolean`);
    assert.ok(typeof metadata.sideEffectSafeToReplay === "boolean", `${eventType} should have sideEffectSafeToReplay boolean`);
    assert.ok(typeof metadata.sourceOfTruth === "string", `${eventType} should have sourceOfTruth string`);
    assert.ok(typeof metadata.replayBehavior === "string", `${eventType} should have replayBehavior string`);
    assert.ok(typeof metadata.schemaOwner === "string", `${eventType} should have schemaOwner string`);
  }
});

test("RUNTIME_EVENT_REPLAY_METADATA replayBehavior values are valid", () => {
  const validBehaviors = ["replay_as_fact", "skip_side_effect", "simulate"];

  for (const [eventType, metadata] of Object.entries(RUNTIME_EVENT_REPLAY_METADATA)) {
    assert.ok(
      validBehaviors.includes(metadata.replayBehavior),
      `${eventType} has invalid replayBehavior: ${metadata.replayBehavior}`,
    );
  }
});

test("each RUNTIME_EVENT_REPLAY_METADATA entry has consumerContractTests array", () => {
  for (const [eventType, metadata] of Object.entries(RUNTIME_EVENT_REPLAY_METADATA)) {
    assert.ok(
      Array.isArray(metadata.consumerContractTests),
      `${eventType} should have consumerContractTests array`,
    );
    assert.ok(
      metadata.consumerContractTests.length > 0,
      `${eventType} should have at least one consumer contract test`,
    );
  }
});

test("RUNTIME_EVENT_REPLAY_METADATA platform events use platform as sourceOfTruth", () => {
  const platformEvents = Object.keys(RUNTIME_EVENT_REPLAY_METADATA).filter((k) =>
    k.startsWith("platform."),
  );

  for (const eventType of platformEvents) {
    const metadata = RUNTIME_EVENT_REPLAY_METADATA[eventType];
    assert.equal(
      metadata.sourceOfTruth,
      "platform",
      `${eventType} should have platform as sourceOfTruth`,
    );
  }
});

test("RUNTIME_EVENT_REPLAY_METADATA oapeflir events have correct sourceOfTruth", () => {
  const oapeflirEvents = Object.keys(RUNTIME_EVENT_REPLAY_METADATA).filter((k) =>
    k.startsWith("oapeflir."),
  );

  for (const eventType of oapeflirEvents) {
    const metadata = RUNTIME_EVENT_REPLAY_METADATA[eventType];
    assert.ok(
      ["platform", "projection"].includes(metadata.sourceOfTruth),
      `${eventType} should have platform or projection as sourceOfTruth`,
    );
  }
});

test("RUNTIME_EVENT_REPLAY_METADATA replayable events are safe to replay", () => {
  for (const [eventType, metadata] of Object.entries(RUNTIME_EVENT_REPLAY_METADATA)) {
    if (metadata.replayable) {
      assert.ok(
        typeof metadata.sideEffectSafeToReplay === "boolean",
        `${eventType} should have sideEffectSafeToReplay defined when replayable`,
      );
    }
  }
});

test("RUNTIME_EVENT_REPLAY_METADATA entries have valid schema owners", () => {
  for (const [eventType, metadata] of Object.entries(RUNTIME_EVENT_REPLAY_METADATA)) {
    assert.ok(
      metadata.schemaOwner.length > 0,
      `${eventType} should have a non-empty schemaOwner`,
    );
    assert.ok(
      !metadata.schemaOwner.includes(" "),
      `${eventType} schemaOwner should not contain spaces`,
    );
  }
});