/**
 * R23-02: medium/high risk should use suggestion mode, not auto_execute
 *
 * §41.1 requires medium+ risk to use suggestion mode.
 * This test verifies that ProactiveAgentService.evaluate() returns "suggest"
 * for medium and high risk actions (not "auto_execute").
 *
 * The fix is in trigger-engine/resolveTriggerActionMode:
 * - low risk: auto_execute (allowed)
 * - medium risk: suggest (required by §41.1)
 * - high risk: suggest (required by §41.1)
 * - critical risk: silent_record (always blocked)
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ProactiveAgentService } from "../../../../../src/interaction/proactive-agent/index.js";
import type { TriggerEvaluationInput } from "../../../../../src/interaction/proactive-agent/index.js";

test("R23-02: medium risk trigger returns suggest mode, not auto_execute", async () => {
  const service = new ProactiveAgentService();

  await service.registerTrigger({
    triggerId: "trigger-medium-risk",
    domainId: "test_domain",
    name: "Medium Risk Trigger",
    type: "event",
    config: { eventSource: "test", eventPattern: "test_event", filter: {} },
    action: {
      actionType: "create_task",
      template: { task: "test" },
      requireConfirmation: false,  // No explicit confirmation required
    },
    enabled: true,
    riskLevel: "medium",
    maxFireRate: "100/hour",
    cooldown: "1m",
  });

  const decision = service.evaluate("trigger-medium-risk", {
    kind: "event",
    event: { source: "test", name: "test_event", payload: {} },
  });

  assert.equal(decision.allowed, true, "Medium risk trigger should be allowed");
  // R23-02 FIX: medium risk must return "suggest", not "auto_execute"
  assert.equal(decision.actionMode, "suggest",
    "Medium risk must use suggestion mode per §41.1, not auto_execute");
});

test("R23-02: high risk trigger returns suggest mode, not auto_execute", async () => {
  const service = new ProactiveAgentService();

  await service.registerTrigger({
    triggerId: "trigger-high-risk",
    domainId: "test_domain",
    name: "High Risk Trigger",
    type: "condition",
    config: { metricSource: "test", metricName: "test_metric", condition: "gt", threshold: 80 },
    action: {
      actionType: "create_task",
      template: { task: "urgent_fix" },
      requireConfirmation: false,
    },
    enabled: true,
    riskLevel: "high",
    maxFireRate: "10/hour",
    cooldown: "1m",
  });

  const decision = service.evaluate("trigger-high-risk", {
    kind: "condition",
    metric: { source: "test", name: "test_metric", value: 95, previousValue: 70 },
  });

  assert.equal(decision.allowed, true, "High risk trigger should be allowed");
  // R23-02 FIX: high risk must return "suggest", not "auto_execute"
  assert.equal(decision.actionMode, "suggest",
    "High risk must use suggestion mode per §41.1, not auto_execute");
});

test("R23-02: low risk trigger can still use auto_execute", async () => {
  const service = new ProactiveAgentService();

  await service.registerTrigger({
    triggerId: "trigger-low-risk",
    domainId: "test_domain",
    name: "Low Risk Trigger",
    type: "event",
    config: { eventSource: "test", eventPattern: "test_event", filter: {} },
    action: {
      actionType: "create_task",
      template: { task: "low_priority" },
      requireConfirmation: false,
    },
    enabled: true,
    riskLevel: "low",
    maxFireRate: "100/hour",
    cooldown: "1m",
  });

  const decision = service.evaluate("trigger-low-risk", {
    kind: "event",
    event: { source: "test", name: "test_event", payload: {} },
  });

  assert.equal(decision.allowed, true, "Low risk trigger should be allowed");
  // Low risk is allowed to auto_execute (per §41.1)
  assert.equal(decision.actionMode, "auto_execute",
    "Low risk can use auto_execute mode");
});

test("R23-02: critical risk trigger returns silent_record", async () => {
  const service = new ProactiveAgentService();

  await service.registerTrigger({
    triggerId: "trigger-critical-risk",
    domainId: "test_domain",
    name: "Critical Risk Trigger",
    type: "event",
    config: { eventSource: "test", eventPattern: "critical_event", filter: {} },
    action: {
      actionType: "create_task",
      template: { task: "emergency" },
      requireConfirmation: false,
    },
    enabled: true,
    riskLevel: "critical",
    maxFireRate: "100/hour",
    cooldown: "1m",
  });

  const decision = service.evaluate("trigger-critical-risk", {
    kind: "event",
    event: { source: "test", name: "critical_event", payload: {} },
  });

  assert.equal(decision.allowed, true, "Critical risk trigger should be allowed");
  // Critical risk always returns silent_record
  assert.equal(decision.actionMode, "silent_record",
    "Critical risk must use silent_record mode");
});

test("R23-02: medium risk with explicit confirmation still returns suggest", async () => {
  const service = new ProactiveAgentService();

  await service.registerTrigger({
    triggerId: "trigger-medium-with-confirm",
    domainId: "test_domain",
    name: "Medium Risk With Confirmation",
    type: "event",
    config: { eventSource: "test", eventPattern: "test_event", filter: {} },
    action: {
      actionType: "create_task",
      template: { task: "test" },
      requireConfirmation: true,  // Explicit confirmation required
    },
    enabled: true,
    riskLevel: "medium",
    maxFireRate: "100/hour",
    cooldown: "1m",
  });

  const decision = service.evaluate("trigger-medium-with-confirm", {
    kind: "event",
    event: { source: "test", name: "test_event", payload: {} },
  });

  assert.equal(decision.allowed, true);
  // With requireConfirmation=true, should return "suggest" (already correct)
  assert.equal(decision.actionMode, "suggest",
    "Medium risk with confirmation required must use suggest mode");
});

test("R23-02: suggestion mode enqueues suggestion for medium risk", async () => {
  const service = new ProactiveAgentService();

  await service.registerTrigger({
    triggerId: "trigger-medium-suggest",
    domainId: "test_domain",
    name: "Medium Risk Suggestion",
    type: "event",
    config: { eventSource: "test", eventPattern: "test_event", filter: {} },
    action: {
      actionType: "suggest_to_user",
      template: { suggestion: "do something" },
      requireConfirmation: false,
    },
    enabled: true,
    riskLevel: "medium",
    maxFireRate: "100/hour",
    cooldown: "1m",
  });

  const decision = service.evaluate("trigger-medium-suggest", {
    kind: "event",
    event: { source: "test", name: "test_event", payload: {} },
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.actionMode, "suggest",
    "Medium risk must return suggest mode");
  // suggestion mode should enqueue a suggestion
  assert.ok(decision.queuedSuggestionId != null,
    "suggest mode must enqueue a suggestion with queuedSuggestionId");
});

test("R23-02: suggestion mode enqueues suggestion for high risk", async () => {
  const service = new ProactiveAgentService();

  await service.registerTrigger({
    triggerId: "trigger-high-suggest",
    domainId: "test_domain",
    name: "High Risk Suggestion",
    type: "event",
    config: { eventSource: "test", eventPattern: "test_event", filter: {} },
    action: {
      actionType: "suggest_to_user",
      template: { suggestion: "do something urgent" },
      requireConfirmation: false,
    },
    enabled: true,
    riskLevel: "high",
    maxFireRate: "100/hour",
    cooldown: "1m",
  });

  const decision = service.evaluate("trigger-high-suggest", {
    kind: "event",
    event: { source: "test", name: "test_event", payload: {} },
  });

  assert.equal(decision.allowed, true);
  assert.equal(decision.actionMode, "suggest",
    "High risk must return suggest mode");
  // suggestion mode should enqueue a suggestion
  assert.ok(decision.queuedSuggestionId != null,
    "suggest mode must enqueue a suggestion with queuedSuggestionId");
});

test("R23-02: all risk levels produce valid action modes", async () => {
  const service = new ProactiveAgentService();
  const validModes = ["auto_execute", "suggest", "silent_record"] as const;
  const riskLevels: Array<"low" | "medium" | "high" | "critical"> = ["low", "medium", "high", "critical"];

  for (const riskLevel of riskLevels) {
    await service.registerTrigger({
      triggerId: `trigger-${riskLevel}-valid-modes`,
      domainId: "test_domain",
      name: `${riskLevel} Risk Test`,
      type: "event",
      config: { eventSource: "test", eventPattern: "test_event", filter: {} },
      action: {
        actionType: "create_task",
        template: { task: "test" },
        requireConfirmation: false,
      },
      enabled: true,
      riskLevel,
      maxFireRate: "100/hour",
      cooldown: "1m",
    });

    const decision = service.evaluate(`trigger-${riskLevel}-valid-modes`, {
      kind: "event",
      event: { source: "test", name: "test_event", payload: {} },
    });

    assert.ok(validModes.includes(decision.actionMode),
      `Invalid action mode for ${riskLevel} risk: ${decision.actionMode}`);
  }
});