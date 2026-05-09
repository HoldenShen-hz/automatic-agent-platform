import assert from "node:assert/strict";
import test from "node:test";

import { BehaviorFingerprintBuilder } from "../../../../../src/ops-maturity/drift-detection/fingerprint-builder/index.js";

test("BehaviorFingerprintBuilder produces a stable normalized fingerprint", () => {
  const builder = new BehaviorFingerprintBuilder();
  const fingerprint = builder.build({
    agentId: "agent-a",
    subjectType: "workflow",
    baselineRef: "baseline:v1",
    tools: ["edit", "read"],
    failureCategories: ["lint_error", "type_error"],
    averageLatencyMs: 1500,
    averageCostUsd: 0.3,
    avgStepCount: 8,
  });

  assert.equal(fingerprint.fingerprintId, "fingerprint:agent-a");
  assert.equal(fingerprint.subjectType, "workflow");
  assert.equal(fingerprint.baselineRef, "baseline:v1");
  assert.ok(fingerprint.normalizedFeatures.includes("subject_type:workflow"));
  assert.ok(fingerprint.normalizedFeatures.includes("baseline_ref:baseline:v1"));
  assert.ok(fingerprint.normalizedFeatures.includes("latency_bucket:medium"));
  assert.ok(fingerprint.normalizedFeatures.includes("avg_step_count:8"));
  assert.ok(fingerprint.normalizedFeatures.includes("step_count_bucket:medium"));
  assert.equal(fingerprint.hash.length, 64);
});
