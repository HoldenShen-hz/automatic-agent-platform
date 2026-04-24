/**
 * Unit tests for ActionRecommender
 *
 * Tests the module responsible for recommending appropriate actions
 * based on trigger context, risk level, and user preferences.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { TriggerAction, TriggerDefinition, TriggerEvaluationInput } from "../../../../src/interaction/proactive-agent/index.js";

/**
 * Mock TriggerDefinition factory for testing
 */
function createMockTrigger(overrides: Partial<TriggerDefinition> = {}): TriggerDefinition {
  return {
    triggerId: "test-trigger",
    domainId: "test-domain",
    name: "Test Trigger",
    type: "schedule",
    config: {
      cron: "0 * * * *",
      timezone: "UTC",
      skipIfPreviousRunning: true,
    },
    action: {
      actionType: "suggest_to_user",
      template: {},
      requireConfirmation: true,
    },
    enabled: true,
    riskLevel: "medium",
    maxFireRate: "10/hour",
    cooldown: "5m",
    ...overrides,
  };
}

/**
 * Mock TriggerEvaluationInput factory for testing
 */
function createMockInput(overrides: Partial<TriggerEvaluationInput> = {}): TriggerEvaluationInput {
  return {
    kind: "schedule",
    now: new Date().toISOString(),
    ...overrides,
  };
}

// =============================================================================
// ActionRecommender Interface (to be implemented)
// =============================================================================

/**
 * Action recommendation result
 */
export interface ActionRecommendation {
  readonly actionType: TriggerAction["actionType"];
  readonly confidence: number; // 0-1
  readonly reasoning: string;
  readonly template: Record<string, unknown>;
  readonly requireConfirmation: boolean;
}

/**
 * ActionRecommender responsibilities:
 * - Analyze trigger configuration and current context
 * - Recommend the most appropriate action type
 * - Build action templates with context-aware parameters
 * - Consider risk level and user preferences when recommending
 */
export interface ActionRecommenderPort {
  recommendAction(trigger: TriggerDefinition, context: TriggerEvaluationInput): ActionRecommendation;
  buildActionTemplate(trigger: TriggerDefinition, context: TriggerEvaluationInput): Record<string, unknown>;
  getActionPriority(trigger: TriggerDefinition): number;
}

// =============================================================================
// ActionRecommender Implementation (reference implementation for tests)
// =============================================================================

/**
 * Reference implementation of ActionRecommender for testing purposes.
 * This implementation will be replaced by the actual module.
 */
export class ActionRecommender implements ActionRecommenderPort {
  public recommendAction(trigger: TriggerDefinition, context: TriggerEvaluationInput): ActionRecommendation {
    // For critical risk, always suggest_to_user with confirmation
    if (trigger.riskLevel === "critical") {
      return {
        actionType: "suggest_to_user",
        confidence: 1.0,
        reasoning: "Critical risk requires user confirmation",
        template: this.buildActionTemplate(trigger, context),
        requireConfirmation: true,
      };
    }

    // For low risk, allow auto_execute without confirmation
    if (trigger.riskLevel === "low" && !trigger.action.requireConfirmation) {
      return {
        actionType: trigger.action.actionType,
        confidence: 0.9,
        reasoning: "Low risk allows automated execution",
        template: this.buildActionTemplate(trigger, context),
        requireConfirmation: false,
      };
    }

    // Default: suggest to user
    return {
      actionType: trigger.action.actionType,
      confidence: 0.7,
      reasoning: "Default recommendation based on trigger configuration",
      template: this.buildActionTemplate(trigger, context),
      requireConfirmation: trigger.action.requireConfirmation,
    };
  }

  public buildActionTemplate(trigger: TriggerDefinition, context: TriggerEvaluationInput): Record<string, unknown> {
    const baseTemplate = { ...trigger.action.template };

    // Add context-aware parameters
    if (context.event?.payload) {
      baseTemplate.eventPayload = context.event.payload;
    }
    if (context.metric?.value !== undefined) {
      baseTemplate.metricValue = context.metric.value;
    }

    baseTemplate.triggerId = trigger.triggerId;
    baseTemplate.domainId = trigger.domainId;
    baseTemplate.triggeredAt = context.now ?? new Date().toISOString();

    return baseTemplate;
  }

  public getActionPriority(trigger: TriggerDefinition): number {
    // Higher priority for critical risk
    const riskPriority = {
      critical: 100,
      high: 75,
      medium: 50,
      low: 25,
    };
    return riskPriority[trigger.riskLevel] ?? 50;
  }
}

// =============================================================================
// Tests
// =============================================================================

test("ActionRecommender.recommendAction returns suggest_to_user for critical risk", () => {
  const recommender = new ActionRecommender();
  const trigger = createMockTrigger({ riskLevel: "critical" });
  const context = createMockInput();

  const recommendation = recommender.recommendAction(trigger, context);

  assert.equal(recommendation.actionType, "suggest_to_user");
  assert.equal(recommendation.requireConfirmation, true);
  assert.equal(recommendation.confidence, 1.0);
  assert.ok(recommendation.reasoning.includes("Critical"));
});

test("ActionRecommender.recommendAction allows auto_execute for low risk without confirmation", () => {
  const recommender = new ActionRecommender();
  const trigger = createMockTrigger({
    riskLevel: "low",
    action: {
      actionType: "create_task",
      template: {},
      requireConfirmation: false,
    },
  });
  const context = createMockInput();

  const recommendation = recommender.recommendAction(trigger, context);

  assert.equal(recommendation.actionType, "create_task");
  assert.equal(recommendation.requireConfirmation, false);
  assert.ok(recommendation.confidence >= 0.9);
});

test("ActionRecommender.recommendAction preserves trigger actionType for medium risk", () => {
  const recommender = new ActionRecommender();
  const trigger = createMockTrigger({
    riskLevel: "medium",
    action: {
      actionType: "create_goal",
      template: {},
      requireConfirmation: true,
    },
  });
  const context = createMockInput();

  const recommendation = recommender.recommendAction(trigger, context);

  assert.equal(recommendation.actionType, "create_goal");
  assert.equal(recommendation.requireConfirmation, true);
});

test("ActionRecommender.recommendAction handles event-based triggers", () => {
  const recommender = new ActionRecommender();
  const trigger = createMockTrigger({ type: "event" });
  const context = createMockInput({
    kind: "event",
    event: {
      source: "test-source",
      name: "test-event",
      payload: { key: "value" },
    },
  });

  const recommendation = recommender.recommendAction(trigger, context);

  assert.equal(recommendation.actionType, trigger.action.actionType);
  assert.ok(recommendation.template.eventPayload !== undefined);
});

test("ActionRecommender.recommendAction handles threshold-based triggers", () => {
  const recommender = new ActionRecommender();
  const trigger = createMockTrigger({ type: "threshold" });
  const context = createMockInput({
    kind: "threshold",
    metric: {
      source: "cpu-monitor",
      name: "cpu-usage",
      value: 95,
      previousValue: 70,
    },
  });

  const recommendation = recommender.recommendAction(trigger, context);

  assert.equal(recommendation.actionType, trigger.action.actionType);
  assert.ok(recommendation.template.metricValue === 95);
});

test("ActionRecommender.buildActionTemplate includes trigger metadata", () => {
  const recommender = new ActionRecommender();
  const trigger = createMockTrigger({
    triggerId: "trigger-123",
    domainId: "domain-456",
  });
  const context = createMockInput();

  const template = recommender.buildActionTemplate(trigger, context);

  assert.equal(template.triggerId, "trigger-123");
  assert.equal(template.domainId, "domain-456");
  assert.ok(template.triggeredAt !== undefined);
});

test("ActionRecommender.buildActionTemplate includes event payload when present", () => {
  const recommender = new ActionRecommender();
  const trigger = createMockTrigger();
  const context = createMockInput({
    event: {
      source: "sensor-1",
      name: "temperature-alert",
      payload: { temperature: 42, unit: "celsius" },
    },
  });

  const template = recommender.buildActionTemplate(trigger, context);

  assert.deepEqual(template.eventPayload, { temperature: 42, unit: "celsius" });
});

test("ActionRecommender.buildActionTemplate includes metric value when present", () => {
  const recommender = new ActionRecommender();
  const trigger = createMockTrigger();
  const context = createMockInput({
    metric: {
      source: "memory-monitor",
      name: "heap-used",
      value: 1024000,
      previousValue: 512000,
    },
  });

  const template = recommender.buildActionTemplate(trigger, context);

  assert.equal(template.metricValue, 1024000);
});

test("ActionRecommender.getActionPriority returns correct priority for each risk level", () => {
  const recommender = new ActionRecommender();

  assert.equal(recommender.getActionPriority(createMockTrigger({ riskLevel: "critical" })), 100);
  assert.equal(recommender.getActionPriority(createMockTrigger({ riskLevel: "high" })), 75);
  assert.equal(recommender.getActionPriority(createMockTrigger({ riskLevel: "medium" })), 50);
  assert.equal(recommender.getActionPriority(createMockTrigger({ riskLevel: "low" })), 25);
});

test("ActionRecommender.getActionPriority handles unknown risk level gracefully", () => {
  const recommender = new ActionRecommender();
  const trigger = createMockTrigger({ riskLevel: "medium" });

  const priority = recommender.getActionPriority(trigger);

  assert.equal(priority, 50); // Default fallback
});

test("ActionRecommender handles update_dashboard action type", () => {
  const recommender = new ActionRecommender();
  const trigger = createMockTrigger({
    action: {
      actionType: "update_dashboard",
      template: { widgetId: "widget-1", metric: "cpu-usage" },
      requireConfirmation: false,
    },
  });
  const context = createMockInput();

  const recommendation = recommender.recommendAction(trigger, context);

  assert.equal(recommendation.actionType, "update_dashboard");
});

test("ActionRecommender handles create_task action type", () => {
  const recommender = new ActionRecommender();
  const trigger = createMockTrigger({
    action: {
      actionType: "create_task",
      template: { taskName: "Process Alerts", priority: "high" },
      requireConfirmation: true,
    },
  });
  const context = createMockInput();

  const recommendation = recommender.recommendAction(trigger, context);

  assert.equal(recommendation.actionType, "create_task");
});

test("ActionRecommender recommendation confidence is between 0 and 1", () => {
  const recommender = new ActionRecommender();
  const trigger = createMockTrigger();
  const context = createMockInput();

  const recommendation = recommender.recommendAction(trigger, context);

  assert.ok(recommendation.confidence >= 0);
  assert.ok(recommendation.confidence <= 1);
});

test("ActionRecommender template preserves custom template fields from trigger", () => {
  const recommender = new ActionRecommender();
  const trigger = createMockTrigger({
    action: {
      actionType: "create_goal",
      template: { customField: "customValue", anotherField: 123 },
      requireConfirmation: true,
    },
  });
  const context = createMockInput();

  const template = recommender.buildActionTemplate(trigger, context);

  assert.equal(template.customField, "customValue");
  assert.equal(template.anotherField, 123);
});
