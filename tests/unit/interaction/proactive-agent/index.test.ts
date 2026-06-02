import assert from "node:assert/strict";
import test from "node:test";

import { ProactiveAgentService, type TriggerDefinition, type ThresholdTriggerConfig, type EventTriggerConfig } from "../../../../src/interaction/proactive-agent/index.js";

function makeTrigger(overrides: Partial<TriggerDefinition> = {}): TriggerDefinition {
  return {
    triggerId: "trigger_daily_report",
    domainId: "general-ops",
    name: "daily report",
    type: "schedule",
    config: {
      cron: "0 9 * * *",
      timezone: "Asia/Shanghai",
      skipIfPreviousRunning: true,
    },
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

test("ProactiveAgentService queues suggestions for confirmation-required triggers", async () => {
  const service = new ProactiveAgentService();
  await service.registerTrigger(makeTrigger());

  const decision = service.evaluate("trigger_daily_report", {
    kind: "schedule",
    now: "2026-04-19T01:00:00.000Z",
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.actionMode, "suggest");
  assert.ok(decision.queuedSuggestionId);
  assert.equal(service.listSuggestions().length, 1);
});

test("ProactiveAgentService enforces domain daily trigger budget", async () => {
  const service = new ProactiveAgentService({
    dailyTriggerBudgetByDomain: {
      "general-ops": 1,
    },
  });
  await service.registerTrigger(makeTrigger({ action: { actionType: "create_task", template: {}, requireConfirmation: false } }));

  const first = service.evaluate("trigger_daily_report", {
    kind: "schedule",
    now: "2026-04-19T01:00:00.000Z",
  });
  const second = service.evaluate("trigger_daily_report", {
    kind: "schedule",
    now: "2026-04-19T07:00:00.000Z",
  });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
  assert.ok(second.reasonCodes.includes("proactive_agent.domain_budget_exhausted"));
});

test("ProactiveAgentService disables trigger after repeated failures", async () => {
  const service = new ProactiveAgentService({ maxConsecutiveFailures: 1 });
  await service.registerTrigger(makeTrigger());

  service.recordExecutionOutcome("trigger_daily_report", false);
  const decision = service.evaluate("trigger_daily_report", {
    kind: "schedule",
    now: "2026-04-19T01:00:00.000Z",
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("proactive_agent.trigger_disabled"));
});

test("R23-05: ProactiveAgentService blocks firing below semi_auto autonomy", async () => {
  const service = new ProactiveAgentService({ initialAutonomyLevel: "suggestion" });
  await service.registerTrigger(makeTrigger({
    action: { actionType: "create_task", template: {}, requireConfirmation: false },
  }));

  const decision = service.evaluate("trigger_daily_report", {
    kind: "schedule",
    now: "2026-04-19T01:00:00.000Z",
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("proactive_agent.autonomy_level_insufficient"));
  assert.equal(decision.queuedSuggestionId, null);
});

test("R23-05: ProactiveAgentService allows firing once autonomy reaches semi_auto", async () => {
  const service = new ProactiveAgentService({ initialAutonomyLevel: "suggestion" });
  await service.registerTrigger(makeTrigger({
    action: { actionType: "create_task", template: {}, requireConfirmation: false },
  }));

  service.setAutonomyLevel("semi_auto");
  const decision = service.evaluate("trigger_daily_report", {
    kind: "schedule",
    now: "2026-04-19T01:00:00.000Z",
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.actionMode, "auto_execute");
});

// §41 Additional tests for comprehensive coverage

test("ProactiveAgentService listTriggers returns all registered triggers", async () => {
  const service = new ProactiveAgentService();
  await service.registerTrigger(makeTrigger({ triggerId: "trigger_1", domainId: "domain_a" }));
  await service.registerTrigger(makeTrigger({ triggerId: "trigger_2", domainId: "domain_b" }));

  const all = service.listTriggers();
  assert.equal(all.length, 2);

  const domainA = service.listTriggers("domain_a");
  assert.equal(domainA.length, 1);
  assert.equal(domainA[0]!.triggerId, "trigger_1");
});

test("ProactiveAgentService listSuggestions filters by domain", async () => {
  const service = new ProactiveAgentService();
  await service.registerTrigger(makeTrigger({ triggerId: "trigger_1", domainId: "domain_a", action: { actionType: "suggest_to_user", template: {}, requireConfirmation: true } }));
  await service.registerTrigger(makeTrigger({ triggerId: "trigger_2", domainId: "domain_b", action: { actionType: "suggest_to_user", template: {}, requireConfirmation: true } }));

  service.evaluate("trigger_1", { kind: "schedule", now: "2026-04-19T01:00:00.000Z" });
  service.evaluate("trigger_2", { kind: "schedule", now: "2026-04-20T01:00:00.000Z" });

  const all = service.listSuggestions();
  assert.equal(all.length, 2);

  const domainA = service.listSuggestions("domain_a");
  assert.equal(domainA.length, 1);
  assert.equal(domainA[0]!.triggerId, "trigger_1");
});

test("ProactiveAgentService acknowledgeSuggestion removes suggestion", async () => {
  const service = new ProactiveAgentService();
  await service.registerTrigger(makeTrigger());

  service.evaluate("trigger_daily_report", { kind: "schedule", now: "2026-04-19T01:00:00.000Z" });
  assert.equal(service.listSuggestions().length, 1);

  const suggestionId = service.listSuggestions()[0]!.suggestionId;
  const removed = service.acknowledgeSuggestion(suggestionId);
  assert.equal(removed, true);
  assert.equal(service.listSuggestions().length, 0);
});

test("ProactiveAgentService acknowledgeSuggestion returns false for unknown id", () => {
  const service = new ProactiveAgentService();
  const removed = service.acknowledgeSuggestion("unknown-id");
  assert.equal(removed, false);
});

test("ProactiveAgentService evaluate returns trigger_not_found for unknown trigger", () => {
  const service = new ProactiveAgentService();
  const decision = service.evaluate("unknown_trigger", { kind: "schedule" });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("proactive_agent.trigger_not_found"));
});

test("ProactiveAgentService evaluate returns trigger_disabled when trigger is disabled", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeTrigger({ enabled: false }));

  const decision = service.evaluate("trigger_daily_report", { kind: "schedule" });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("proactive_agent.trigger_disabled"));
});

test("ProactiveAgentService evaluate enforces cooldown period", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeTrigger({ cooldown: "1h" }));

  const first = service.evaluate("trigger_daily_report", { kind: "schedule", now: "2026-04-19T01:00:00.000Z" });
  assert.equal(first.allowed, true);

  const second = service.evaluate("trigger_daily_report", { kind: "schedule", now: "2026-04-19T01:30:00.000Z" });
  assert.equal(second.allowed, false);
  assert.ok(second.reasonCodes.includes("proactive_agent.cooldown_active"));
});

test("ProactiveAgentService evaluate enforces rate limiting", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeTrigger({ maxFireRate: "2/hour", cooldown: "0s" }));

  const first = service.evaluate("trigger_daily_report", { kind: "schedule", now: "2026-04-19T01:00:00.000Z" });
  const second = service.evaluate("trigger_daily_report", { kind: "schedule", now: "2026-04-19T01:00:00.000Z" });
  const third = service.evaluate("trigger_daily_report", { kind: "schedule", now: "2026-04-19T01:00:00.000Z" });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.ok(third.reasonCodes.includes("proactive_agent.rate_limited"));
});

test("ProactiveAgentService evaluate matches event triggers correctly", () => {
  const service = new ProactiveAgentService();
  const eventConfig: EventTriggerConfig = {
    eventSource: "task",
    eventPattern: "task_*",
    filter: { severity: "high" },
  };
  service.registerTrigger(makeTrigger({
    triggerId: "event_trigger",
    type: "event",
    config: eventConfig,
  }));

  const matchingEvent = {
    kind: "event" as const,
    event: { source: "task", name: "task_failed", payload: { severity: "high" } },
  };
  const nonMatchingEvent = {
    kind: "event" as const,
    event: { source: "task", name: "task_failed", payload: { severity: "low" } },
  };
  const wrongSource = {
    kind: "event" as const,
    event: { source: "worker", name: "task_failed", payload: { severity: "high" } },
  };

  const decision1 = service.evaluate("event_trigger", matchingEvent);
  assert.equal(decision1.allowed, true);

  const decision2 = service.evaluate("event_trigger", nonMatchingEvent);
  assert.equal(decision2.allowed, false);
  assert.ok(decision2.reasonCodes.includes("proactive_agent.trigger_condition_not_met"));

  const decision3 = service.evaluate("event_trigger", wrongSource);
  assert.equal(decision3.allowed, false);
});

test("ProactiveAgentService evaluate matches threshold triggers correctly", () => {
  const service = new ProactiveAgentService();
  const thresholdConfig: ThresholdTriggerConfig = {
    metricSource: "system",
    metricName: "cpu_usage",
    condition: "gt",
    threshold: 80,
    evaluationWindow: "5m",
    consecutiveBreaches: 1,
  };
  service.registerTrigger(makeTrigger({
    triggerId: "threshold_trigger",
    type: "threshold",
    config: thresholdConfig,
  }));

  const belowThreshold = {
    kind: "threshold" as const,
    metric: { source: "system", name: "cpu_usage", value: 50 },
  };
  const aboveThreshold = {
    kind: "threshold" as const,
    metric: { source: "system", name: "cpu_usage", value: 85 },
  };
  const wrongMetric = {
    kind: "threshold" as const,
    metric: { source: "system", name: "memory_usage", value: 85 },
  };

  const decision1 = service.evaluate("threshold_trigger", belowThreshold);
  assert.equal(decision1.allowed, false);

  const decision2 = service.evaluate("threshold_trigger", aboveThreshold);
  assert.equal(decision2.allowed, true);

  const decision3 = service.evaluate("threshold_trigger", wrongMetric);
  assert.equal(decision3.allowed, false);
});

test("ProactiveAgentService evaluate handles auto_execute for no-confirmation low-risk triggers", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeTrigger({
    action: { actionType: "create_task", template: {}, requireConfirmation: false },
  }));

  const decision = service.evaluate("trigger_daily_report", { kind: "schedule" });

  assert.equal(decision.allowed, true);
  assert.equal(decision.actionMode, "auto_execute");
  assert.equal(decision.queuedSuggestionId, null);
});

test("ProactiveAgentService evaluate handles silent_record for dashboard updates", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeTrigger({
    action: { actionType: "update_dashboard", template: {}, requireConfirmation: false },
  }));

  const decision = service.evaluate("trigger_daily_report", { kind: "schedule" });

  assert.equal(decision.allowed, true);
  assert.equal(decision.actionMode, "silent_record");
});

test("ProactiveAgentService evaluate records silently for critical-risk without confirmation", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeTrigger({
    riskLevel: "critical",
    action: { actionType: "create_task", template: {}, requireConfirmation: false },
  }));

  const decision = service.evaluate("trigger_daily_report", { kind: "schedule" });

  assert.equal(decision.allowed, true);
  assert.equal(decision.actionMode, "silent_record");
});

test("ProactiveAgentService recordExecutionOutcome does not open circuit before max threshold", () => {
  const service = new ProactiveAgentService({ maxConsecutiveFailures: 3 });
  service.registerTrigger(makeTrigger());

  service.recordExecutionOutcome("trigger_daily_report", false);
  service.recordExecutionOutcome("trigger_daily_report", false);

  const decision = service.evaluate("trigger_daily_report", { kind: "schedule" });
  assert.equal(decision.allowed, true);
  assert.ok(decision.reasonCodes.includes("proactive_agent.fire_allowed"));
});

test("ProactiveAgentService recordExecutionOutcome resets on success", () => {
  const service = new ProactiveAgentService({ maxConsecutiveFailures: 3 });
  service.registerTrigger(makeTrigger());

  service.recordExecutionOutcome("trigger_daily_report", false);
  service.recordExecutionOutcome("trigger_daily_report", false);
  // Success resets consecutive failures
  service.recordExecutionOutcome("trigger_daily_report", true);

  // Should still be allowed since maxConsecutiveFailures=3 and we've only had 2 failures
  const decision = service.evaluate("trigger_daily_report", { kind: "schedule" });
  assert.equal(decision.allowed, true);
});

test("ProactiveAgentService registerTrigger validates declared triggers", async () => {
  const service = new ProactiveAgentService({
    declaredTriggerIdsByDomain: { "general-ops": ["allowed_trigger"] },
  });

  await assert.rejects(
    async () => service.registerTrigger(makeTrigger({ triggerId: "not_declared" })),
    /proactive_agent.trigger_not_declared/,
  );
});

test("ProactiveAgentService circuit opens after maxConsecutiveFailures", () => {
  const service = new ProactiveAgentService({ maxConsecutiveFailures: 2 });
  service.registerTrigger(makeTrigger());

  // First failure
  service.recordExecutionOutcome("trigger_daily_report", false);
  let decision = service.evaluate("trigger_daily_report", { kind: "schedule" });
  assert.equal(decision.allowed, true); // Still enabled

  // Second failure - circuit opens
  service.recordExecutionOutcome("trigger_daily_report", false);
  decision = service.evaluate("trigger_daily_report", { kind: "schedule" });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("proactive_agent.trigger_disabled"));
});

test("ProactiveAgentService threshold change_rate condition", () => {
  const service = new ProactiveAgentService();
  const thresholdConfig: ThresholdTriggerConfig = {
    metricSource: "system",
    metricName: "error_rate",
    condition: "change_rate_gt",
    threshold: 0.5,
    evaluationWindow: "5m",
    consecutiveBreaches: 1,
  };
  service.registerTrigger(makeTrigger({
    triggerId: "change_trigger",
    type: "threshold",
    config: thresholdConfig,
  }));

  const stable = {
    kind: "threshold" as const,
    metric: { source: "system", name: "error_rate", value: 10, previousValue: 10 },
  };
  const changing = {
    kind: "threshold" as const,
    metric: { source: "system", name: "error_rate", value: 15, previousValue: 5 },
  };

  const decision1 = service.evaluate("change_trigger", stable);
  assert.equal(decision1.allowed, false);

  const decision2 = service.evaluate("change_trigger", changing);
  assert.equal(decision2.allowed, true);
});
