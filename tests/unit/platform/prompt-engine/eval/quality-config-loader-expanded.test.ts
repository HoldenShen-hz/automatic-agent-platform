import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

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

test("loadQualityConfig loads valid config file", () => {
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

test("loadQualityConfig returns default when file not found", () => {
  const config = loadQualityConfig("/nonexistent/path/to/config.json");

  assert.equal(config.qualityGate.defaultPassThreshold, 0.8);
  assert.equal(config.qualityGate.criticalPassThreshold, 0.95);
  assert.equal(config.qualityGate.enforcement, "blocking");
});

test("loadQualityConfig returns default when file has invalid JSON", () => {
  const dir = createTempConfigDir();
  try {
    const configPath = join(dir, "invalid.json");
    writeFileSync(configPath, "{ invalid json }", "utf-8");

    const config = loadQualityConfig(configPath);

    assert.equal(config.qualityGate.defaultPassThreshold, 0.8);
  } finally {
    cleanup(dir);
  }
});

test("loadQualityConfig returns default when required fields missing", () => {
  const dir = createTempConfigDir();
  try {
    const configPath = join(dir, "partial.json");
    writeFileSync(configPath, JSON.stringify({
      qualityGate: {
        defaultPassThreshold: 0.9,
      },
    }), "utf-8");

    const config = loadQualityConfig(configPath);

    assert.equal(config.qualityGate.defaultPassThreshold, 0.8);
  } finally {
    cleanup(dir);
  }
});

test("loadQualityConfig returns default when thresholds out of range", () => {
  const dir = createTempConfigDir();
  try {
    const configPath = join(dir, "oob.json");
    writeFileSync(configPath, JSON.stringify({
      qualityGate: {
        defaultPassThreshold: 1.5,
        criticalPassThreshold: -0.5,
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

    assert.equal(config.qualityGate.defaultPassThreshold, 0.8);
  } finally {
    cleanup(dir);
  }
});

test("loadQualityConfig validates enforcement field accepts blocking", () => {
  const dir = createTempConfigDir();
  try {
    const configPath = join(dir, "blocking.json");
    writeFileSync(configPath, JSON.stringify({
      qualityGate: {
        defaultPassThreshold: 0.8,
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

    const config = loadQualityConfig(configPath);
    assert.equal(config.qualityGate.enforcement, "blocking");
  } finally {
    cleanup(dir);
  }
});

test("loadQualityConfig validates enforcement field accepts warning", () => {
  const dir = createTempConfigDir();
  try {
    const configPath = join(dir, "warning.json");
    writeFileSync(configPath, JSON.stringify({
      qualityGate: {
        defaultPassThreshold: 0.8,
        criticalPassThreshold: 0.95,
        enforcement: "warning",
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
    assert.equal(config.qualityGate.enforcement, "warning");
  } finally {
    cleanup(dir);
  }
});

test("loadQualityConfig rejects invalid enforcement value", () => {
  const dir = createTempConfigDir();
  try {
    const configPath = join(dir, "invalid-enforcement.json");
    writeFileSync(configPath, JSON.stringify({
      qualityGate: {
        defaultPassThreshold: 0.8,
        criticalPassThreshold: 0.95,
        enforcement: "invalid",
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
    assert.equal(config.qualityGate.enforcement, "blocking");
  } finally {
    cleanup(dir);
  }
});

test("loadQualityConfig default returns all required fields", () => {
  const config = loadQualityConfig("/nonexistent.json");

  assert.ok("qualityGate" in config);
  assert.ok("qualityScoreWeights" in config);
  assert.ok("actionThresholds" in config);
  assert.ok("evidence" in config);
});

test("loadQualityConfig default evidence enabled is true", () => {
  const config = loadQualityConfig("/nonexistent.json");
  assert.equal(config.evidence.enabled, true);
});

test("loadQualityConfig default actionThresholds retryMaxFailures is 3", () => {
  const config = loadQualityConfig("/nonexistent.json");
  assert.equal(config.actionThresholds.retryMaxFailures, 3);
});