import assert from "node:assert/strict";
import test from "node:test";

import { ExplanationPipelineService } from "../../../../src/ops-maturity/explainability/explanation-pipeline-service.js";

test("ExplanationPipelineService generates brief (L1) explanation without factors or risks in rendered output", () => {
  const service = new ExplanationPipelineService();

  const bundle = service.generate({
    taskId: "task:1",
    stageId: "planning",
    summary: "Selected optimal route",
    decision: "accept",
    decisionFactors: ["latency", "cost"],
    evidence: [],
    riskNotes: ["risk1"],
  }, "L1");

  assert.equal(bundle.depth, "L1");
  // L1 (brief) only shows stage and summary - factors and risks are excluded from rendered output
  assert.equal(bundle.rendered, "planning: Selected optimal route decision=accept");
  // Rationale object still contains the factors and risks internally
  assert.equal(bundle.rationale.decisionFactors.length, 2);
  assert.equal(bundle.rationale.riskNotes.length, 1);
});

test("ExplanationPipelineService generates standard (L2) explanation with factors and risks", () => {
  const service = new ExplanationPipelineService();

  const bundle = service.generate({
    taskId: "task:2",
    stageId: "execution",
    summary: "Approved deployment",
    decision: "accept",
    decisionFactors: ["security_scan_passed", "test_coverage_90pct"],
    evidence: [],
    riskNotes: ["no_rollback_plan"],
  }, "L2");

  assert.equal(bundle.depth, "L2");
  assert.equal(bundle.rendered, "execution: Approved deployment decision=accept factors=security_scan_passed; test_coverage_90pct risks=no_rollback_plan");
  assert.equal(bundle.rationale.decisionFactors.length, 2);
  assert.equal(bundle.rationale.riskNotes.length, 1);
});

test("ExplanationPipelineService generates audit (L3) explanation with causal chain and redactions", () => {
  const service = new ExplanationPipelineService();
  const causalLinks = [
    { source: "input_validation", target: "sanitization", rationale: "prevent injection" },
    { source: "sanitization", target: "safe_execution", rationale: "verified clean" },
  ];

  const bundle = service.generate({
    taskId: "task:3",
    stageId: "review",
    summary: "Deployment approved after security scan",
    decision: "accept",
    decisionFactors: ["cve_scan_passed"],
    evidence: [
      { evidenceId: "scan:result:1", category: "security" },
      { evidenceId: "perf:report:2", category: "performance" },
    ],
    riskNotes: ["edge_case_unclear"],
    causalLinks,
    allowedEvidenceCategories: ["security"],
  }, "L3");

  assert.equal(bundle.depth, "L3");
  assert.match(bundle.rendered, /causal=/);
  assert.match(bundle.rendered, /redacted=/);
  assert.equal(bundle.causalSummary.length, 2);
  assert.equal(bundle.redactedEvidenceRefs.length, 1);
  assert.equal(bundle.redactedEvidenceRefs[0], "perf:report:2");
});

test("ExplanationPipelineService builds causal chain summary from causal links", () => {
  const service = new ExplanationPipelineService();
  const causalLinks = [
    { source: "A", target: "B", rationale: "A leads to B" },
    { source: "B", target: "C", rationale: "B leads to C" },
    { source: "C", target: "D", rationale: "C leads to D" },
  ];

  const bundle = service.generate({
    taskId: "task:4",
    stageId: "analysis",
    summary: "Chain complete",
    decision: "accept",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
    causalLinks,
  });

  assert.equal(bundle.causalSummary.length, 3);
  assert.equal(bundle.causalSummary[0], "A -> B: A leads to B");
  assert.equal(bundle.causalSummary[1], "B -> C: B leads to C");
  assert.equal(bundle.causalSummary[2], "C -> D: C leads to D");
});

test("ExplanationPipelineService collects evidence IDs from visible categories", () => {
  const service = new ExplanationPipelineService();

  const bundle = service.generate({
    taskId: "task:5",
    stageId: "validation",
    summary: "Evidence filtered by category",
    decision: "accept",
    decisionFactors: [],
    evidence: [
      { evidenceId: "evidence:1", category: "security" },
      { evidenceId: "evidence:2", category: "performance" },
      { evidenceId: "evidence:3", category: "security" },
      { evidenceId: "evidence:4", category: "compliance" },
    ],
    riskNotes: [],
    allowedEvidenceCategories: ["security", "compliance"],
  });

  assert.equal(bundle.rationale.evidenceRefs.length, 3);
  assert.ok(bundle.rationale.evidenceRefs.includes("evidence:1"));
  assert.ok(bundle.rationale.evidenceRefs.includes("evidence:3"));
  assert.ok(bundle.rationale.evidenceRefs.includes("evidence:4"));
});

test("ExplanationPipelineService redacts evidence not in allowed categories", () => {
  const service = new ExplanationPipelineService();

  const bundle = service.generate({
    taskId: "task:6",
    stageId: "audit",
    summary: "Sensitive data redacted",
    decision: "accept",
    decisionFactors: [],
    evidence: [
      { evidenceId: "pub:doc:1", category: "public" },
      { evidenceId: "priv:log:2", category: "internal" },
      { evidenceId: "conf:cred:3", category: "confidential" },
    ],
    riskNotes: [],
    allowedEvidenceCategories: ["public"],
  });

  assert.equal(bundle.redactedEvidenceRefs.length, 2);
  assert.ok(bundle.redactedEvidenceRefs.includes("priv:log:2"));
  assert.ok(bundle.redactedEvidenceRefs.includes("conf:cred:3"));
});

test("ExplanationPipelineService deduplicates decision factors and risk notes", () => {
  const service = new ExplanationPipelineService();

  const bundle = service.generate({
    taskId: "task:7",
    stageId: "review",
    summary: "Deduplicated entries",
    decision: "accept",
    decisionFactors: ["factor1", "factor2", "factor1", "factor3", "factor2"],
    evidence: [],
    riskNotes: ["risk1", "risk1", "risk2"],
  });

  assert.equal(bundle.rationale.decisionFactors.length, 3);
  assert.equal(bundle.rationale.riskNotes.length, 2);
});

test("ExplanationPipelineService caches generated explanations", () => {
  const service = new ExplanationPipelineService();

  const bundle1 = service.generate({
    taskId: "task:8",
    stageId: "planning",
    summary: "First generation",
    decision: "accept",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  });

  const cached = service.getCached(bundle1.cacheKey);

  assert.ok(cached !== null);
  assert.equal(cached?.cacheKey, bundle1.cacheKey);
  assert.equal(cached?.summary, bundle1.rationale.summary);
});

test("ExplanationPipelineService returns null for unknown cache key", () => {
  const service = new ExplanationPipelineService();

  const cached = service.getCached("unknown:key:depth");

  assert.equal(cached, null);
});

test("ExplanationPipelineService generates unique explanation IDs", () => {
  const service = new ExplanationPipelineService();

  const bundle1 = service.generate({
    taskId: "task:9",
    stageId: "step1",
    summary: "First",
    decision: "accept",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  });

  const bundle2 = service.generate({
    taskId: "task:9",
    stageId: "step1",
    summary: "First",
    decision: "accept",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  });

  assert.notEqual(bundle1.explanationId, bundle2.explanationId);
});

test("ExplanationPipelineService uses provided generatedAt timestamp", () => {
  const service = new ExplanationPipelineService();
  const fixedTime = "2026-04-21T12:00:00.000Z";

  const bundle = service.generate({
    taskId: "task:10",
    stageId: "planning",
    summary: "Fixed timestamp",
    decision: "accept",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
    generatedAt: fixedTime,
  });

  assert.equal(bundle.rationale.generatedAt, fixedTime);
});

test("ExplanationPipelineService generates correct cache key format", () => {
  const service = new ExplanationPipelineService();

  const bundle = service.generate({
    taskId: "task:abc",
    stageId: "deploy",
    summary: "Cache key format",
    decision: "accept",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  }, "L3");

  assert.equal(bundle.cacheKey, "task:abc:deploy:audit");
});
