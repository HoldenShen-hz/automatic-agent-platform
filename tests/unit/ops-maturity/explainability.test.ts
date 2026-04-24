import assert from "node:assert/strict";
import test from "node:test";

import { ExplanationPipelineService, type ExplanationRequest } from "../../../src/ops-maturity/explainability/explanation-pipeline-service.js";
import { buildCausalChainSummary, buildCausalChain, type CausalLink } from "../../../src/ops-maturity/explainability/causal-chain-builder/index.js";
import { collectExplanationEvidenceIds, collectExplanationEvidence, type ExplanationEvidence } from "../../../src/ops-maturity/explainability/evidence-collector/index.js";

test("ExplanationPipelineService generate creates L1 brief explanation", () => {
  const service = new ExplanationPipelineService();

  const bundle = service.generate({
    taskId: "task:1",
    stage: "planning",
    summary: "Selected optimal route",
    decisionFactors: ["latency", "cost"],
    evidence: [],
    riskNotes: ["risk1"],
  }, "L1");

  assert.equal(bundle.depth, "L1");
  assert.equal(bundle.rendered, "planning: Selected optimal route");
  assert.equal(bundle.rationale.decisionFactors.length, 2);
  assert.equal(bundle.rationale.riskNotes.length, 1);
  assert.ok(bundle.explanationId.startsWith("expl_"));
});

test("ExplanationPipelineService generate creates L2 standard explanation with factors and risks", () => {
  const service = new ExplanationPipelineService();

  const bundle = service.generate({
    taskId: "task:2",
    stage: "execution",
    summary: "Approved deployment",
    decisionFactors: ["security_scan_passed", "test_coverage_90pct"],
    evidence: [],
    riskNotes: ["no_rollback_plan"],
  }, "L2");

  assert.equal(bundle.depth, "L2");
  assert.equal(bundle.rendered, "execution: Approved deployment factors=security_scan_passed; test_coverage_90pct risks=no_rollback_plan");
});

test("ExplanationPipelineService generate creates L3 audit explanation with causal chain", () => {
  const service = new ExplanationPipelineService();
  const causalLinks: CausalLink[] = [
    { source: "input_validation", target: "sanitization", rationale: "prevent injection" },
    { source: "sanitization", target: "safe_execution", rationale: "verified clean" },
  ];

  const bundle = service.generate({
    taskId: "task:3",
    stage: "review",
    summary: "Deployment approved after security scan",
    decisionFactors: ["cve_scan_passed"],
    evidence: [],
    riskNotes: ["edge_case_unclear"],
    causalLinks,
  }, "L3");

  assert.equal(bundle.depth, "L3");
  assert.match(bundle.rendered, /causal=/);
  assert.equal(bundle.causalSummary.length, 2);
});

test("ExplanationPipelineService caches explanations", () => {
  const service = new ExplanationPipelineService();

  const bundle1 = service.generate({
    taskId: "task:cache",
    stage: "planning",
    summary: "First generation",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  });

  const cached = service.getCached(bundle1.cacheKey);

  assert.ok(cached !== null);
  assert.equal(cached?.cacheKey, bundle1.cacheKey);
});

test("ExplanationPipelineService returns null for unknown cache key", () => {
  const service = new ExplanationPipelineService();

  const cached = service.getCached("unknown:key:depth");

  assert.equal(cached, null);
});

test("ExplanationPipelineService deduplicates decision factors and risk notes", () => {
  const service = new ExplanationPipelineService();

  const bundle = service.generate({
    taskId: "task:dedup",
    stage: "review",
    summary: "Deduplicated entries",
    decisionFactors: ["factor1", "factor2", "factor1", "factor3", "factor2"],
    evidence: [],
    riskNotes: ["risk1", "risk1", "risk2"],
  });

  assert.equal(bundle.rationale.decisionFactors.length, 3);
  assert.equal(bundle.rationale.riskNotes.length, 2);
});

test("ExplanationPipelineService filters evidence by allowed categories", () => {
  const service = new ExplanationPipelineService();
  const evidence: ExplanationEvidence[] = [
    { evidenceId: "evidence:1", category: "security" },
    { evidenceId: "evidence:2", category: "performance" },
    { evidenceId: "evidence:3", category: "security" },
  ];

  const bundle = service.generate({
    taskId: "task:filter",
    stage: "validation",
    summary: "Evidence filtered",
    decisionFactors: [],
    evidence,
    riskNotes: [],
    allowedEvidenceCategories: ["security"],
  });

  assert.equal(bundle.rationale.evidenceRefs.length, 2);
  assert.equal(bundle.redactedEvidenceRefs.length, 1);
});

test("buildCausalChainSummary converts links to formatted strings", () => {
  const links: CausalLink[] = [
    { source: "A", target: "B", rationale: "A leads to B" },
    { source: "B", target: "C", rationale: "B leads to C" },
  ];

  const summary = buildCausalChainSummary(links);

  assert.equal(summary.length, 2);
  assert.equal(summary[0], "A -> B: A leads to B");
  assert.equal(summary[1], "B -> C: B leads to C");
});

test("buildCausalChainSummary handles empty links", () => {
  const summary = buildCausalChainSummary([]);

  assert.equal(summary.length, 0);
});

test("buildCausalChain creates frozen chain object", () => {
  const nodes = [
    { nodeId: "n1", title: "Input", category: "signal" as const },
    { nodeId: "n2", title: "Decision", category: "decision" as const },
  ];
  const links: CausalLink[] = [
    { source: "n1", target: "n2", rationale: "Input triggers decision" },
  ];

  const chain = buildCausalChain(nodes, links);

  assert.equal(chain.nodes.length, 2);
  assert.equal(chain.links.length, 1);
  assert.equal(chain.summary.length, 1);
  assert.ok(Object.isFrozen(chain.nodes));
  assert.ok(Object.isFrozen(chain.links));
});

test("collectExplanationEvidenceIds extracts IDs from evidence", () => {
  const evidence: ExplanationEvidence[] = [
    { evidenceId: "e1", category: "cat1" },
    { evidenceId: "e2", category: "cat2" },
  ];

  const ids = collectExplanationEvidenceIds(evidence);

  assert.deepEqual(ids, ["e1", "e2"]);
});

test("collectExplanationEvidence groups evidence by category", () => {
  const evidence: ExplanationEvidence[] = [
    { evidenceId: "e1", category: "security" },
    { evidenceId: "e2", category: "performance" },
    { evidenceId: "e3", category: "security" },
  ];

  const bundle = collectExplanationEvidence(evidence);

  assert.deepEqual(bundle.evidenceIds, ["e1", "e2", "e3"]);
  assert.equal(bundle.groupedByCategory["security"].length, 2);
  assert.equal(bundle.groupedByCategory["performance"].length, 1);
});

test("collectExplanationEvidence handles empty evidence", () => {
  const bundle = collectExplanationEvidence([]);

  assert.deepEqual(bundle.evidenceIds, []);
  assert.deepEqual(Object.keys(bundle.groupedByCategory), []);
});
