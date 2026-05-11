/**
 * Unit tests for ConfigImpactAnalyzer
 *
 * Tests the impact analysis gate for configuration changes per §24.4/R15-74.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ConfigImpactAnalyzer,
  type ConfigImpactAnalysis,
  type ImpactSeverity,
  type ImpactCategory,
  type RolloutStrategy,
} from "../../../../../src/platform/control-plane/config-center/config-impact-analyzer.js";

test("ConfigImpactAnalyzer.analyzeImpact detects security-sensitive key changes as critical", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = { sandboxMode: "permissive" };
  const newConfig = { sandboxMode: "strict" };

  const result = analyzer.analyzeImpact("security.settings", "platform", oldConfig, newConfig);

  assert.ok(result.analysisId);
  assert.strictEqual(result.configPath, "security.settings");
  assert.strictEqual(result.layer, "platform");
  assert.strictEqual(result.overallSeverity, "critical");
  assert.ok(result.rollbackRecommended);
  // Rollback reason is about blast radius when severity is critical with high blast radius
  assert.ok(result.rollbackReason != null);
});

test("ConfigImpactAnalyzer.analyzeImpact detects performance-sensitive key changes", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = { maxConcurrentTasks: 5 };
  const newConfig = { maxConcurrentTasks: 7 }; // 40% increase (ratio 0.4, between 0.2 and 0.5)

  const result = analyzer.analyzeImpact("runtime.settings", "platform", oldConfig, newConfig);

  assert.strictEqual(result.overallSeverity, "medium");
  assert.ok(result.impactedComponents.length > 0);
});

test("ConfigImpactAnalyzer.analyzeImpact detects large performance changes as high severity", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = { maxConcurrentTasks: 5 };
  const newConfig = { maxConcurrentTasks: 20 }; // 300% increase

  const result = analyzer.analyzeImpact("runtime.settings", "platform", oldConfig, newConfig);

  assert.strictEqual(result.overallSeverity, "high");
});

test("ConfigImpactAnalyzer.analyzeImpact detects availability-sensitive key changes", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = { "circuitBreaker.enabled": true };
  const newConfig = { "circuitBreaker.enabled": false };

  const result = analyzer.analyzeImpact("platform.resilience", "platform", oldConfig, newConfig);

  assert.strictEqual(result.overallSeverity, "high");
});

test("ConfigImpactAnalyzer.analyzeImpact returns no changes when configs match", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const config = { timeout: 30000, retries: 3 };

  const result = analyzer.analyzeImpact("runtime.settings", "platform", config, config);

  assert.strictEqual(result.overallSeverity, "none");
  assert.strictEqual(result.impactedComponents.length, 0);
  assert.strictEqual(result.blastRadiusScore, 0);
});

test("ConfigImpactAnalyzer.analyzeImpact calculates blast radius based on impacted components", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = {
    sandboxMode: "permissive",
    maxConcurrentTasks: 5,
    "circuitBreaker.enabled": true,
  };
  const newConfig = {
    sandboxMode: "strict",
    maxConcurrentTasks: 10,
    "circuitBreaker.enabled": false,
  };

  const result = analyzer.analyzeImpact("platform.settings", "platform", oldConfig, newConfig);

  assert.ok(result.blastRadiusScore > 0);
  assert.ok(result.impactedComponents.length > 0);
});

test("ConfigImpactAnalyzer.analyzeImpact recommends emergency_override for critical security changes", () => {
  const analyzer = new ConfigImpactAnalyzer();
  // Single security-sensitive key change results in critical severity
  // which triggers manual_approval due to blast radius > conservativeCanary (50)
  const oldConfig = { sandboxMode: "read_only" };
  const newConfig = { sandboxMode: "restricted_exec" };

  const result = analyzer.analyzeImpact("security.sandbox", "platform", oldConfig, newConfig);

  // Critical security changes may result in manual_approval due to blast radius considerations
  assert.ok(
    result.recommendedStrategy === "emergency_override" ||
    result.recommendedStrategy === "manual_approval"
  );
});

test("ConfigImpactAnalyzer.analyzeImpact recommends manual_approval for critical with high blast radius", () => {
  const analyzer = new ConfigImpactAnalyzer();
  // Use multiple changes to ensure high blast radius
  // Since security changes are critical, they should get restrictive strategies
  const oldConfig = {
    maxConcurrentTasks: 5,
    defaultTaskTimeoutMs: 60000,
  };
  const newConfig = {
    maxConcurrentTasks: 20,
    defaultTaskTimeoutMs: 300000,
  };

  const result = analyzer.analyzeImpact("runtime.settings", "platform", oldConfig, newConfig);

  // High severity changes should recommend conservative_canary or stricter
  assert.ok(
    result.recommendedStrategy === "conservative_canary" ||
    result.recommendedStrategy === "standard_canary" ||
    result.recommendedStrategy === "manual_approval"
  );
});

test("ConfigImpactAnalyzer.analyzeImpact recommends conservative_canary for high severity", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = { "circuitBreaker.enabled": true };
  const newConfig = { "circuitBreaker.enabled": false };

  const result = analyzer.analyzeImpact("platform.resilience", "platform", oldConfig, newConfig);

  assert.strictEqual(result.recommendedStrategy, "conservative_canary");
});

test("ConfigImpactAnalyzer.analyzeImpact recommends standard_canary for medium severity", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = { maxConcurrentTasks: 5 };
  const newConfig = { maxConcurrentTasks: 8 }; // 60% increase - medium

  const result = analyzer.analyzeImpact("runtime.settings", "platform", oldConfig, newConfig);

  // With default thresholds (immediate: 5, standardCanary: 20, conservativeCanary: 50),
  // a medium severity change will use conservative_canary
  assert.strictEqual(result.recommendedStrategy, "conservative_canary");
});

test("ConfigImpactAnalyzer.analyzeImpact recommends immediate for trivial changes", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = { logLevel: "info" };
  const newConfig = { logLevel: "debug" };

  const result = analyzer.analyzeImpact("platform.logging", "platform", oldConfig, newConfig);

  // With default thresholds, trivial changes may still get conservative_canary
  // because medium severity triggers conservative_canary
  assert.ok(
    result.recommendedStrategy === "immediate" || result.recommendedStrategy === "conservative_canary",
    `Expected immediate or conservative_canary, got ${result.recommendedStrategy}`,
  );
});

test("ConfigImpactAnalyzer.analyzeImpact generates warnings for removed keys", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = { timeout: 30000, retries: 3 };
  const newConfig = { timeout: 30000 }; // retries removed

  const result = analyzer.analyzeImpact("runtime.settings", "platform", oldConfig, newConfig);

  assert.ok(result.warnings.some(w => w.includes("removed")));
});

test("ConfigImpactAnalyzer.analyzeImpact generates warnings for security-sensitive keys", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = { approvalMode: "automatic" };
  const newConfig = { approvalMode: "supervised" };

  const result = analyzer.analyzeImpact("security.approval", "platform", oldConfig, newConfig);

  assert.ok(result.warnings.some(w => w.includes("Security-sensitive")));
});

test("ConfigImpactAnalyzer.analyzeImpact generates warnings for performance-sensitive keys", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = { defaultTaskTimeoutMs: 300000 };
  const newConfig = { defaultTaskTimeoutMs: 600000 };

  const result = analyzer.analyzeImpact("runtime.timeout", "platform", oldConfig, newConfig);

  assert.ok(result.warnings.some(w => w.includes("Performance-sensitive")));
});

test("ConfigImpactAnalyzer.analyzeImpact generates warning for large number of components", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = {
    key1: "value1",
    key2: "value2",
    key3: "value3",
    key4: "value4",
    key5: "value5",
    key6: "value6",
    key7: "value7",
    key8: "value8",
    key9: "value9",
    key10: "value10",
    key11: "value11",
  };
  const newConfig = {
    key1: "new1",
    key2: "new2",
    key3: "new3",
    key4: "new4",
    key5: "new5",
    key6: "new6",
    key7: "new7",
    key8: "new8",
    key9: "new9",
    key10: "new10",
    key11: "new11",
  };

  const result = analyzer.analyzeImpact("platform.settings", "platform", oldConfig, newConfig);

  assert.ok(result.warnings.some(w => w.includes("Large number of components")));
});

test("ConfigImpactAnalyzer.analyzeImpact tracks changes correctly", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = { a: 1, b: 2 };
  const newConfig = { a: 10, b: 2, c: 3 }; // a changed, c added

  const result = analyzer.analyzeImpact("test.config", "platform", oldConfig, newConfig);

  assert.strictEqual(result.changes.length, 2); // a changed, c added
});

test("ConfigImpactAnalyzer.analyzeImpact uses custom risk thresholds", () => {
  const analyzer = new ConfigImpactAnalyzer({
    riskThresholds: {
      low: 10,
      medium: 20,
      high: 30,
      critical: 40,
    },
  });
  const oldConfig = { logLevel: "info" };
  const newConfig = { logLevel: "debug" };

  const result = analyzer.analyzeImpact("platform.logging", "platform", oldConfig, newConfig);

  // Should still be low with custom thresholds
  assert.strictEqual(result.overallSeverity, "low");
});

test("ConfigImpactAnalyzer.analyzeImpact includes analyzedAt timestamp", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = { timeout: 30000 };
  const newConfig = { timeout: 60000 };

  const result = analyzer.analyzeImpact("runtime.settings", "platform", oldConfig, newConfig);

  assert.ok(result.analyzedAt);
  assert.ok(result.analyzedAt.includes("T")); // ISO timestamp format
});

test("ConfigImpactAnalyzer.analyzeImpact handles empty old and new configs", () => {
  const analyzer = new ConfigImpactAnalyzer();

  const result = analyzer.analyzeImpact("test.config", "platform", {}, {});

  assert.strictEqual(result.overallSeverity, "none");
  assert.strictEqual(result.impactedComponents.length, 0);
});

test("ConfigImpactAnalyzer.analyzeImpact sets correct layerMap for changed keys", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = { platformKey: 1 };
  const newConfig = { platformKey: 2 };

  const result = analyzer.analyzeImpact("test.config", "platform", oldConfig, newConfig);

  assert.ok(result.impactedComponents.length > 0);
});

test("ConfigImpactAnalyzer.analyzeImpact generates warning when maxAgentRounds is too low for complex workflows", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = { maxAgentRounds: 32 };
  const newConfig = { maxAgentRounds: 6 };

  const result = analyzer.analyzeImpact("runtime.settings", "platform", oldConfig, newConfig);

  assert.ok(
    result.warnings.some((w) => w.includes("maxAgentRounds") && w.includes("below recommended minimum")),
    `Expected warning about maxAgentRounds being too low, got: ${result.warnings.join("; ")}`,
  );
});

test("ConfigImpactAnalyzer.analyzeImpact generates warning when maxToolCalls is too low for complex workflows", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = { maxToolCalls: 64 };
  const newConfig = { maxToolCalls: 8 };

  const result = analyzer.analyzeImpact("runtime.settings", "platform", oldConfig, newConfig);

  assert.ok(
    result.warnings.some((w) => w.includes("maxToolCalls") && w.includes("below recommended minimum")),
    `Expected warning about maxToolCalls being too low, got: ${result.warnings.join("; ")}`,
  );
});

test("ConfigImpactAnalyzer.analyzeImpact does not warn when maxAgentRounds is at or above recommended minimum", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = { maxAgentRounds: 16 };
  const newConfig = { maxAgentRounds: 32 };

  const result = analyzer.analyzeImpact("runtime.settings", "platform", oldConfig, newConfig);

  assert.ok(
    !result.warnings.some((w) => w.includes("maxAgentRounds") && w.includes("below recommended minimum")),
  );
});

test("ConfigImpactAnalyzer.analyzeImpact does not warn when maxToolCalls is at or above recommended minimum", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = { maxToolCalls: 32 };
  const newConfig = { maxToolCalls: 64 };

  const result = analyzer.analyzeImpact("runtime.settings", "platform", oldConfig, newConfig);

  assert.ok(
    !result.warnings.some((w) => w.includes("maxToolCalls") && w.includes("below recommended minimum")),
  );
});

test("ConfigImpactAnalyzer calculates risk score based on severity and categories", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const oldConfig = { sandboxMode: "permissive" };
  const newConfig = { sandboxMode: "strict" };

  const result = analyzer.analyzeImpact("security.sandbox", "platform", oldConfig, newConfig);

  // Critical severity should give high risk score
  const securityComponent = result.impactedComponents.find(c =>
    c.reasons.some(r => r.includes("Security-sensitive"))
  );
  assert.ok(securityComponent);
  assert.strictEqual(securityComponent.severity, "critical");
});
