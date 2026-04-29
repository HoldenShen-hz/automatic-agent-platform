import assert from "node:assert/strict";
import test from "node:test";

import {
  ProactiveAgentService,
  type TriggerDefinition,
  type ScheduleTriggerConfig,
  type EventTriggerConfig,
} from "../../../src/interaction/proactive-agent/index.js";
import { shouldRunScheduleTrigger } from "../../../src/interaction/proactive-agent/schedule-manager/index.js";
import { shouldConsumeProactiveEvent } from "../../../src/interaction/proactive-agent/event-watcher/index.js";

function makeScheduleTrigger(overrides: Partial<TriggerDefinition> = {}): TriggerDefinition {
  return {
    triggerId: "trigger_integration_test",
    domainId: "general_ops",
    name: "integration test trigger",
    type: "schedule",
    config: {
      cron: "0 9 * * *",
      timezone: "UTC",
      skipIfPreviousRunning: true,
    } as ScheduleTriggerConfig,
    action: {
      actionType: "suggest_to_user",
      template: {},
      requireConfirmation: true,
    },
    enabled: true,
    riskLevel: "low",
    maxFireRate: "10/hour",
    cooldown: "5m",
    ...overrides,
  };
}

test("integration: ProactiveAgentService with schedule manager", async () => {
  const service = new ProactiveAgentService();
  await service.registerTrigger(makeScheduleTrigger({ triggerId: "scheduled_trigger" }));

  // Evaluate once
  const first = service.evaluate("scheduled_trigger", {
    kind: "schedule",
    now: "2026-04-19T01:00:00.000Z",
  });
  assert.equal(first.allowed, true);

  // Check cooldown via schedule manager
  const shouldRun = shouldRunScheduleTrigger("2026-04-19T01:00:00.000Z", "2026-04-19T01:03:00.000Z", "5m");
  assert.equal(shouldRun, false);
});

test("integration: ProactiveAgentService with event watcher", async () => {
  const service = new ProactiveAgentService();
  await service.registerTrigger({
    triggerId: "event_trigger",
    domainId: "monitoring",
    name: "task failure event",
    type: "event",
    config: {
      eventSource: "task",
      eventPattern: "failed",
      filter: { severity: "high" },
    } as EventTriggerConfig,
    action: {
      actionType: "create_task",
      template: { title: "Investigate failure" },
      requireConfirmation: false,
    },
    enabled: true,
    riskLevel: "medium",
    maxFireRate: "5/hour",
    cooldown: "10m",
  });

  const event = { source: "task", name: "task_failed", payload: { severity: "high" } };
  const shouldConsume = shouldConsumeProactiveEvent(event, "task", "failed");
  assert.equal(shouldConsume, true);

  const decision = service.evaluate("event_trigger", {
    kind: "event",
    event,
  });
  assert.equal(decision.allowed, true);
});

test("integration: ProactiveAgentService feedback loop detection", async () => {
  const service = new ProactiveAgentService({
    declaredTriggerIdsByDomain: {
      general_ops: ["trigger_a", "trigger_b", "trigger_c"],
    },
  });

  // Register triggers with circular feedback
  await service.registerTrigger({
    triggerId: "trigger_a",
    domainId: "general_ops",
    name: "trigger A",
    type: "schedule",
    config: { cron: "0 9 * * *", timezone: "UTC", skipIfPreviousRunning: true } as ScheduleTriggerConfig,
    action: { actionType: "suggest_to_user", template: {}, requireConfirmation: true },
    enabled: true,
    riskLevel: "low",
    maxFireRate: "10/hour",
    cooldown: "5m",
    feedbackTargetTriggerIds: ["trigger_b"],
  });

  await service.registerTrigger({
    triggerId: "trigger_b",
    domainId: "general_ops",
    name: "trigger B",
    type: "schedule",
    config: { cron: "0 9 * * *", timezone: "UTC", skipIfPreviousRunning: true } as ScheduleTriggerConfig,
    action: { actionType: "suggest_to_user", template: {}, requireConfirmation: true },
    enabled: true,
    riskLevel: "low",
    maxFireRate: "10/hour",
    cooldown: "5m",
    feedbackTargetTriggerIds: ["trigger_c"],
  });

  await service.registerTrigger({
    triggerId: "trigger_c",
    domainId: "general_ops",
    name: "trigger C",
    type: "schedule",
    config: { cron: "0 9 * * *", timezone: "UTC", skipIfPreviousRunning: true } as ScheduleTriggerConfig,
    action: { actionType: "suggest_to_user", template: {}, requireConfirmation: true },
    enabled: true,
    riskLevel: "low",
    maxFireRate: "10/hour",
    cooldown: "5m",
    feedbackTargetTriggerIds: ["trigger_a"], // Creates cycle
  });

  const incidents = service.listIncidents();
  assert.ok(incidents.length > 0);
  assert.equal(incidents[0]!.reasonCode, "proactive_agent.feedback_loop_detected");
});

test("integration: trigger execution outcome recording", async () => {
  const service = new ProactiveAgentService({ maxConsecutiveFailures: 2 });
  await service.registerTrigger(makeScheduleTrigger());

  // First failure
  service.recordExecutionOutcome("trigger_integration_test", false);
  let decision = service.evaluate("trigger_integration_test", { kind: "schedule" });
  assert.equal(decision.allowed, true);

  // Second failure - circuit opens
  service.recordExecutionOutcome("trigger_integration_test", false);
  decision = service.evaluate("trigger_integration_test", { kind: "schedule" });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("proactive_agent.circuit_open"));
});

test("integration: suggestion lifecycle", async () => {
  const service = new ProactiveAgentService();
  await service.registerTrigger(makeScheduleTrigger({
    action: { actionType: "suggest_to_user", template: {}, requireConfirmation: true },
  }));

  service.evaluate("trigger_integration_test", { kind: "schedule", now: "2026-04-19T01:00:00.000Z" });

  const suggestions = service.listSuggestions();
  assert.equal(suggestions.length, 1);

  const suggestionId = suggestions[0]!.suggestionId;
  const acknowledged = service.acknowledgeSuggestion(suggestionId);
  assert.equal(acknowledged, true);

  const remaining = service.listSuggestions();
  assert.equal(remaining.length, 0);
});
