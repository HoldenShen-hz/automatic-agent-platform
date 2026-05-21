import assert from "node:assert/strict";
import test from "node:test";

import { ProactiveAgentService, type TriggerDefinition } from "../../../src/interaction/proactive-agent/index.js";
import { shouldConsumeProactiveEvent } from "../../../src/interaction/proactive-agent/event-watcher/index.js";
import { resolveTriggerActionMode } from "../../../src/interaction/proactive-agent/trigger-engine/index.js";

function createTrigger(overrides: Partial<TriggerDefinition> = {}): TriggerDefinition {
  return {
    triggerId: "trigger-1",
    domainId: "general_ops",
    name: "trigger-1",
    type: "schedule",
    config: {
      cron: "0 * * * *",
      timezone: "UTC",
      skipIfPreviousRunning: true,
    },
    action: {
      actionType: "create_task",
      template: {},
      requireConfirmation: false,
    },
    enabled: true,
    riskLevel: "critical",
    maxFireRate: "5/hour",
    cooldown: "5m",
    ...overrides,
  };
}

test("critical proactive actions remain silent_record without confirmation", () => {
  assert.equal(resolveTriggerActionMode(false, "critical"), "silent_record");
});

test("schedule trigger evaluation treats cron dispatch as an external scheduler concern", async () => {
  const matchingService = new ProactiveAgentService();
  await matchingService.registerTrigger({
    triggerId: "cron-trigger",
    kind: "schedule",
    expression: "0 9 * * *",
    timezone: "Asia/Shanghai",
  });
  const nonMatchingService = new ProactiveAgentService();
  await nonMatchingService.registerTrigger({
    triggerId: "cron-trigger",
    kind: "schedule",
    expression: "0 9 * * *",
    timezone: "Asia/Shanghai",
  });

  const matching = matchingService.evaluate("cron-trigger", {
    kind: "schedule",
    now: "2026-05-20T01:00:00.000Z",
  });
  const nonMatching = nonMatchingService.evaluate("cron-trigger", {
    kind: "schedule",
    now: "2026-05-20T00:59:00.000Z",
  });

  assert.equal(matching.allowed, true);
  assert.equal(nonMatching.allowed, true);
  assert.deepEqual(matching.reasonCodes, ["proactive_agent.fire_allowed"]);
  assert.deepEqual(nonMatching.reasonCodes, ["proactive_agent.fire_allowed"]);
});

test("event watcher supports wildcard and regex patterns", () => {
  assert.equal(
    shouldConsumeProactiveEvent({ source: "task", name: "task_failed" }, "task", "task_*"),
    true,
  );
  assert.equal(
    shouldConsumeProactiveEvent({ source: "task", name: "task_failed" }, "task", "/task_(failed|timed_out)/"),
    true,
  );
  assert.equal(
    shouldConsumeProactiveEvent({ source: "task", name: "task_ok" }, "task", "task_*"),
    true,
  );
  assert.equal(
    shouldConsumeProactiveEvent({ source: "task", name: "worker_failed" }, "task", "task_*"),
    false,
  );
});

test("proactive agent rejects invalid schedule timezone", async () => {
  const service = new ProactiveAgentService();
  await assert.rejects(
    () => service.registerTrigger(createTrigger({
      config: {
        cron: "0 * * * *",
        timezone: "Mars/Phobos",
        skipIfPreviousRunning: true,
      },
    })),
    /proactive_agent\.invalid_timezone/,
  );
});

test("proactive agent fails closed for invalid cooldown and rate limit config", async () => {
  const service = new ProactiveAgentService({ initialAutonomyLevel: "semi_auto" });
  await service.registerTrigger(createTrigger({
    cooldown: "broken",
    maxFireRate: "oops",
  }));

  const decision = service.evaluate("trigger-1", {
    kind: "schedule",
    now: "2026-05-20T00:00:00.000Z",
  });

  assert.equal(decision.allowed, false);
  assert.ok(decision.reasonCodes.includes("proactive_agent.invalid_cooldown"));
  assert.ok(decision.reasonCodes.includes("proactive_agent.invalid_rate_limit"));
});

test("proactive event triggers consume wildcard patterns end-to-end", async () => {
  const service = new ProactiveAgentService({ initialAutonomyLevel: "semi_auto" });
  await service.registerTrigger(createTrigger({
    triggerId: "event-trigger",
    type: "event",
    riskLevel: "medium",
    config: {
      eventSource: "task",
      eventPattern: "task_*",
      filter: { severity: "high" },
    },
  }));

  const allowed = service.evaluate("event-trigger", {
    kind: "event",
    event: {
      source: "task",
      name: "task_failed",
      payload: { severity: "high" },
    },
  });
  const blocked = service.evaluate("event-trigger", {
    kind: "event",
    event: {
      source: "task",
      name: "worker_failed",
      payload: { severity: "high" },
    },
  });

  assert.equal(allowed.allowed, true);
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.reasonCodes.includes("proactive_agent.trigger_condition_not_met"));
});
