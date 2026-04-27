/**
 * Integration Test: Proactive Agent Service
 *
 * Tests the integration of trigger registration, evaluation, suggestion queuing,
 * execution outcome recording, and circuit breaker behavior.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { ProactiveAgentService, type TriggerDefinition, type TriggerEvaluationInput } from "../../../src/interaction/proactive-agent/index.js";

function createService(options?: { maxConsecutiveFailures?: number; dailyTriggerBudgetByDomain?: Record<string, number> }): ProactiveAgentService {
  return new ProactiveAgentService(options);
}

function makeScheduleTrigger(overrides: Partial<TriggerDefinition> = {}): TriggerDefinition {
  return {
    triggerId: "schedule_trigger_1",
    domainId: "engineering_ops",
    name: "Hourly Backup Check",
    type: "schedule",
    config: {
      cron: "0 * * * *",
      timezone: "UTC",
      skipIfPreviousRunning: true,
    },
    action: {
      actionType: "create_task",
      template: { taskType: "backup_check" },
      requireConfirmation: false,
    },
    enabled: true,
    riskLevel: "low",
    maxFireRate: "10/hour",
    cooldown: "5m",
    ...overrides,
  };
}

function makeEventTrigger(overrides: Partial<TriggerDefinition> = {}): TriggerDefinition {
  return {
    triggerId: "event_trigger_1",
    domainId: "customer_support",
    name: "High Priority Ticket Alert",
    type: "event",
    config: {
      eventSource: "ticketing",
      eventPattern: "ticket_created",
      filter: { priority: "high" },
    },
    action: {
      actionType: "suggest_to_user",
      template: { message: "New high priority ticket" },
      requireConfirmation: true,
    },
    enabled: true,
    riskLevel: "medium",
    maxFireRate: "20/hour",
    cooldown: "2m",
    ...overrides,
  };
}

function makeThresholdTrigger(overrides: Partial<TriggerDefinition> = {}): TriggerDefinition {
  return {
    triggerId: "threshold_trigger_1",
    domainId: "platform",
    name: "High Error Rate Alert",
    type: "threshold",
    config: {
      metricSource: "monitoring",
      metricName: "error_rate",
      condition: "gt",
      threshold: 5,
      evaluationWindow: "5m",
      consecutiveBreaches: 2,
    },
    action: {
      actionType: "update_dashboard",
      template: { alertLevel: "warning" },
      requireConfirmation: false,
    },
    enabled: true,
    riskLevel: "high",
    maxFireRate: "5/hour",
    cooldown: "15m",
    ...overrides,
  };
}

test("integration: ProactiveAgentService registers and lists schedule triggers", async () => {
  const service = createService();

  await service.registerTrigger(makeScheduleTrigger());
  await service.registerTrigger(makeScheduleTrigger({
    triggerId: "schedule_trigger_2",
    domainId: "engineering_ops",
    name: "Daily Cleanup",
  }));

  const triggers = service.listTriggers("engineering_ops");
  assert.equal(triggers.length, 2);
  assert.ok(triggers.some((t) => t.triggerId === "schedule_trigger_1"));
  assert.ok(triggers.some((t) => t.triggerId === "schedule_trigger_2"));
});

test("integration: ProactiveAgentService registers and lists event triggers", async () => {
  const service = createService();

  await service.registerTrigger(makeEventTrigger());

  const triggers = service.listTriggers("customer_support");
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0]?.triggerId, "event_trigger_1");
});

test("integration: ProactiveAgentService evaluates schedule trigger successfully", async () => {
  const service = createService();
  await service.registerTrigger(makeScheduleTrigger());

  const decision = service.evaluate("schedule_trigger_1", {
    kind: "schedule",
    now: new Date().toISOString(),
  });

  assert.equal(decision.allowed, true);
  assert.ok(decision.reasonCodes.includes("proactive_agent.fire_allowed"));
});

test("integration: ProactiveAgentService enforces cooldown between fires", async () => {
  const service = createService();
  await service.registerTrigger(makeScheduleTrigger({ cooldown: "1h" }));

  // First evaluation - should be allowed
  const decision1 = service.evaluate("schedule_trigger_1", {
    kind: "schedule",
    now: "2026-04-19T10:00:00.000Z",
  });
  assert.equal(decision1.allowed, true);

  // Second evaluation 1 minute later - should be blocked by cooldown
  const decision2 = service.evaluate("schedule_trigger_1", {
    kind: "schedule",
    now: "2026-04-19T10:01:00.000Z",
  });
  assert.equal(decision2.allowed, false);
  assert.ok(decision2.reasonCodes.includes("proactive_agent.cooldown_active"));
});

test("integration: ProactiveAgentService enforces rate limiting", async () => {
  const service = createService();
  await service.registerTrigger(makeScheduleTrigger({ maxFireRate: "2/hour" }));

  // Fire once
  service.evaluate("schedule_trigger_1", { kind: "schedule", now: "2026-04-19T10:00:00.000Z" });
  // Fire second time
  service.evaluate("schedule_trigger_1", { kind: "schedule", now: "2026-04-19T10:30:00.000Z" });
  // Third time should be rate limited (2/hour means max 2 per hour)
  const decision = service.evaluate("schedule_trigger_1", { kind: "schedule", now: "2026-04-19T11:00:00.000Z" });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("proactive_agent.rate_limited"));
});

test("integration: ProactiveAgentService circuit breaker disables trigger after max failures", async () => {
  const service = createService({ maxConsecutiveFailures: 3 });

  await service.registerTrigger(makeScheduleTrigger({ riskLevel: "medium" }));

  // Record 3 failures
  service.recordExecutionOutcome("schedule_trigger_1", false);
  service.recordExecutionOutcome("schedule_trigger_1", false);
  service.recordExecutionOutcome("schedule_trigger_1", false);

  // Trigger should now be disabled
  const decision = service.evaluate("schedule_trigger_1", { kind: "schedule", now: new Date().toISOString() });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("proactive_agent.circuit_open"));
});

test("integration: ProactiveAgentService resets failure count on success", async () => {
  const service = createService({ maxConsecutiveFailures: 3 });
  await service.registerTrigger(makeScheduleTrigger());

  // Record some failures
  service.recordExecutionOutcome("schedule_trigger_1", false);
  service.recordExecutionOutcome("schedule_trigger_1", false);

  // Record success
  service.recordExecutionOutcome("schedule_trigger_1", true);

  // Fire should be allowed (failure count reset)
  const decision = service.evaluate("schedule_trigger_1", { kind: "schedule", now: new Date().toISOString() });
  assert.equal(decision.allowed, true);
});

test("integration: ProactiveAgentService evaluates event trigger with matching filter", async () => {
  const service = createService();
  await service.registerTrigger(makeEventTrigger());

  const decision = service.evaluate("event_trigger_1", {
    kind: "event",
    event: {
      source: "ticketing",
      name: "ticket_created",
      payload: { priority: "high", ticketId: "T-123" },
    },
  });

  assert.equal(decision.allowed, true);
});

test("integration: ProactiveAgentService event trigger fails non-matching filter", async () => {
  const service = createService();
  await service.registerTrigger(makeEventTrigger());

  const decision = service.evaluate("event_trigger_1", {
    kind: "event",
    event: {
      source: "ticketing",
      name: "ticket_created",
      payload: { priority: "low", ticketId: "T-456" },
    },
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("proactive_agent.trigger_condition_not_met"));
});

test("integration: ProactiveAgentService evaluates threshold trigger with matching condition", async () => {
  const service = createService();
  await service.registerTrigger(makeThresholdTrigger());

  const decision = service.evaluate("threshold_trigger_1", {
    kind: "threshold",
    metric: {
      source: "monitoring",
      name: "error_rate",
      value: 6,
      previousValue: 3,
    },
  });

  assert.equal(decision.allowed, true);
});

test("integration: ProactiveAgentService threshold trigger fails when condition not met", async () => {
  const service = createService();
  await service.registerTrigger(makeThresholdTrigger({ config: { ...makeThresholdTrigger().config, condition: "gt" as const, threshold: 10 } }));

  const decision = service.evaluate("threshold_trigger_1", {
    kind: "threshold",
    metric: {
      source: "monitoring",
      name: "error_rate",
      value: 5, // below threshold of 10
      previousValue: 3,
    },
  });

  assert.equal(decision.allowed, false);
});

test("integration: ProactiveAgentService enqueues suggestion when requireConfirmation is true", async () => {
  const service = createService();
  await service.registerTrigger(makeEventTrigger({ action: { actionType: "suggest_to_user", template: {}, requireConfirmation: true } }));

  const decision = service.evaluate("event_trigger_1", {
    kind: "event",
    event: { source: "ticketing", name: "ticket_created", payload: { priority: "high" } },
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.actionMode, "suggest");
  assert.ok(decision.queuedSuggestionId !== null);

  const suggestions = service.listSuggestions();
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0]?.suggestionId, decision.queuedSuggestionId);
});

test("integration: ProactiveAgentService auto_execute for low risk without confirmation", async () => {
  const service = createService();
  await service.registerTrigger(makeScheduleTrigger({ action: { actionType: "create_task", template: {}, requireConfirmation: false }, riskLevel: "low" }));

  const decision = service.evaluate("schedule_trigger_1", { kind: "schedule", now: new Date().toISOString() });

  assert.equal(decision.allowed, true);
  assert.equal(decision.actionMode, "auto_execute");
  assert.equal(decision.queuedSuggestionId, null);
});

test("integration: ProactiveAgentService silent_record for critical risk", async () => {
  const service = createService();
  await service.registerTrigger(makeThresholdTrigger({ riskLevel: "critical", action: { actionType: "update_dashboard", template: {}, requireConfirmation: false } }));

  const decision = service.evaluate("threshold_trigger_1", {
    kind: "threshold",
    metric: { source: "monitoring", name: "error_rate", value: 10 },
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.actionMode, "silent_record");
});

test("integration: ProactiveAgentService acknowledges and removes suggestion", async () => {
  const service = createService();
  await service.registerTrigger(makeEventTrigger());

  service.evaluate("event_trigger_1", {
    kind: "event",
    event: { source: "ticketing", name: "ticket_created", payload: { priority: "high" } },
  });

  const suggestionsBefore = service.listSuggestions();
  assert.equal(suggestionsBefore.length, 1);

  const suggestionId = suggestionsBefore[0]!.suggestionId;
  const acknowledged = service.acknowledgeSuggestion(suggestionId);
  assert.equal(acknowledged, true);

  const suggestionsAfter = service.listSuggestions();
  assert.equal(suggestionsAfter.length, 0);
});

test("integration: ProactiveAgentService enforces daily budget per domain", async () => {
  const service = createService({ dailyTriggerBudgetByDomain: { engineering_ops: 2 } });
  await service.registerTrigger(makeScheduleTrigger({ domainId: "engineering_ops" }));
  await service.registerTrigger(makeScheduleTrigger({ triggerId: "schedule_trigger_2", domainId: "engineering_ops" }));

  // Fire first trigger - uses budget
  service.evaluate("schedule_trigger_1", { kind: "schedule", now: "2026-04-19T10:00:00.000Z" });
  // Fire second trigger - uses remaining budget
  service.evaluate("schedule_trigger_2", { kind: "schedule", now: "2026-04-19T10:30:00.000Z" });

  // Try to fire again - should be blocked
  const decision = service.evaluate("schedule_trigger_1", { kind: "schedule", now: "2026-04-19T11:00:00.000Z" });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("proactive_agent.domain_budget_exhausted"));
});

test("integration: ProactiveAgentService returns trigger not found for unknown trigger", async () => {
  const service = createService();

  const decision = service.evaluate("unknown_trigger", { kind: "schedule", now: new Date().toISOString() });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("proactive_agent.trigger_not_found"));
});

test("integration: ProactiveAgentService filters triggers by domain when listing", async () => {
  const service = createService();
  await service.registerTrigger(makeScheduleTrigger({ domainId: "engineering_ops" }));
  await service.registerTrigger(makeEventTrigger({ domainId: "customer_support" }));

  const engineeringTriggers = service.listTriggers("engineering_ops");
  assert.equal(engineeringTriggers.length, 1);
  assert.equal(engineeringTriggers[0]?.domainId, "engineering_ops");

  const supportTriggers = service.listTriggers("customer_support");
  assert.equal(supportTriggers.length, 1);
  assert.equal(supportTriggers[0]?.domainId, "customer_support");
});

test("integration: ProactiveAgentService listTriggers without domain returns all", async () => {
  const service = createService();
  await service.registerTrigger(makeScheduleTrigger());
  await service.registerTrigger(makeEventTrigger());

  const allTriggers = service.listTriggers();
  assert.equal(allTriggers.length, 2);
});