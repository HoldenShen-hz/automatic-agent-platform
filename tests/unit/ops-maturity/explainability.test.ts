import assert from "node:assert/strict";
import test from "node:test";
import { ExplanationPipelineService, type ExplanationRequest } from "../../../src/ops-maturity/explainability/explanation-pipeline-service.js";
import { collectExplanationEvidenceIds, type ExplanationEvidence } from "../../../src/ops-maturity/explainability/evidence-collector/index.js";
import { buildCausalChainSummary, type CausalLink } from "../../../src/ops-maturity/explainability/causal-chain-builder/index.js";
import { putExplanationCacheEntry, type ExplanationCacheEntry } from "../../../src/ops-maturity/explainability/explanation-cache/index.js";
import { renderStageExplanation } from "../../../src/ops-maturity/explainability/explanation-renderer/index.js";

test("explainability: generate L2 explanation bundle", () => {
  const service = new ExplanationPipelineService();
  const evidence: ExplanationEvidence[] = [
    { evidenceId: "ev1", category: "performance", excerpt: "latency < 100ms" },
    { evidenceId: "ev2", category: "cost", excerpt: "within budget" },
  ];
  const request: ExplanationRequest = {
    taskId: "task-001",
    stageId: "stage-decide",
    summary: "Accepted due to low latency",
    decision: "accept",
    decisionFactors: ["latency", "cost"],
    evidence,
    riskNotes: [],
  };

  const bundle = service.generate(request, "L2");

  assert.strictEqual(bundle.depth, "L2");
  assert.strictEqual(bundle.rationale.taskId, "task-001");
  assert.strictEqual(bundle.rationale.stageId, "stage-decide");
  assert.strictEqual(bundle.rationale.decision, "accept");
  assert.strictEqual(bundle.rationale.evidenceRefs.length, 2);
  assert.strictEqual(bundle.cacheKey, "task-001:stage-decide:L2");
});

test("explainability: generate L1 explanation bundle", () => {
  const service = new ExplanationPipelineService();
  const request: ExplanationRequest = {
    taskId: "task-002",
    stage: "stage-retry",
    summary: "Retry with same plan",
    decision: "retry_same_plan",
    decisionFactors: ["transient_error"],
    evidence: [],
    riskNotes: ["potential infinite loop"],
  };

  const bundle = service.generate(request, "L1");

  assert.strictEqual(bundle.depth, "L1");
  assert.ok(bundle.rendered.includes("retry_same_plan"));
});

test("explainability: generate L3 explanation bundle with causal chain", () => {
  const service = new ExplanationPipelineService();
  const causalLinks: CausalLink[] = [
    { source: "input_validated", target: "model_invoked", rationale: "validated input" },
    { source: "model_invoked", target: "output_generated", rationale: "model succeeded" },
  ];
  const evidence: ExplanationEvidence[] = [
    { evidenceId: "ev-a", category: "validation", excerpt: "input ok" },
    { evidenceId: "ev-b", category: "model", excerpt: "response ok" },
  ];
  const request: ExplanationRequest = {
    taskId: "task-003",
    stageId: "stage-escalate",
    summary: "Escalate to human",
    decision: "escalate_to_human",
    decisionFactors: ["ambiguous_input"],
    evidence,
    riskNotes: ["high_risk_action"],
    causalLinks,
    allowedEvidenceCategories: ["validation"],
  };

  const bundle = service.generate(request, "L3");

  assert.strictEqual(bundle.depth, "L3");
  assert.ok(bundle.causalSummary.length > 0);
  assert.ok(bundle.redactedEvidenceRefs.length > 0);
});

test("explainability: cached entry retrieval", () => {
  const service = new ExplanationPipelineService();
  const request: ExplanationRequest = {
    taskId: "task-cache-test",
    stageId: "stage-cache",
    summary: "Cached explanation",
    decision: "accept",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  };

  service.generate(request, "L2");
  const cached = service.getCached("task-cache-test:stage-cache:L2");

  assert.ok(cached != null);
  assert.strictEqual(cached.cacheKey, "task-cache-test:stage-cache:L2");
});

test("explainability: cache miss returns null", () => {
  const service = new ExplanationPipelineService();
  const cached = service.getCached("nonexistent:key:cache");

  assert.strictEqual(cached, null);
});

test("explainability: allowed evidence categories filter correctly", () => {
  const service = new ExplanationPipelineService();
  const evidence: ExplanationEvidence[] = [
    { evidenceId: "ev-public", category: "public", excerpt: "info" },
    { evidenceId: "ev-internal", category: "internal", excerpt: "sensitive" },
    { evidenceId: "ev-restricted", category: "restricted", excerpt: "confidential" },
  ];
  const request: ExplanationRequest = {
    taskId: "task-filter",
    stageId: "stage-filter",
    summary: "Filtered test",
    decision: "accept",
    decisionFactors: [],
    evidence,
    riskNotes: [],
    allowedEvidenceCategories: ["public"],
  };

  const bundle = service.generate(request, "L2");

  assert.strictEqual(bundle.rationale.evidenceRefs.length, 1);
  assert.strictEqual(bundle.rationale.evidenceRefs[0], "ev-public");
  assert.strictEqual(bundle.redactedEvidenceRefs.length, 2);
});

test("explainability: evidence collector utility", () => {
  const evidence: ExplanationEvidence[] = [
    { evidenceId: "id1", category: "cat1" },
    { evidenceId: "id2", category: "cat2" },
  ];
  const ids = collectExplanationEvidenceIds(evidence);

  assert.deepStrictEqual(ids, ["id1", "id2"]);
});

test("explainability: causal chain builder utility", () => {
  const links: CausalLink[] = [
    { source: "A", target: "B", rationale: "because A" },
    { source: "B", target: "C", rationale: "because B" },
  ];
  const summary = buildCausalChainSummary(links);

  assert.deepStrictEqual(summary, ["A -> B: because A", "B -> C: because B"]);
});

test("explainability: explanation cache entry", () => {
  const cache: Record<string, ExplanationCacheEntry> = {};
  const entry: ExplanationCacheEntry = { cacheKey: "k1", summary: "test", ttlHours: 24 };
  const updated = putExplanationCacheEntry(cache, entry);

  assert.strictEqual(updated["k1"]?.summary, "test");
  assert.strictEqual(updated["k1"]?.ttlHours, 24);
});

test("explainability: explanation cache entry with ttl=0 does not persist", () => {
  const cache: Record<string, ExplanationCacheEntry> = {};
  const entry: ExplanationCacheEntry = { cacheKey: "k2", summary: "zero ttl", ttlHours: 0 };
  const updated = putExplanationCacheEntry(cache, entry);

  assert.strictEqual(updated["k2"], undefined);
});

test("explainability: stage explanation renderer", () => {
  const rendered = renderStageExplanation("stage1", "summary text", ["ev1", "ev2"]);

  assert.ok(rendered.includes("stage1"));
  assert.ok(rendered.includes("summary text"));
  assert.ok(rendered.includes("ev1"));
  assert.ok(rendered.includes("ev2"));
});

test("explainability: generate with options", () => {
  const service = new ExplanationPipelineService();
  const request: ExplanationRequest = {
    taskId: "task-opts",
    stageId: "stage-opts",
    summary: "With options",
    decision: "replan",
    decisionFactors: ["inefficient"],
    evidence: [],
    riskNotes: [],
  };

  const bundle = service.generate(request, "L2", {
    alternatives: ["use_cache", "batch_requests"],
    confidence: 0.85,
    decisionInputRef: "input-ref-123",
    versionLockRef: "v1.0",
    visibilityLabels: ["admin", "auditor"],
  });

  assert.strictEqual(bundle.rationale.alternatives?.length, 2);
  assert.strictEqual(bundle.rationale.confidence, 0.85);
  assert.strictEqual(bundle.rationale.decisionInputRef, "input-ref-123");
  assert.strictEqual(bundle.rationale.versionLockRef, "v1.0");
});

test("explainability: unique decision factors and risk notes", () => {
  const service = new ExplanationPipelineService();
  const request: ExplanationRequest = {
    taskId: "task-unique",
    stageId: "stage-unique",
    summary: "Deduplicated",
    decision: "downgrade_mode",
    decisionFactors: ["factor1", "factor1", "factor2"],
    evidence: [],
    riskNotes: ["risk1", "risk1"],
  };

  const bundle = service.generate(request, "L1");

  assert.strictEqual(bundle.rationale.decisionFactors.length, 2);
  assert.strictEqual(bundle.rationale.riskNotes.length, 1);
});
