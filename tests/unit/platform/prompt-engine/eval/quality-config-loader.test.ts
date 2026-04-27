import assert from "node:assert/strict";
import test from "node:test";
import { loadQualityConfig } from "../../../../../../src/platform/prompt-engine/eval/quality-config-loader.js";

test("loadQualityConfig returns default config when file does not exist", () => {
  const config = loadQualityConfig("/nonexistent/path/config.json");
  
  assert.equal(config.qualityGate.defaultPassThreshold, 0.8);
  assert.equal(config.qualityGate.criticalPassThreshold, 0.95);
  assert.equal(config.qualityGate.enforcement, "blocking");
});

test("loadQualityConfig default weights sum appropriately", () => {
  const config = loadQualityConfig("/nonexistent/path/config.json");
  
  assert.ok(config.qualityScoreWeights.successSignal >= 0);
  assert.ok(config.qualityScoreWeights.completionOutcome >= 0);
  assert.ok(config.qualityScoreWeights.failureSignal >= 0);
  assert.ok(config.qualityScoreWeights.partialSignal >= 0);
});

test("loadQualityConfig default action thresholds are valid", () => {
  const config = loadQualityConfig("/nonexistent/path/config.json");
  
  assert.ok(config.actionThresholds.completeMinScore >= 0);
  assert.ok(config.actionThresholds.completeMinScore <= 1);
  assert.ok(config.actionThresholds.approvalRequiredScore >= 0);
  assert.ok(config.actionThresholds.approvalRequiredScore <= 1);
  assert.ok(config.actionThresholds.retryMaxFailures >= 0);
});

test("loadQualityConfig default evidence settings", () => {
  const config = loadQualityConfig("/nonexistent/path/config.json");
  
  assert.equal(config.evidence.enabled, true);
  assert.equal(config.evidence.artifactKind, "quality_report");
  assert.equal(config.evidence.retentionDays, 30);
});

test("loadQualityConfig returns valid structure with all required fields", () => {
  const config = loadQualityConfig("/nonexistent/path/config.json");
  
  assert.ok(config.qualityGate != null);
  assert.ok(config.qualityScoreWeights != null);
  assert.ok(config.actionThresholds != null);
  assert.ok(config.evidence != null);
});

test("loadQualityConfig default pass thresholds are in valid range", () => {
  const config = loadQualityConfig("/nonexistent/path/config.json");
  
  assert.ok(config.qualityGate.defaultPassThreshold >= 0);
  assert.ok(config.qualityGate.defaultPassThreshold <= 1);
  assert.ok(config.qualityGate.criticalPassThreshold >= 0);
  assert.ok(config.qualityGate.criticalPassThreshold <= 1);
});
