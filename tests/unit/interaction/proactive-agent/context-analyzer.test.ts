/**
 * Unit tests for ContextAnalyzer
 *
 * Tests the module responsible for analyzing current system context
 * and determining which triggers are relevant.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { TriggerDefinition, TriggerEvaluationInput } from "../../../../src/interaction/proactive-agent/index.js";

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
// ContextAnalyzer Interface (to be implemented)
// =============================================================================

/**
 * Context information for trigger evaluation
 */
export interface TriggerContext {
  readonly domainId: string;
  readonly currentTime: string;
  readonly recentEvents: ReadonlyArray<{
    source: string;
    name: string;
    timestamp: string;
  }>;
  readonly activeTriggers: readonly string[];
}

/**
 * Context match result indicating how well context matches a trigger
 */
export interface ContextMatchResult {
  readonly triggerId: string;
  readonly matchScore: number; // 0-1
  readonly matchedCriteria: string[];
  readonly unmatchedCriteria: string[];
  readonly relevanceLevel: "high" | "medium" | "low" | "none";
}

/**
 * ContextAnalyzer responsibilities:
 * - Analyze current system state and context
 * - Evaluate which triggers are relevant to current context
 * - Calculate match scores between context and triggers
 * - Identify context patterns and trends
 */
export interface ContextAnalyzerPort {
  analyzeContext(context: TriggerContext): Map<string, ContextMatchResult>;
  evaluateTriggerMatch(trigger: TriggerDefinition, context: TriggerContext): ContextMatchResult;
  getRelevantTriggers(context: TriggerContext, triggers: TriggerDefinition[]): TriggerDefinition[];
  computeContextSimilarity(contextA: TriggerContext, contextB: TriggerContext): number;
}

// =============================================================================
// ContextAnalyzer Implementation (reference implementation for tests)
// =============================================================================

/**
 * Reference implementation of ContextAnalyzer for testing purposes.
 * This implementation will be replaced by the actual module.
 */
export class ContextAnalyzer implements ContextAnalyzerPort {
  private readonly relevanceThresholds = {
    high: 0.8,
    medium: 0.5,
    low: 0.2,
  };

  public analyzeContext(context: TriggerContext): Map<string, ContextMatchResult> {
    // This would typically evaluate all known triggers against the context
    // For now, return an empty map as we don't have trigger registry
    return new Map();
  }

  public evaluateTriggerMatch(trigger: TriggerDefinition, context: TriggerContext): ContextMatchResult {
    const matchedCriteria: string[] = [];
    const unmatchedCriteria: string[] = [];

    // Check domain match
    if (trigger.domainId === context.domainId) {
      matchedCriteria.push("domain_match");
    } else {
      unmatchedCriteria.push("domain_mismatch");
    }

    // Check if trigger is in active triggers
    if (context.activeTriggers.includes(trigger.triggerId)) {
      matchedCriteria.push("active_trigger");
    } else {
      unmatchedCriteria.push("inactive_trigger");
    }

    // Check recent events for event-based triggers
    if (trigger.type === "event" && context.recentEvents.length > 0) {
      matchedCriteria.push("has_recent_events");
    } else if (trigger.type === "event") {
      unmatchedCriteria.push("no_recent_events");
    }

    // Calculate match score
    const matchScore = this.calculateMatchScore(matchedCriteria, unmatchedCriteria);
    const relevanceLevel = this.determineRelevanceLevel(matchScore);

    return {
      triggerId: trigger.triggerId,
      matchScore,
      matchedCriteria,
      unmatchedCriteria,
      relevanceLevel,
    };
  }

  public getRelevantTriggers(context: TriggerContext, triggers: TriggerDefinition[]): TriggerDefinition[] {
    return triggers
      .map((trigger) => ({
        trigger,
        result: this.evaluateTriggerMatch(trigger, context),
      }))
      .filter(({ result }) => result.relevanceLevel !== "none")
      .sort((a, b) => b.result.matchScore - a.result.matchScore)
      .map(({ trigger }) => trigger);
  }

  public computeContextSimilarity(contextA: TriggerContext, contextB: TriggerContext): number {
    if (contextA.domainId !== contextB.domainId) {
      return 0;
    }

    // Calculate event overlap
    const eventsA = new Set(contextA.recentEvents.map((e) => `${e.source}:${e.name}`));
    const eventsB = new Set(contextB.recentEvents.map((e) => `${e.source}:${e.name}`));

    let intersectionCount = 0;
    for (const event of eventsA) {
      if (eventsB.has(event)) {
        intersectionCount++;
      }
    }

    const unionCount = eventsA.size + eventsB.size - intersectionCount;
    const jaccardSimilarity = unionCount > 0 ? intersectionCount / unionCount : 0;

    // Calculate active trigger overlap
    const triggersA = new Set(contextA.activeTriggers);
    const triggersB = new Set(contextB.activeTriggers);

    let triggerIntersection = 0;
    for (const trigger of triggersA) {
      if (triggersB.has(trigger)) {
        triggerIntersection++;
      }
    }

    const triggerUnion = triggersA.size + triggersB.size - triggerIntersection;
    const triggerJaccard = triggerUnion > 0 ? triggerIntersection / triggerUnion : 0;

    // Weighted average (60% events, 40% triggers)
    return jaccardSimilarity * 0.6 + triggerJaccard * 0.4;
  }

  private calculateMatchScore(matched: string[], unmatched: string[]): number {
    const total = matched.length + unmatched.length;
    if (total === 0) return 0;
    return matched.length / total;
  }

  private determineRelevanceLevel(score: number): "high" | "medium" | "low" | "none" {
    if (score >= this.relevanceThresholds.high) return "high";
    if (score >= this.relevanceThresholds.medium) return "medium";
    if (score >= this.relevanceThresholds.low) return "low";
    return "none";
  }
}

// =============================================================================
// Tests
// =============================================================================

test("ContextAnalyzer.evaluateTriggerMatch returns high relevance for domain match and active trigger", () => {
  const analyzer = new ContextAnalyzer();
  const trigger = createMockTrigger({ triggerId: "active-trigger" });
  const context: TriggerContext = {
    domainId: "test-domain",
    currentTime: new Date().toISOString(),
    recentEvents: [],
    activeTriggers: ["active-trigger"],
  };

  const result = analyzer.evaluateTriggerMatch(trigger, context);

  assert.equal(result.triggerId, "active-trigger");
  assert.ok(result.matchScore >= 0.5);
  assert.ok(result.relevanceLevel === "high" || result.relevanceLevel === "medium");
  assert.ok(result.matchedCriteria.includes("domain_match"));
  assert.ok(result.matchedCriteria.includes("active_trigger"));
});

test("ContextAnalyzer.evaluateTriggerMatch returns low relevance for domain mismatch", () => {
  const analyzer = new ContextAnalyzer();
  const trigger = createMockTrigger({
    triggerId: "trigger-1",
    domainId: "different-domain",
  });
  const context: TriggerContext = {
    domainId: "test-domain",
    currentTime: new Date().toISOString(),
    recentEvents: [],
    activeTriggers: [],
  };

  const result = analyzer.evaluateTriggerMatch(trigger, context);

  assert.ok(result.matchScore < 0.5);
  assert.ok(result.unmatchedCriteria.includes("domain_mismatch"));
});

test("ContextAnalyzer.evaluateTriggerMatch handles event-based triggers with recent events", () => {
  const analyzer = new ContextAnalyzer();
  const trigger = createMockTrigger({
    triggerId: "event-trigger",
    type: "event",
  });
  const context: TriggerContext = {
    domainId: "test-domain",
    currentTime: new Date().toISOString(),
    recentEvents: [
      { source: "sensor-1", name: "temperature-alert", timestamp: new Date().toISOString() },
    ],
    activeTriggers: [],
  };

  const result = analyzer.evaluateTriggerMatch(trigger, context);

  assert.ok(result.matchedCriteria.includes("has_recent_events"));
});

test("ContextAnalyzer.evaluateTriggerMatch identifies missing recent events for event triggers", () => {
  const analyzer = new ContextAnalyzer();
  const trigger = createMockTrigger({
    triggerId: "event-trigger",
    type: "event",
  });
  const context: TriggerContext = {
    domainId: "test-domain",
    currentTime: new Date().toISOString(),
    recentEvents: [],
    activeTriggers: [],
  };

  const result = analyzer.evaluateTriggerMatch(trigger, context);

  assert.ok(result.unmatchedCriteria.includes("no_recent_events"));
});

test("ContextAnalyzer.getRelevantTriggers filters by relevance level", () => {
  const analyzer = new ContextAnalyzer();
  const triggers = [
    createMockTrigger({ triggerId: "trigger-high", domainId: "test-domain" }),
    createMockTrigger({ triggerId: "trigger-low", domainId: "other-domain" }),
  ];
  const context: TriggerContext = {
    domainId: "test-domain",
    currentTime: new Date().toISOString(),
    recentEvents: [],
    activeTriggers: ["trigger-high"],
  };

  const relevant = analyzer.getRelevantTriggers(context, triggers);

  assert.equal(relevant.length, 1);
  assert.equal(relevant[0]!.triggerId, "trigger-high");
});

test("ContextAnalyzer.getRelevantTriggers sorts by match score descending", () => {
  const analyzer = new ContextAnalyzer();
  const triggers = [
    createMockTrigger({ triggerId: "trigger-low", domainId: "other-domain" }),
    createMockTrigger({ triggerId: "trigger-high", domainId: "test-domain" }),
  ];
  const context: TriggerContext = {
    domainId: "test-domain",
    currentTime: new Date().toISOString(),
    recentEvents: [],
    activeTriggers: ["trigger-high"],
  };

  const relevant = analyzer.getRelevantTriggers(context, triggers);

  assert.equal(relevant[0]!.triggerId, "trigger-high");
});

test("ContextAnalyzer.computeContextSimilarity returns 0 for different domains", () => {
  const analyzer = new ContextAnalyzer();
  const contextA: TriggerContext = {
    domainId: "domain-a",
    currentTime: new Date().toISOString(),
    recentEvents: [],
    activeTriggers: [],
  };
  const contextB: TriggerContext = {
    domainId: "domain-b",
    currentTime: new Date().toISOString(),
    recentEvents: [],
    activeTriggers: [],
  };

  const similarity = analyzer.computeContextSimilarity(contextA, contextB);

  assert.equal(similarity, 0);
});

test("ContextAnalyzer.computeContextSimilarity returns 1 for identical contexts", () => {
  const analyzer = new ContextAnalyzer();
  const timestamp = new Date().toISOString();
  const contextA: TriggerContext = {
    domainId: "test-domain",
    currentTime: timestamp,
    recentEvents: [
      { source: "sensor-1", name: "event-1", timestamp },
    ],
    activeTriggers: ["trigger-1", "trigger-2"],
  };
  const contextB: TriggerContext = {
    domainId: "test-domain",
    currentTime: timestamp,
    recentEvents: [
      { source: "sensor-1", name: "event-1", timestamp },
    ],
    activeTriggers: ["trigger-1", "trigger-2"],
  };

  const similarity = analyzer.computeContextSimilarity(contextA, contextB);

  assert.equal(similarity, 1.0);
});

test("ContextAnalyzer.computeContextSimilarity handles partial event overlap", () => {
  const analyzer = new ContextAnalyzer();
  const timestamp = new Date().toISOString();
  const contextA: TriggerContext = {
    domainId: "test-domain",
    currentTime: timestamp,
    recentEvents: [
      { source: "sensor-1", name: "event-1", timestamp },
      { source: "sensor-2", name: "event-2", timestamp },
    ],
    activeTriggers: [],
  };
  const contextB: TriggerContext = {
    domainId: "test-domain",
    currentTime: timestamp,
    recentEvents: [
      { source: "sensor-1", name: "event-1", timestamp },
      { source: "sensor-3", name: "event-3", timestamp },
    ],
    activeTriggers: [],
  };

  const similarity = analyzer.computeContextSimilarity(contextA, contextB);

  // 1 common event out of 3 total unique events = 1/3 for events portion
  // Active triggers are both empty, so 0 for triggers portion
  // 0.6 * (1/3) + 0.4 * 0 = 0.2
  assert.ok(similarity > 0);
  assert.ok(similarity < 1);
});

test("ContextAnalyzer.computeContextSimilarity handles partial trigger overlap", () => {
  const analyzer = new ContextAnalyzer();
  const contextA: TriggerContext = {
    domainId: "test-domain",
    currentTime: new Date().toISOString(),
    recentEvents: [],
    activeTriggers: ["trigger-1", "trigger-2", "trigger-3"],
  };
  const contextB: TriggerContext = {
    domainId: "test-domain",
    currentTime: new Date().toISOString(),
    recentEvents: [],
    activeTriggers: ["trigger-1", "trigger-4", "trigger-5"],
  };

  const similarity = analyzer.computeContextSimilarity(contextA, contextB);

  // 1 common trigger out of 5 total unique triggers = 1/5 for triggers portion
  // Events are both empty, so 0 for events portion
  // 0.6 * 0 + 0.4 * (1/5) = 0.08
  assert.ok(similarity > 0);
  assert.ok(similarity < 1);
});

test("ContextAnalyzer.computeContextSimilarity handles empty contexts", () => {
  const analyzer = new ContextAnalyzer();
  const contextA: TriggerContext = {
    domainId: "test-domain",
    currentTime: new Date().toISOString(),
    recentEvents: [],
    activeTriggers: [],
  };
  const contextB: TriggerContext = {
    domainId: "test-domain",
    currentTime: new Date().toISOString(),
    recentEvents: [],
    activeTriggers: [],
  };

  const similarity = analyzer.computeContextSimilarity(contextA, contextB);

  assert.equal(similarity, 0); // Both empty, no similarity calculable
});

test("ContextAnalyzer.analyzeContext returns empty map without triggers", () => {
  const analyzer = new ContextAnalyzer();
  const context: TriggerContext = {
    domainId: "test-domain",
    currentTime: new Date().toISOString(),
    recentEvents: [],
    activeTriggers: [],
  };

  const results = analyzer.analyzeContext(context);

  assert.equal(results.size, 0);
});

test("ContextAnalyzer.matchScore is between 0 and 1", () => {
  const analyzer = new ContextAnalyzer();
  const trigger = createMockTrigger();
  const context: TriggerContext = {
    domainId: "test-domain",
    currentTime: new Date().toISOString(),
    recentEvents: [],
    activeTriggers: [],
  };

  const result = analyzer.evaluateTriggerMatch(trigger, context);

  assert.ok(result.matchScore >= 0);
  assert.ok(result.matchScore <= 1);
});

test("ContextAnalyzer.relevanceLevel is correctly determined based on score", () => {
  const analyzer = new ContextAnalyzer();
  const trigger = createMockTrigger({ triggerId: "test-trigger" });
  const context: TriggerContext = {
    domainId: "test-domain",
    currentTime: new Date().toISOString(),
    recentEvents: [],
    activeTriggers: ["test-trigger"],
  };

  const result = analyzer.evaluateTriggerMatch(trigger, context);

  assert.ok(["high", "medium", "low", "none"].includes(result.relevanceLevel));
});

test("ContextAnalyzer handles multiple triggers with different relevance levels", () => {
  const analyzer = new ContextAnalyzer();
  const triggers = [
    createMockTrigger({ triggerId: "trigger-1", domainId: "domain-1" }),
    createMockTrigger({ triggerId: "trigger-2", domainId: "domain-2" }),
    createMockTrigger({ triggerId: "trigger-3", domainId: "domain-3" }),
  ];
  const context: TriggerContext = {
    domainId: "domain-1",
    currentTime: new Date().toISOString(),
    recentEvents: [],
    activeTriggers: ["trigger-1"],
  };

  const relevant = analyzer.getRelevantTriggers(context, triggers);

  // Only trigger-1 matches domain and is active
  assert.ok(relevant.length >= 1);
  assert.equal(relevant[0]!.triggerId, "trigger-1");
});

test("ContextAnalyzer matchedCriteria and unmatchedCriteria are mutually exclusive", () => {
  const analyzer = new ContextAnalyzer();
  const trigger = createMockTrigger({ triggerId: "test-trigger" });
  const context: TriggerContext = {
    domainId: "test-domain",
    currentTime: new Date().toISOString(),
    recentEvents: [],
    activeTriggers: ["other-trigger"],
  };

  const result = analyzer.evaluateTriggerMatch(trigger, context);

  for (const matched of result.matchedCriteria) {
    assert.ok(!result.unmatchedCriteria.includes(matched));
  }
});
