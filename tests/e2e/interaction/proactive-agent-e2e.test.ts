/**
 * E2E Proactive Agent Tests
 *
 * End-to-end tests covering proactive agent service:
 * 1. Trigger evaluation and scheduling
 * 2. User preference tracking
 * 3. Event watching
 * 4. Action mode resolution
 * 5. Proactive execution flow
 *
 * Uses node:test + node:assert/strict. ESM imports with .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../../helpers/e2e-harness.js";
import { ProactiveAgentService, type TriggerDefinition } from "../../../src/interaction/proactive-agent/index.js";
import { resolveTriggerActionMode } from "../../../src/interaction/proactive-agent/trigger-engine/index.js";
import { UserPreferenceTracker } from "../../../src/interaction/proactive-agent/user-preference-tracker.js";
import type { TriggerEvent, ProactiveAction } from "../../../src/interaction/proactive-agent/types.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createTrigger(overrides: Partial<TriggerDefinition> = {}): TriggerDefinition {
  return {
    triggerId: overrides.triggerId ?? "trigger_e2e_001",
    domainId: overrides.domainId ?? "operations",
    name: overrides.name ?? "High CPU Alert",
    type: overrides.type ?? "threshold",
    config: overrides.config ?? {
      metricSource: "system",
      metricName: "cpu_percent",
      condition: "gt",
      threshold: 90,
      evaluationWindow: "5m",
      consecutiveBreaches: 1,
    },
    action: overrides.action ?? {
      actionType: "suggest_to_user",
      template: { channels: ["dashboard"] },
      requireConfirmation: false,
    },
    enabled: overrides.enabled ?? true,
    riskLevel: overrides.riskLevel ?? "low",
    maxFireRate: overrides.maxFireRate ?? "5/hour",
    cooldown: overrides.cooldown ?? "5m",
    ...overrides,
  };
}

function createTriggerEvent(overrides: Partial<TriggerEvent> = {}): TriggerEvent {
  return {
    eventId: overrides.eventId ?? "event_e2e_001",
    triggerId: overrides.triggerId ?? "trigger_e2e_001",
    type: overrides.type ?? "threshold_breach",
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    context: overrides.context ?? { cpuPercent: 95, memoryPercent: 80 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite 1: Trigger Engine Evaluation
// ---------------------------------------------------------------------------

test("E2E Proactive: ProactiveAgentService evaluates trigger conditions correctly", async () => {
  const harness = createE2EHarness("aa-e2e-proactive-");
  try {
    const service = new ProactiveAgentService();

    // Register trigger
    const trigger = createTrigger({
      config: {
        metricSource: "system",
        metricName: "cpu_percent",
        condition: "gt",
        threshold: 90,
        evaluationWindow: "5m",
        consecutiveBreaches: 1,
      },
    });
    await service.registerTrigger(trigger);

    // Evaluate trigger that exceeds threshold
    const decision = service.evaluate("trigger_e2e_001", {
      kind: "threshold",
      now: new Date().toISOString(),
      metric: {
        source: "system",
        name: "cpu_percent",
        value: 95,
        previousValue: 80,
      },
    });

    assert.equal(decision.allowed, true, "Trigger should fire for exceeding threshold");
    assert.ok(decision.actionMode === "auto_execute" || decision.actionMode === "suggest", "Should return valid action mode");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 2: User Preference Tracking
// ---------------------------------------------------------------------------

test("E2E Proactive: UserPreferenceTracker records and retrieves preferences", async () => {
  const harness = createE2EHarness("aa-e2e-proactive-prefs-");
  try {
    const tracker = new UserPreferenceTracker();

    tracker.recordAdopted("suggestion_001", "trigger_e2e_001", "operations", 1_000);
    tracker.recordDismissed("suggestion_002", "trigger_e2e_001", "operations", 2_000);

    const triggerStats = tracker.getTriggerStats("trigger_e2e_001");
    assert.ok(triggerStats, "Should aggregate trigger stats");
    assert.equal(triggerStats?.totalSuggestions, 2, "Should count all feedback");
    assert.equal(triggerStats?.adoptedCount, 1, "Should count adopted feedback");
    assert.equal(triggerStats?.dismissedCount, 1, "Should count dismissed feedback");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 3: Proactive Agent Service
// ---------------------------------------------------------------------------

test("E2E Proactive: ProactiveAgentService manages trigger lifecycle", async () => {
  const harness = createE2EHarness("aa-e2e-proactive-agent-");
  try {
    const service = new ProactiveAgentService();

    // Register trigger
    const trigger = createTrigger({ name: "Memory Alert" });
    await service.registerTrigger(trigger);

    // Verify trigger registered
    const triggers = service.listTriggers();
    assert.ok(triggers.some(t => t.triggerId === trigger.triggerId), "Should retrieve registered trigger");

    // Evaluate trigger
    const decision = service.evaluate("trigger_e2e_001", {
      kind: "threshold",
      now: new Date().toISOString(),
      metric: {
        source: "system",
        name: "cpu_percent",
        value: 95,
        previousValue: 80,
      },
    });

    assert.ok(decision, "Should return decision");
    assert.equal(decision.allowed, true, "Trigger should be allowed");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 4: Scheduled Triggers
// ---------------------------------------------------------------------------

test("E2E Proactive: Scheduled triggers are registered correctly", async () => {
  const harness = createE2EHarness("aa-e2e-proactive-schedule-");
  try {
    const service = new ProactiveAgentService();

    const scheduledTrigger = createTrigger({
      triggerId: "scheduled_trigger_001",
      type: "schedule",
      config: {
        cron: "*/1 * * * *",
        timezone: "UTC",
        skipIfPreviousRunning: true,
      },
    });

    await service.registerTrigger(scheduledTrigger);

    const triggers = service.listTriggers();
    assert.ok(triggers.some(t => t.triggerId === "scheduled_trigger_001"), "Scheduled trigger should be registered");
  } finally {
    harness.cleanup();
  }
});
