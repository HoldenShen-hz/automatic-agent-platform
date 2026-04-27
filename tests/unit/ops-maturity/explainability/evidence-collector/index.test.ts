import assert from "node:assert/strict";
import test from "node:test";

import {
  ExplanationEvidence,
  collectExplanationEvidenceIds,
  collectExplanationEvidence,
  type ExplanationEvidenceBundle,
} from "../../../../../src/ops-maturity/explainability/evidence-collector/index.js";

test("collectExplanationEvidenceIds returns array of evidence IDs", () => {
  const evidence: ExplanationEvidence[] = [
    { evidenceId: "e1", category: "log" },
    { evidenceId: "e2", category: "metric" },
    { evidenceId: "e3", category: "log" },
  ];

  const ids = collectExplanationEvidenceIds(evidence);

  assert.deepEqual(ids, ["e1", "e2", "e3"]);
});

test("collectExplanationEvidenceIds handles empty array", () => {
  const ids = collectExplanationEvidenceIds([]);
  assert.deepEqual(ids, []);
});

test("collectExplanationEvidence creates bundle with IDs and grouped categories", () => {
  const evidence: ExplanationEvidence[] = [
    { evidenceId: "e1", category: "log", sourceRef: "log-1" },
    { evidenceId: "e2", category: "metric", sourceRef: "metric-1" },
    { evidenceId: "e3", category: "log", sourceRef: "log-2" },
  ];

  const bundle = collectExplanationEvidence(evidence);

  assert.deepEqual(bundle.evidenceIds, ["e1", "e2", "e3"]);
  assert.deepEqual(bundle.groupedByCategory["log"], [evidence[0], evidence[2]]);
  assert.deepEqual(bundle.groupedByCategory["metric"], [evidence[1]]);
});

test("collectExplanationEvidence handles empty array", () => {
  const bundle = collectExplanationEvidence([]);

  assert.deepEqual(bundle.evidenceIds, []);
  assert.deepEqual(Object.keys(bundle.groupedByCategory), []);
});

test("collectExplanationEvidence groups by category correctly", () => {
  const evidence: ExplanationEvidence[] = [
    { evidenceId: "a1", category: "alpha" },
    { evidenceId: "b1", category: "beta" },
    { evidenceId: "a2", category: "alpha" },
    { evidenceId: "b2", category: "beta" },
    { evidenceId: "b3", category: "beta" },
  ];

  const bundle = collectExplanationEvidence(evidence);

  assert.equal(bundle.groupedByCategory["alpha"].length, 2);
  assert.equal(bundle.groupedByCategory["beta"].length, 3);
  assert.equal(bundle.evidenceIds.length, 5);
});

test("collectExplanationEvidence preserves evidence with optional fields", () => {
  const evidence: ExplanationEvidence[] = [
    { evidenceId: "e1", category: "log", sourceRef: "log-1", excerpt: "Error occurred" },
    { evidenceId: "e2", category: "log" }, // no optional fields
  ];

  const bundle = collectExplanationEvidence(evidence);

  assert.equal(bundle.groupedByCategory["log"].length, 2);
  assert.equal(bundle.groupedByCategory["log"][0].excerpt, "Error occurred");
  assert.equal(bundle.groupedByCategory["log"][1].sourceRef, undefined);
});

test("ExplanationEvidenceBundle has correct structure", () => {
  const evidence: ExplanationEvidence[] = [
    { evidenceId: "e1", category: "test" },
  ];

  const bundle: ExplanationEvidenceBundle = collectExplanationEvidence(evidence);

  assert.ok("evidenceIds" in bundle);
  assert.ok("groupedByCategory" in bundle);
  assert.ok(Array.isArray(bundle.evidenceIds));
  assert.ok(typeof bundle.groupedByCategory === "object");
});
