import assert from "node:assert/strict";
import test from "node:test";

import { ExplanationPipelineService, type StageRationale } from "../../../src/ops-maturity/explainability/explanation-pipeline-service.js";

test("StageRationale contains all required fields per R3-33", () => {
  const service = new ExplanationPipelineService();
  const request = {
    taskId: "task_r3_33_001",
    stageId: "approval",
    summary: "release requires manual approval due to production impact",
    decision: "accept" as const,
    decisionFactors: ["production change", "error budget tight"],
    evidence: [
      { evidenceId: "evt_1", category: "trace" },
    ],
    riskNotes: ["deploy affects production"],
    generatedAt: "2026-04-28T00:00:00.000Z",
  };

  const bundle = service.generate(request, "L2");

  // Verify StageRationale fields per R3-33
  assert.ok(bundle.rationale.rationaleId, "rationaleId should be present");
  assert.ok(bundle.rationale.taskId, "taskId should be present");
  assert.ok(bundle.rationale.stageId, "stageId should be present");
  assert.equal(bundle.rationale.decision, "accept", "decision should match request");
  assert.equal(bundle.rationale.inferredSummary, request.summary, "inferredSummary should match request");
  assert.deepEqual(bundle.rationale.decisionFactors, ["production change", "error budget tight"], "decisionFactors should match request");
  assert.ok(Array.isArray(bundle.rationale.evidenceRefs), "evidenceRefs should be an array");
  assert.ok(Array.isArray(bundle.rationale.riskNotes), "riskNotes should be an array");
  assert.ok(bundle.rationale.generatedAt, "generatedAt should be present");
});

test("StageRationale optional fields are set when provided via options", () => {
  const service = new ExplanationPipelineService();
  const request = {
    taskId: "task_r3_33_002",
    stageId: "testing",
    summary: "test stage rationale",
    decision: "replan" as const,
    decisionFactors: ["latency issue"],
    evidence: [],
    riskNotes: [],
  };

  const bundle = service.generate(request, "L2", {
    alternatives: ["retry_same_plan", "downgrade_mode"],
    confidence: 0.85,
    decisionInputRef: "input:123",
    versionLockRef: "version:456",
    visibilityLabels: ["internal", "privileged"],
  });

  assert.deepEqual(bundle.rationale.alternatives, ["retry_same_plan", "downgrade_mode"]);
  assert.equal(bundle.rationale.confidence, 0.85);
  assert.equal(bundle.rationale.decisionInputRef, "input:123");
  assert.equal(bundle.rationale.versionLockRef, "version:456");
  assert.deepEqual(bundle.rationale.visibilityLabels, ["internal", "privileged"]);
});

test("StageRationale renderedExplanation is generated", () => {
  const service = new ExplanationPipelineService();
  const request = {
    taskId: "task_r3_33_003",
    stageId: "deploy",
    summary: "deployment completed successfully",
    decision: "accept" as const,
    decisionFactors: ["all checks passed"],
    evidence: [
      { evidenceId: "evt_deploy_1", category: "trace" },
    ],
    riskNotes: [],
  };

  const bundle = service.generate(request, "L1");

  assert.ok(bundle.rationale.renderedExplanation, "renderedExplanation should be present");
  assert.ok(bundle.rationale.renderedExplanation.length > 0, "renderedExplanation should not be empty");
});

test("ExplanationBundle contains all required fields", () => {
  const service = new ExplanationPipelineService();
  const request = {
    taskId: "task_bundle_001",
    stageId: "approval",
    summary: "bundle structure test",
    decision: "accept" as const,
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  };

  const bundle = service.generate(request, "L2");

  assert.ok(bundle.explanationId, "explanationId should be present");
  assert.ok(bundle.depth === "L2" || bundle.depth === "L1" || bundle.depth === "L3", "depth should be valid");
  assert.ok(bundle.rationale, "rationale should be present");
  assert.ok(typeof bundle.rendered === "string", "rendered should be a string");
  assert.ok(Array.isArray(bundle.causalSummary), "causalSummary should be an array");
  assert.ok(Array.isArray(bundle.redactedEvidenceRefs), "redactedEvidenceRefs should be an array");
  assert.ok(bundle.cacheKey, "cacheKey should be present");
});

test("ExplanationPipelineService caches L1 and L2 but not L3 (audit)", () => {
  const service = new ExplanationPipelineService();
  const request = {
    taskId: "task_cache_001",
    stageId: "approval",
    summary: "cache test",
    decision: "accept" as const,
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  };

  const l1 = service.generate(request, "L1");
  const l2 = service.generate(request, "L2");
  const l3 = service.generate(request, "L3");

  // L1 and L2 should be cached
  assert.ok(service.getCached(l1.cacheKey), "L1 should be cached");
  assert.ok(service.getCached(l2.cacheKey), "L2 should be cached");

  // L3 (audit) should NOT be cached
  assert.strictEqual(service.getCached(l3.cacheKey), null, "L3 should not be cached");
});
