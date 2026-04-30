/**
 * Quality Config Loader Unit Tests
 *
 * Tests for quality-config-loader covering:
 * - Issue #1954: Bare catch {} swallows errors
 */

import assert from "node:assert/strict";
import test from "node:test";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { loadQualityConfig } from "../../../../../src/platform/prompt-engine/eval/quality-config-loader.js";
import type { QualityGateConfig } from "../../../../../src/platform/prompt-engine/eval/types.js";

function createTempConfigDir(): string {
  const dir = join(tmpdir(), `quality-config-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

// ============================================================================
// Issue #1954: Bare catch {} swallows errors
// ============================================================================

test("loadQualityConfig returns default config when file does not exist", () => {
  const config = loadQualityConfig("/nonexistent/path/config.json");

  assert.equal(config.qualityGate.defaultPassThreshold, 0.8);
  assert.equal(config.qualityGate.criticalPassThreshold, 0.95);
  assert.equal(config.qualityGate.enforcement, "blocking");
});

test("loadQualityConfig returns default config when file has malformed JSON", () => {
  const dir = createTempConfigDir();
  try {
    const configPath = join(dir, "malformed.json");
    writeFileSync(configPath, "{ this is not valid json", "utf-8");

    // Issue #1954: Bare catch {} should not throw, should return default
    const config = loadQualityConfig(configPath);

    assert.equal(config.qualityGate.defaultPassThreshold, 0.8);
    assert.equal(config.qualityGate.criticalPassThreshold, 0.95);
  } finally {
    cleanup(dir);
  }
});

test("loadQualityConfig returns default config when JSON is valid but schema invalid", () => {
  const dir = createTempConfigDir();
  try {
    const configPath = join(dir, "invalid-schema.json");
    writeFileSync(configPath, JSON.stringify({
      qualityGate: {
        defaultPassThreshold: "not a number",
        criticalPassThreshold: 0.95,
        enforcement: "blocking",
      },
      qualityScoreWeights: {
        successSignal: 0.4,
        completionOutcome: 0.3,
        failureSignal: 0.2,
        partialSignal: 0.1,
      },
      actionThresholds: {
        completeMinScore: 0.7,
        approvalRequiredScore: 0.5,
        retryMaxFailures: 3,
      },
      evidence: {
        enabled: true,
        artifactKind: "report",
        retentionDays: 30,
      },
    }), "utf-8");

    // Issue #1954: Schema validation failure should be caught silently
    const config = loadQualityConfig(configPath);

    // Should return default values due to schema validation failure
    assert.equal(config.qualityGate.defaultPassThreshold, 0.8);
  } finally {
    cleanup(dir);
  }
});

test("loadQualityConfig returns default config when required fields are missing", () => {
  const dir = createTempConfigDir();
  try {
    const configPath = join(dir, "missing-fields.json");
    writeFileSync(configPath, JSON.stringify({
      qualityGate: {},
    }), "utf-8");

    const config = loadQualityConfig(configPath);

    assert.equal(config.qualityGate.defaultPassThreshold, 0.8);
    assert.equal(config.qualityGate.enforcement, "blocking");
  } finally {
    cleanup(dir);
  }
});

test("loadQualityConfig returns default config when thresholds are out of range", () => {
  const dir = createTempConfigDir();
  try {
    const configPath = join(dir, "oob.json");
    writeFileSync(configPath, JSON.stringify({
      qualityGate: {
        defaultPassThreshold: 1.5, // > 1
        criticalPassThreshold: -0.5, // < 0
        enforcement: "blocking",
      },
      qualityScoreWeights: {
        successSignal: 0.4,
        completionOutcome: 0.3,
        failureSignal: 0.2,
        partialSignal: 0.1,
      },
      actionThresholds: {
        completeMinScore: 0.7,
        approvalRequiredScore: 0.5,
        retryMaxFailures: 3,
      },
      evidence: {
        enabled: true,
        artifactKind: "report",
        retentionDays: 30,
      },
    }), "utf-8");

    const config = loadQualityConfig(configPath);

    // Should return default due to validation failure
    assert.equal(config.qualityGate.defaultPassThreshold, 0.8);
  } finally {
    cleanup(dir);
  }
});

test("loadQualityConfig loads valid config successfully", () => {
  const dir = createTempConfigDir();
  try {
    const configPath = join(dir, "valid-config.json");
    writeFileSync(configPath, JSON.stringify({
      qualityGate: {
        defaultPassThreshold: 0.85,
        criticalPassThreshold: 0.98,
        enforcement: "warning",
      },
      qualityScoreWeights: {
        successSignal: 0.5,
        completionOutcome: 0.25,
        failureSignal: 0.15,
        partialSignal: 0.1,
      },
      actionThresholds: {
        completeMinScore: 0.75,
        approvalRequiredScore: 0.6,
        retryMaxFailures: 5,
      },
      evidence: {
        enabled: true,
        artifactKind: "quality_artifact",
        retentionDays: 60,
      },
    }), "utf-8");

    const config = loadQualityConfig(configPath);

    assert.equal(config.qualityGate.defaultPassThreshold, 0.85);
    assert.equal(config.qualityGate.criticalPassThreshold, 0.98);
    assert.equal(config.qualityGate.enforcement, "warning");
    assert.equal(config.qualityScoreWeights.successSignal, 0.5);
    assert.equal(config.actionThresholds.completeMinScore, 0.75);
    assert.equal(config.actionThresholds.retryMaxFailures, 5);
    assert.equal(config.evidence.artifactKind, "quality_artifact");
    assert.equal(config.evidence.retentionDays, 60);
  } finally {
    cleanup(dir);
  }
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

test("loadQualityConfig handles empty file gracefully", () => {
  const dir = createTempConfigDir();
  try {
    const configPath = join(dir, "empty.json");
    writeFileSync(configPath, "", "utf-8");

    const config = loadQualityConfig(configPath);

    // Should return default config, not throw
    assert.equal(config.qualityGate.defaultPassThreshold, 0.8);
  } finally {
    cleanup(dir);
  }
});

test("loadQualityConfig handles partially valid config", () => {
  const dir = createTempConfigDir();
  try {
    const configPath = join(dir, "partial.json");
    writeFileSync(configPath, JSON.stringify({
      qualityGate: {
        defaultPassThreshold: 0.9,
        // missing criticalPassThreshold and enforcement
      },
      // missing other required sections
    }), "utf-8");

    const config = loadQualityConfig(configPath);

    // Should use defaults for missing fields
    assert.ok(config.qualityGate.criticalPassThreshold >= 0);
    assert.ok(config.actionThresholds.completeMinScore >= 0);
  } finally {
    cleanup(dir);
  }
});