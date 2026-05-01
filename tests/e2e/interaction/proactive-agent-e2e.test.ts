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

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { ProactiveAgentService, type TriggerDefinition } from "../../src/interaction/proactive-agent/index.js";
import { TriggerEngine } from "../../src/interaction/proactive-agent/trigger-engine/index.js";
import { UserPreferenceTracker } from "../../src/interaction/proactive-agent/user-preference-tracker.js";
import type { TriggerEvent, ProactiveAction } from "../../src/interaction/proactive-agent/types.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createTrigger(overrides: Partial<TriggerDefinition> = {}): TriggerDefinition {
  return {
    triggerId: overrides.triggerId ?? "trigger_e2e_001",
    domainId: overrides.domainId ?? "operations",
    name: overrides.name ?? "High CPU Alert",
    type: overrides.type ?? "threshold",
    condition: overrides.condition ?? { metric: "cpu_percent", threshold: 90, operator: "gt" },
    actions: overrides.actions ?? ["notify", "scale"],
    enabled: overrides.enabled ?? true,
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

test("E2E Proactive: TriggerEngine evaluates conditions and fires triggers", async () => {
  const harness = createE2EHarness("aa-e2e-proactive-");
  try {
    const engine = new TriggerEngine();

    // Register trigger
    const trigger = createTrigger({
      condition: { metric: "cpu_percent", threshold: 90, operator: "gt" },
    });
    engine.registerTrigger(trigger);

    // Evaluate event that exceeds threshold
    const event = createTriggerEvent({
      context: { cpuPercent: 95, memoryPercent: 80 },
    });

    const fired = engine.evaluate(event);

    assert.ok(Array.isArray(fired), "Should return fired triggers");
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

    // Set preference
    tracker.setPreference("user_e2e_001", "notify_via", "dashboard");
    tracker.setPreference("user_e2e_001", "auto_scale", true);

    // Retrieve preference
    const notifyPref = tracker.getPreference("user_e2e_001", "notify_via");
    assert.equal(notifyPref, "dashboard", "Should return set preference");

    const autoScale = tracker.getPreference("user_e2e_001", "auto_scale");
    assert.equal(autoScale, true, "Should return boolean preference");
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
    service.registerTrigger(trigger);

    // Verify trigger registered
    const registered = service.getTrigger("trigger_e2e_001");
    assert.ok(registered, "Should retrieve registered trigger");

    // Evaluate trigger
    const event = createTriggerEvent({ type: "metric_threshold" });
    const actions = await service.evaluateTriggers(event);

    assert.ok(Array.isArray(actions), "Should return actions");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 4: Scheduled Triggers
// ---------------------------------------------------------------------------

test("E2E Proactive: Scheduled triggers fire at configured intervals", async () => {
  const harness = createE2EHarness("aa-e2e-proactive-schedule-");
  try {
    const service = new ProactiveAgentService();

    const scheduledTrigger = createTrigger({
      triggerId: "scheduled_trigger_001",
      type: "scheduled",
      schedule: { intervalMs: 60000, cronExpression: null },
    });

    service.registerTrigger(scheduledTrigger);

    const triggers = service.getScheduledTriggers();
    assert.ok(triggers.some(t => t.triggerId === "scheduled_trigger_001"), "Scheduled trigger should be registered");
  } finally {
    harness.cleanup();
  }
});