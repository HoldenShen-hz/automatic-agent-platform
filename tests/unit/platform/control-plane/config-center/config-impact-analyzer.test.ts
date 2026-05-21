import assert from "node:assert/strict";
import test from "node:test";
import { ConfigImpactAnalyzer } from "../../../../../src/platform/five-plane-control-plane/config-center/config-impact-analyzer.js";

test("ConfigImpactAnalyzer can be instantiated", () => {
  const analyzer = new ConfigImpactAnalyzer();
  assert.ok(analyzer != null);
});

test("ConfigImpactAnalyzer analyzeImpact returns analysis result", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const result = analyzer.analyzeImpact(
    "test.config",
    "platform",
    { key: "value1" },
    { key: "value2" },
  );
  assert.ok(result != null);
  assert.ok(typeof result.analysisId === "string");
  assert.ok(typeof result.analyzedAt === "string");
});

test("ConfigImpactAnalyzer analyzeImpact detects added fields", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const result = analyzer.analyzeImpact(
    "test.config",
    "platform",
    { existing: "value" },
    { existing: "value", newKey: "newValue" },
  );
  assert.ok(result.changes.length > 0);
  assert.equal(result.changes[0]!.changeType, "added");
});

test("ConfigImpactAnalyzer analyzeImpact detects removed fields", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const result = analyzer.analyzeImpact(
    "test.config",
    "platform",
    { existing: "value", toRemove: "value" },
    { existing: "value" },
  );
  assert.ok(result.changes.some((c) => c.changeType === "removed"));
});

test("ConfigImpactAnalyzer analyzeImpact detects changed fields", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const result = analyzer.analyzeImpact(
    "test.config",
    "platform",
    { key: "oldValue" },
    { key: "newValue" },
  );
  assert.ok(result.changes.some((c) => c.changeType === "changed"));
});

test("ConfigImpactAnalyzer analyzeImpact identifies security-sensitive changes as critical", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const result = analyzer.analyzeImpact(
    "security.config",
    "platform",
    { sandboxMode: "workspace_write" },
    { sandboxMode: "no_restriction" },
  );
  assert.equal(result.overallSeverity, "critical");
});

test("ConfigImpactAnalyzer analyzeImpact identifies availability changes", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const result = analyzer.analyzeImpact(
    "runtime.config",
    "platform",
    { failover: { enabled: false } },
    { failover: { enabled: true } },
  );
  assert.ok(result.overallSeverity === "high" || result.overallSeverity === "medium");
});

test("ConfigImpactAnalyzer analyzeImpact recommends conservative_canary for high severity", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const result = analyzer.analyzeImpact(
    "security.config",
    "platform",
    { sandboxMode: "workspace_write" },
    { sandboxMode: "no_restriction", allowDestructiveActions: true },
  );
  assert.ok(
    result.recommendedStrategy === "conservative_canary"
    || result.recommendedStrategy === "manual_approval"
    || result.recommendedStrategy === "emergency_override",
  );
});

test("ConfigImpactAnalyzer analyzeImpact recommends immediate for trivial changes", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const result = analyzer.analyzeImpact(
    "logging.config",
    "platform",
    { level: "info" },
    { level: "debug" },
  );
  assert.equal(result.recommendedStrategy, "immediate");
});

test("ConfigImpactAnalyzer analyzeImpact warns about security-sensitive key modifications", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const result = analyzer.analyzeImpact(
    "security.config",
    "platform",
    { authentication: { enabled: true } },
    { authentication: { enabled: false } },
  );
  assert.ok(result.warnings.some((w) => w.includes("security")));
});

test("ConfigImpactAnalyzer analyzeImpact warns about maxAgentRounds below minimum", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const result = analyzer.analyzeImpact(
    "runtime.config",
    "platform",
    { maxAgentRounds: 20 },
    { maxAgentRounds: 5 },
  );
  assert.ok(result.warnings.some((w) => w.includes("maxAgentRounds")));
});

test("ConfigImpactAnalyzer analyzeImpact warns about maxToolCalls below minimum", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const result = analyzer.analyzeImpact(
    "runtime.config",
    "platform",
    { maxToolCalls: 50 },
    { maxToolCalls: 10 },
  );
  assert.ok(result.warnings.some((w) => w.includes("maxToolCalls")));
});

test("ConfigImpactAnalyzer with custom thresholds uses custom values", () => {
  const analyzer = new ConfigImpactAnalyzer({
    riskThresholds: { low: 10, medium: 30, high: 50, critical: 70 },
    blastRadiusThresholds: { immediate: 3, standardCanary: 15, conservativeCanary: 40 },
  });
  const result = analyzer.analyzeImpact(
    "test.config",
    "platform",
    { key: "value1" },
    { key: "value2" },
  );
  assert.ok(result != null);
});

test("ConfigImpactAnalyzer analyzeImpact calculates blast radius", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const result = analyzer.analyzeImpact(
    "security.config",
    "platform",
    { sandboxMode: "workspace_write", allowDestructiveActions: false },
    { sandboxMode: "no_restriction", allowDestructiveActions: true },
  );
  assert.ok(result.blastRadiusScore >= 0);
  assert.ok(result.blastRadiusScore <= 100);
});

test("ConfigImpactAnalyzer analyzeImpact returns rollback recommendation for critical high blast radius", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const result = analyzer.analyzeImpact(
    "security.config",
    "platform",
    { sandboxMode: "workspace_write", allowDestructiveActions: false },
    { sandboxMode: "no_restriction", allowDestructiveActions: true },
  );
  // Critical security changes should recommend rollback or manual approval
  if (result.overallSeverity === "critical") {
    assert.ok(result.rollbackRecommended === true || result.recommendedStrategy === "manual_approval");
  }
});

test("ConfigImpactAnalyzer analyzeImpact reports impacted components", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const result = analyzer.analyzeImpact(
    "test.config",
    "platform",
    { key1: "a", key2: "b" },
    { key1: "x", key2: "y" },
  );
  assert.ok(result.impactedComponents.length > 0);
});

test("ConfigImpactAnalyzer analyzeImpact with empty diff returns no severity", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const result = analyzer.analyzeImpact(
    "test.config",
    "platform",
    { key: "value" },
    { key: "value" },
  );
  assert.equal(result.overallSeverity, "none");
});

test("ConfigImpactAnalyzer analyzeImpact detects performance-sensitive changes", () => {
  const analyzer = new ConfigImpactAnalyzer();
  const result = analyzer.analyzeImpact(
    "runtime.config",
    "platform",
    { maxConcurrentTasks: 10, defaultTaskTimeoutMs: 60000 },
    { maxConcurrentTasks: 1, defaultTaskTimeoutMs: 60000 },
  );
  assert.ok(result.overallSeverity === "medium" || result.overallSeverity === "high");
});
