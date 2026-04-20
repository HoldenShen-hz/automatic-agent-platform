import assert from "node:assert/strict";
import test from "node:test";

import { ProactiveAgentService, type TriggerDefinition } from "../../../../src/interaction/proactive-agent/index.js";

function makeTrigger(overrides: Partial<TriggerDefinition> = {}): TriggerDefinition {
  return {
    triggerId: "trigger_daily_report",
    domainId: "general_ops",
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
      general_ops: 1,
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
