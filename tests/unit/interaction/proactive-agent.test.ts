import assert from "node:assert/strict";
import test from "node:test";

import {
  ProactiveAgentService,
  type ProactiveTrigger,
  type TriggerDefinition,
  type ScheduleTriggerConfig,
  type EventTriggerConfig,
  type ThresholdTriggerConfig,
  type TriggerEvaluationInput,
} from "../../../src/interaction/proactive-agent/index.js";

// --- Helpers ---

function makeScheduleTrigger(overrides: Partial<TriggerDefinition> = {}): TriggerDefinition {
  return {
    triggerId: "trigger_daily_report",
    domainId: "general-ops",
    name: "daily report",
    type: "schedule",
    config: {
      cron: "0 9 * * *",
      timezone: "Asia/Shanghai",
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

function makeEventTrigger(overrides: Partial<TriggerDefinition> = {}): TriggerDefinition {
  return {
    triggerId: "trigger_event",
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
    ...overrides,
  };
}

function makeThresholdTrigger(overrides: Partial<TriggerDefinition> = {}): TriggerDefinition {
  return {
    triggerId: "trigger_threshold",
    domainId: "infrastructure",
    name: "high cpu usage",
    type: "threshold",
    config: {
      metricSource: "system",
      metricName: "cpu_usage",
      condition: "gt",
      threshold: 80,
      evaluationWindow: "5m",
      consecutiveBreaches: 1,
    } as ThresholdTriggerConfig,
    action: {
      actionType: "create_goal",
      template: { title: "Scale infrastructure" },
      requireConfirmation: true,
    },
    enabled: true,
    riskLevel: "high",
    maxFireRate: "3/hour",
    cooldown: "30m",
    ...overrides,
  };
}

// --- Tests ---

test("ProactiveAgentService.registerTrigger stores trigger", async () => {
  const service = new ProactiveAgentService();
  await service.registerTrigger(makeScheduleTrigger());

  const triggers = service.listTriggers();
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0]!.triggerId, "trigger_daily_report");
});

test("ProactiveAgentService.registerTrigger validates declared trigger ids", async () => {
  const service = new ProactiveAgentService({
    declaredTriggerIdsByDomain: { "general-ops": ["allowed_trigger"] },
  });

  await assert.rejects(
    async () => service.registerTrigger(makeScheduleTrigger({ triggerId: "not_declared" })),
    /proactive_agent.trigger_not_declared/,
  );
});

test("ProactiveAgentService.listTriggers filters by domain", async () => {
  const service = new ProactiveAgentService();
  await service.registerTrigger(makeScheduleTrigger({ triggerId: "trigger_1", domainId: "domain_a" }));
  await service.registerTrigger(makeScheduleTrigger({ triggerId: "trigger_2", domainId: "domain_b" }));

  const domainATriggers = service.listTriggers("domain_a");
  assert.equal(domainATriggers.length, 1);
  assert.equal(domainATriggers[0]!.triggerId, "trigger_1");
});

test("ProactiveAgentService.evaluate allows fire when all conditions pass", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeScheduleTrigger());

  const decision = service.evaluate("trigger_daily_report", {
    kind: "schedule",
    now: "2026-04-19T01:00:00.000Z",
  });

  assert.equal(decision.allowed, true);
  assert.ok(decision.reasonCodes.includes("proactive_agent.fire_allowed"));
});

test("ProactiveAgentService.evaluate returns trigger_not_found for unknown trigger", () => {
  const service = new ProactiveAgentService();
  const decision = service.evaluate("unknown_trigger", { kind: "schedule" });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("proactive_agent.trigger_not_found"));
  assert.equal(decision.actionMode, "silent_record");
});

test("ProactiveAgentService.evaluate returns trigger_disabled when trigger is disabled", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeScheduleTrigger({ enabled: false }));

  const decision = service.evaluate("trigger_daily_report", { kind: "schedule" });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("proactive_agent.trigger_disabled"));
});

test("ProactiveAgentService.evaluate enforces cooldown period", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeScheduleTrigger({ cooldown: "1h" }));

  const first = service.evaluate("trigger_daily_report", {
    kind: "schedule",
    now: "2026-04-19T01:00:00.000Z",
  });
  const second = service.evaluate("trigger_daily_report", {
    kind: "schedule",
    now: "2026-04-19T01:30:00.000Z",
  });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false);
  assert.ok(second.reasonCodes.includes("proactive_agent.cooldown_active"));
});

test("ProactiveAgentService.evaluate enforces rate limiting", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeScheduleTrigger({ maxFireRate: "2/hour", cooldown: "1m" }));

  const first = service.evaluate("trigger_daily_report", {
    kind: "schedule",
    now: "2026-04-19T01:00:00.000Z",
  });
  const second = service.evaluate("trigger_daily_report", {
    kind: "schedule",
    now: "2026-04-19T01:01:00.000Z",
  });
  const third = service.evaluate("trigger_daily_report", {
    kind: "schedule",
    now: "2026-04-19T01:02:00.000Z",
  });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.ok(third.reasonCodes.includes("proactive_agent.rate_limited"));
});

test("ProactiveAgentService.evaluate enforces daily trigger budget", () => {
  const service = new ProactiveAgentService({
    dailyTriggerBudgetByDomain: { "general-ops": 1 },
  });
  service.registerTrigger(
    makeScheduleTrigger({ action: { actionType: "create_task", template: {}, requireConfirmation: false } }),
  );

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

test("ProactiveAgentService.evaluate returns circuit_open after consecutive failures", () => {
  const service = new ProactiveAgentService({ maxConsecutiveFailures: 2 });
  service.registerTrigger(makeScheduleTrigger());

  service.recordExecutionOutcome("trigger_daily_report", false);
  service.recordExecutionOutcome("trigger_daily_report", false);

  const decision = service.evaluate("trigger_daily_report", { kind: "schedule" });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("proactive_agent.circuit_open"));
});

test("ProactiveAgentService.recordExecutionOutcome resets on success", () => {
  const service = new ProactiveAgentService({ maxConsecutiveFailures: 3 });
  service.registerTrigger(makeScheduleTrigger());

  service.recordExecutionOutcome("trigger_daily_report", false);
  service.recordExecutionOutcome("trigger_daily_report", false);
  service.recordExecutionOutcome("trigger_daily_report", true); // Success resets

  const decision = service.evaluate("trigger_daily_report", { kind: "schedule" });

  assert.equal(decision.allowed, true);
});

test("ProactiveAgentService.recordExecutionOutcome opens circuit at max failures", () => {
  const service = new ProactiveAgentService({ maxConsecutiveFailures: 2 });
  service.registerTrigger(makeScheduleTrigger());

  service.recordExecutionOutcome("trigger_daily_report", false);
  service.recordExecutionOutcome("trigger_daily_report", false);

  // Trigger should now be disabled
  const decision = service.evaluate("trigger_daily_report", { kind: "schedule" });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("proactive_agent.trigger_disabled"));
});

test("ProactiveAgentService.evaluate matches event triggers by source and pattern", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeEventTrigger());

  const matching = {
    kind: "event" as const,
    event: { source: "task", name: "task_failed", payload: { severity: "high" } },
  };
  const nonMatchingSource = {
    kind: "event" as const,
    event: { source: "worker", name: "task_failed", payload: { severity: "high" } },
  };
  const nonMatchingPayload = {
    kind: "event" as const,
    event: { source: "task", name: "task_failed", payload: { severity: "low" } },
  };

  assert.equal(service.evaluate("trigger_event", matching).allowed, true);
  assert.equal(service.evaluate("trigger_event", nonMatchingSource).allowed, false);
  assert.equal(service.evaluate("trigger_event", nonMatchingPayload).allowed, false);
});

test("ProactiveAgentService.evaluate matches threshold triggers with gt condition", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeThresholdTrigger());

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
    metric: { source: "system", name: "memory_usage", value: 90 },
  };

  assert.equal(service.evaluate("trigger_threshold", belowThreshold).allowed, false);
  assert.equal(service.evaluate("trigger_threshold", aboveThreshold).allowed, true);
  assert.equal(service.evaluate("trigger_threshold", wrongMetric).allowed, false);
});

test("ProactiveAgentService.evaluate matches threshold triggers with lt condition", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeThresholdTrigger({
    config: {
      metricSource: "system",
      metricName: "cpu_usage",
      condition: "lt",
      threshold: 20,
      evaluationWindow: "5m",
      consecutiveBreaches: 1,
    } as ThresholdTriggerConfig,
  }));

  const result = service.evaluate("trigger_threshold", {
    kind: "threshold",
    metric: { source: "system", name: "cpu_usage", value: 15 },
  });

  assert.equal(result.allowed, true);
});

test("ProactiveAgentService.evaluate matches threshold triggers with eq condition", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeThresholdTrigger({
    config: {
      metricSource: "system",
      metricName: "error_count",
      condition: "eq",
      threshold: 0,
      evaluationWindow: "5m",
      consecutiveBreaches: 1,
    } as ThresholdTriggerConfig,
  }));

  const result = service.evaluate("trigger_threshold", {
    kind: "threshold",
    metric: { source: "system", name: "error_count", value: 0 },
  });

  assert.equal(result.allowed, true);
});

test("ProactiveAgentService.evaluate matches threshold triggers with change_rate_gt condition", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeThresholdTrigger({
    triggerId: "change_trigger",
    config: {
      metricSource: "system",
      metricName: "error_rate",
      condition: "change_rate_gt",
      threshold: 0.5,
      evaluationWindow: "5m",
      consecutiveBreaches: 1,
    } as ThresholdTriggerConfig,
  }));

  const stable = {
    kind: "threshold" as const,
    metric: { source: "system", name: "error_rate", value: 10, previousValue: 10 },
  };
  const changing = {
    kind: "threshold" as const,
    metric: { source: "system", name: "error_rate", value: 15, previousValue: 5 },
  };

  assert.equal(service.evaluate("change_trigger", stable).allowed, false);
  assert.equal(service.evaluate("change_trigger", changing).allowed, true);
});

test("ProactiveAgentService.evaluate actionMode suggest for confirmation-required triggers", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeScheduleTrigger());

  const decision = service.evaluate("trigger_daily_report", { kind: "schedule" });

  assert.equal(decision.allowed, true);
  assert.equal(decision.actionMode, "suggest");
  assert.ok(decision.queuedSuggestionId);
});

test("ProactiveAgentService.evaluate actionMode auto_execute for no-confirmation low-risk triggers", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(
    makeScheduleTrigger({ action: { actionType: "create_task", template: {}, requireConfirmation: false } }),
  );

  const decision = service.evaluate("trigger_daily_report", { kind: "schedule" });

  assert.equal(decision.allowed, true);
  assert.equal(decision.actionMode, "auto_execute");
  assert.equal(decision.queuedSuggestionId, null);
});

test("ProactiveAgentService.evaluate actionMode silent_record for dashboard updates", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(
    makeScheduleTrigger({ action: { actionType: "update_dashboard", template: {}, requireConfirmation: false } }),
  );

  const decision = service.evaluate("trigger_daily_report", { kind: "schedule" });

  assert.equal(decision.allowed, true);
  assert.equal(decision.actionMode, "silent_record");
});

test("ProactiveAgentService.evaluate actionMode silent_record for critical-risk without confirmation", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(
    makeScheduleTrigger({
      riskLevel: "critical",
      action: { actionType: "create_task", template: {}, requireConfirmation: false },
    }),
  );

  const decision = service.evaluate("trigger_daily_report", { kind: "schedule" });

  assert.equal(decision.allowed, true);
  assert.equal(decision.actionMode, "silent_record");
});

test("ProactiveAgentService.listSuggestions returns all suggestions", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeScheduleTrigger({ triggerId: "trigger_1" }));
  service.registerTrigger(makeScheduleTrigger({ triggerId: "trigger_2" }));

  service.evaluate("trigger_1", { kind: "schedule", now: "2026-04-19T01:00:00.000Z" });
  service.evaluate("trigger_2", { kind: "schedule", now: "2026-04-19T02:00:00.000Z" });

  const suggestions = service.listSuggestions();
  assert.equal(suggestions.length, 2);
});

test("ProactiveAgentService.listSuggestions filters by domain", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeScheduleTrigger({ triggerId: "trigger_1", domainId: "domain_a" }));
  service.registerTrigger(makeScheduleTrigger({ triggerId: "trigger_2", domainId: "domain_b" }));

  service.evaluate("trigger_1", { kind: "schedule", now: "2026-04-19T01:00:00.000Z" });
  service.evaluate("trigger_2", { kind: "schedule", now: "2026-04-19T02:00:00.000Z" });

  const domainASuggestions = service.listSuggestions("domain_a");
  assert.equal(domainASuggestions.length, 1);
  assert.equal(domainASuggestions[0]!.triggerId, "trigger_1");
});

test("ProactiveAgentService.acknowledgeSuggestion removes suggestion", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeScheduleTrigger());

  service.evaluate("trigger_daily_report", { kind: "schedule", now: "2026-04-19T01:00:00.000Z" });
  assert.equal(service.listSuggestions().length, 1);

  const suggestionId = service.listSuggestions()[0]!.suggestionId;
  const removed = service.acknowledgeSuggestion(suggestionId);

  assert.equal(removed, true);
  assert.equal(service.listSuggestions().length, 0);
});

test("ProactiveAgentService.acknowledgeSuggestion returns false for unknown id", () => {
  const service = new ProactiveAgentService();
  const removed = service.acknowledgeSuggestion("unknown-id");
  assert.equal(removed, false);
});

test("ProactiveAgentService.registerTrigger accepts ProactiveTrigger (legacy conversion)", async () => {
  const service = new ProactiveAgentService();
  const trigger: ProactiveTrigger = {
    triggerId: "proactive_trigger",
    kind: "schedule",
    expression: "0 9 * * *",
  };

  await service.registerTrigger(trigger);

  const triggers = service.listTriggers();
  assert.equal(triggers.length, 1);
  assert.equal(triggers[0]!.type, "schedule");
});

test("ProactiveAgentService.registerTrigger converts signal kind to threshold type", async () => {
  const service = new ProactiveAgentService();
  const trigger: ProactiveTrigger = {
    triggerId: "signal_trigger",
    kind: "signal",
    expression: "cpu_usage",
  };

  await service.registerTrigger(trigger);

  const triggers = service.listTriggers();
  assert.equal(triggers[0]!.type, "condition");
});

test("ProactiveAgentService.evaluate rejects mismatched kind", () => {
  const service = new ProactiveAgentService();
  service.registerTrigger(makeScheduleTrigger());

  const decision = service.evaluate("trigger_daily_report", { kind: "event" });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("proactive_agent.trigger_condition_not_met"));
});
