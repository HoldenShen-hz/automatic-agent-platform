import assert from "node:assert/strict";
import test from "node:test";
import {
  ExplanationPipelineService,
  type ExplanationRequest,
} from "../../../src/ops-maturity/explainability/explanation-pipeline-service.js";
import { collectExplanationEvidenceIds, type ExplanationEvidence } from "../../../src/ops-maturity/explainability/evidence-collector/index.js";
import { buildCausalChainSummary, type CausalLink } from "../../../src/ops-maturity/explainability/causal-chain-builder/index.js";
import { putExplanationCacheEntry, type ExplanationCacheEntry } from "../../../src/ops-maturity/explainability/explanation-cache/index.js";
import { renderStageExplanation } from "../../../src/ops-maturity/explainability/explanation-renderer/index.js";

test("explainability: generate creates version lock", () => {
  const service = new ExplanationPipelineService();
  const request: ExplanationRequest = {
    taskId: "task-version-lock",
    stageId: "stage-lock",
    summary: "Testing version lock",
    decision: "accept",
    decisionFactors: ["test"],
    evidence: [],
    riskNotes: [],
  };

  const bundle = service.generate(request, "L2");

  assert.ok(bundle.versionLockRef.length > 0);
  assert.ok(bundle.versionLockRef.startsWith("vlock:"));
});

test("explainability: verifyVersionLock returns true for existing rationale", () => {
  const service = new ExplanationPipelineService();
  const request: ExplanationRequest = {
    taskId: "task-verify-lock",
    stageId: "stage-verify",
    summary: "Verify lock test",
    decision: "accept",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  };

  const bundle = service.generate(request, "L2");
  const verified = service.verifyVersionLock(bundle.rationale.rationaleId, bundle.versionLockRef);

  assert.strictEqual(verified, true);
});

test("explainability: verifyVersionLock returns false for non-existent rationale", () => {
  const service = new ExplanationPipelineService();

  const verified = service.verifyVersionLock("non-existent-id", "vlock:abc");

  assert.strictEqual(verified, false);
});

test("explainability: recordExplanationView creates audit entry", () => {
  const service = new ExplanationPipelineService();
  const request: ExplanationRequest = {
    taskId: "task-audit-view",
    stageId: "stage-audit",
    summary: "Audit trail test",
    decision: "accept",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  };

  const bundle = service.generate(request, "L2");
  service.recordExplanationView(bundle.rationale.rationaleId, bundle.explanationId, {
    userId: "user-123",
    audience: "technical",
    ipAddress: "192.168.1.1",
    userAgent: "test-agent",
  });

  const trail = service.getAuditTrail(bundle.rationale.rationaleId);

  assert.strictEqual(trail.length, 2); // generate + view
  const viewEntry = trail.find((e) => e.accessType === "view");
  assert.ok(viewEntry !== undefined);
  assert.strictEqual(viewEntry?.userId, "user-123");
  assert.strictEqual(viewEntry?.audience, "technical");
  assert.match(viewEntry?.ipAddress ?? "", /^ipv4:/);
  assert.match(viewEntry?.userAgent ?? "", /test-agent \[redacted\]#/);
});

test("explainability: generate with audit options", () => {
  const service = new ExplanationPipelineService();
  const request: ExplanationRequest = {
    taskId: "task-audit-gen",
    stageId: "stage-audit-gen",
    summary: "Generate with audit",
    decision: "accept",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  };

  const bundle = service.generate(request, "L2", {
    auditUserId: "auditor-001",
    auditIpAddress: "10.0.0.1",
    auditUserAgent: "audit-tool",
  });

  const trail = service.getAuditTrail(bundle.rationale.rationaleId);
  const genEntry = trail.find((e) => e.accessType === "generate");
  assert.ok(genEntry !== undefined);
  assert.strictEqual(genEntry?.userId, "auditor-001");
  assert.match(genEntry?.ipAddress ?? "", /^ipv4:/);
  assert.match(genEntry?.userAgent ?? "", /audit-tool \[redacted\]#/);
});

test("explainability: version lock uses full sha256-sized digest", () => {
  const service = new ExplanationPipelineService();
  const bundle = service.generate({
    taskId: "task-full-version-lock",
    stageId: "stage-full-version-lock",
    summary: "Digest length check",
    decision: "accept",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  });

  assert.match(bundle.versionLockRef, /^vlock:[0-9a-f]{64}$/);
});

test("explainability: audit trail tracks multiple accesses", () => {
  const service = new ExplanationPipelineService();
  const request: ExplanationRequest = {
    taskId: "task-multi-access",
    stageId: "stage-multi",
    summary: "Multi access test",
    decision: "accept",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  };

  const bundle = service.generate(request, "L2");
  service.recordExplanationView(bundle.rationale.rationaleId, bundle.explanationId, { userId: "user-1" });
  service.recordExplanationView(bundle.rationale.rationaleId, bundle.explanationId, { userId: "user-2" });

  const trail = service.getAuditTrail(bundle.rationale.rationaleId);

  assert.strictEqual(trail.length, 3);
  const viewEntries = trail.filter((e) => e.accessType === "view");
  assert.strictEqual(viewEntries.length, 2);
});

test("explainability: getAuditTrail returns empty for unknown rationale", () => {
  const service = new ExplanationPipelineService();

  const trail = service.getAuditTrail("unknown-rationale-id");

  assert.strictEqual(trail.length, 0);
});

test("explainability: generate L3 with forensic budget", () => {
  const service = new ExplanationPipelineService();
  const request: ExplanationRequest = {
    taskId: "task-l3-forensic",
    stageId: "stage-forensic",
    summary: "L3 forensic test",
    decision: "escalate_to_human",
    decisionFactors: ["high_risk"],
    evidence: [],
    riskNotes: ["severe_impact"],
    causalLinks: [
      { source: "input", target: "process", rationale: "validated" },
      { source: "process", target: "output", rationale: "completed" },
    ],
  };

  const bundle = service.generate(request, "L3", {
    forensicBudgetReservationId: "budget:l3:forensic",
  });

  assert.strictEqual(bundle.depth, "L3");
  assert.ok(bundle.causalSummary.length > 0);
  assert.ok(bundle.rendered.includes("causal="));
});

test("explainability: L3 audience is audit", () => {
  const service = new ExplanationPipelineService();
  const request: ExplanationRequest = {
    taskId: "task-l3-audience",
    stageId: "stage-audience",
    summary: "L3 audience test",
    decision: "accept",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  };

  const bundle = service.generate(request, "L3", {
    forensicBudgetReservationId: "budget:l3:audience",
  });

  const trail = service.getAuditTrail(bundle.rationale.rationaleId);
  const genEntry = trail.find((e) => e.accessType === "generate");
  assert.strictEqual(genEntry?.audience, "audit");
});

test("explainability: L2 audience is technical", () => {
  const service = new ExplanationPipelineService();
  const request: ExplanationRequest = {
    taskId: "task-l2-audience",
    stageId: "stage-audience-l2",
    summary: "L2 audience test",
    decision: "accept",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  };

  const bundle = service.generate(request, "L2");

  const trail = service.getAuditTrail(bundle.rationale.rationaleId);
  const genEntry = trail.find((e) => e.accessType === "generate");
  assert.strictEqual(genEntry?.audience, "technical");
});

test("explainability: L1 audience is business", () => {
  const service = new ExplanationPipelineService();
  const request: ExplanationRequest = {
    taskId: "task-l1-audience",
    stageId: "stage-audience-l1",
    summary: "L1 audience test",
    decision: "accept",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  };

  const bundle = service.generate(request, "L1");

  const trail = service.getAuditTrail(bundle.rationale.rationaleId);
  const genEntry = trail.find((e) => e.accessType === "generate");
  assert.strictEqual(genEntry?.audience, "business");
});

test("explainability: evidence collector handles empty array", () => {
  const ids = collectExplanationEvidenceIds([]);

  assert.deepStrictEqual(ids, []);
});

test("explainability: evidence collector extracts ids", () => {
  const evidence: ExplanationEvidence[] = [
    { evidenceId: "ev-1", category: "cat1" },
    { evidenceId: "ev-2", category: "cat2" },
    { evidenceId: "ev-3", category: "cat3" },
  ];

  const ids = collectExplanationEvidenceIds(evidence);

  assert.deepStrictEqual(ids, ["ev-1", "ev-2", "ev-3"]);
});

test("explainability: causal chain builder with empty links", () => {
  const summary = buildCausalChainSummary([]);

  assert.deepStrictEqual(summary, []);
});

test("explainability: causal chain builder with single link", () => {
  const links: CausalLink[] = [
    { source: "input", target: "process", rationale: "validated" },
  ];

  const summary = buildCausalChainSummary(links);

  assert.deepStrictEqual(summary, ["input -> process: validated"]);
});

test("explainability: causal chain builder with multiple links", () => {
  const links: CausalLink[] = [
    { source: "A", target: "B", rationale: "A leads to B" },
    { source: "B", target: "C", rationale: "B leads to C" },
    { source: "C", target: "D", rationale: "C leads to D" },
  ];

  const summary = buildCausalChainSummary(links);

  assert.strictEqual(summary.length, 3);
  assert.ok(summary[0].includes("A -> B"));
  assert.ok(summary[2].includes("C -> D"));
});

test("explainability: explanation cache stores entry", () => {
  let cache: Record<string, ExplanationCacheEntry> = {};
  const entry: ExplanationCacheEntry = {
    cacheKey: "task:stage:depth",
    summary: "Test summary",
    ttlHours: 24,
  };

  cache = putExplanationCacheEntry(cache, entry);

  assert.strictEqual(cache["task:stage:depth"]?.summary, "Test summary");
});

test("explainability: explanation cache ttl=0 is not stored", () => {
  let cache: Record<string, ExplanationCacheEntry> = {};
  const entry: ExplanationCacheEntry = {
    cacheKey: "zero-ttl",
    summary: "Should not store",
    ttlHours: 0,
  };

  cache = putExplanationCacheEntry(cache, entry);

  assert.strictEqual(cache["zero-ttl"], undefined);
});

test("explainability: render stage explanation", () => {
  const rendered = renderStageExplanation("stage-1", "Summary text", ["ev1", "ev2"]);

  assert.ok(rendered.includes("stage-1"));
  assert.ok(rendered.includes("Summary text"));
  assert.ok(rendered.includes("ev1"));
  assert.ok(rendered.includes("ev2"));
});

test("explainability: render with empty evidence", () => {
  const rendered = renderStageExplanation("stage-empty", "No evidence", []);

  assert.ok(rendered.includes("stage-empty"));
  assert.ok(rendered.includes("No evidence"));
});

test("explainability: generate with provided version lock ref", () => {
  const service = new ExplanationPipelineService();
  const request: ExplanationRequest = {
    taskId: "task-custom-vlock",
    stageId: "stage-vlock",
    summary: "Custom version lock",
    decision: "accept",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  };

  assert.throws(
    () => service.generate(request, "L2", {
      versionLockRef: "custom-vlock-12345",
    }),
    /explanation\.version_lock_mismatch/,
  );
});

test("explainability: generate with visibility labels", () => {
  const service = new ExplanationPipelineService();
  const request: ExplanationRequest = {
    taskId: "task-visibility",
    stageId: "stage-vis",
    summary: "Visibility test",
    decision: "accept",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  };

  const bundle = service.generate(request, "L2", {
    visibilityLabels: ["admin", "auditor", "compliance"],
  });

  assert.deepStrictEqual(bundle.rationale.visibilityLabels, ["admin", "auditor", "compliance"]);
});

test("explainability: generate with custom decision input ref", () => {
  const service = new ExplanationPipelineService();
  const request: ExplanationRequest = {
    taskId: "task-input-ref",
    stageId: "stage-input",
    summary: "Input ref test",
    decision: "retry_same_plan",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  };

  const bundle = service.generate(request, "L1", {
    decisionInputRef: "input:custom:ref:123",
  });

  assert.strictEqual(bundle.rationale.decisionInputRef, "input:custom:ref:123");
});

test("explainability: getCached returns null for miss", () => {
  const service = new ExplanationPipelineService();

  const cached = service.getCached("nonexistent:key");

  assert.strictEqual(cached, null);
});

test("explainability: getCached returns entry after generate", () => {
  const service = new ExplanationPipelineService();
  const request: ExplanationRequest = {
    taskId: "task-cache-check",
    stageId: "stage-cache",
    summary: "Cache check",
    decision: "accept",
    decisionFactors: [],
    evidence: [],
    riskNotes: [],
  };

  service.generate(request, "L2");
  const cached = service.getCached("task-cache-check:stage-cache:L2");

  assert.ok(cached !== null);
  assert.strictEqual(cached?.cacheKey, "task-cache-check:stage-cache:L2");
});
