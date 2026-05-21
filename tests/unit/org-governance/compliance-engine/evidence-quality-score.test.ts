import assert from "node:assert/strict";
import test from "node:test";

import { EvidenceQualityScorer } from "../../../../src/org-governance/compliance-engine/evidence-quality-score.js";

test("EvidenceQualityScorer: scores evidence with all required fields", () => {
  const scorer = new EvidenceQualityScorer();

  const result = scorer.scoreEvidence({
    evidenceId: "ev_123",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: new Date().toISOString(),
    hasArtifactRef: true,
    hasContent: true,
    sourceSystem: "automated_pipeline",
    timestamp: new Date().toISOString(),
    collectedBy: "automated_system",
    relevanceScore: 0.9,
  });

  assert.equal(result.evidenceId, "ev_123");
  assert.equal(result.frameworkId, "SOC2");
  assert.equal(result.controlId, "CC1.1");
  assert.ok(result.score >= 0 && result.score <= 100);
  assert.ok(result.calculatedAt.length > 0);
  assert.ok(result.expiresAt.length > 0);
});

test("EvidenceQualityScorer: calculates completeness dimension correctly", () => {
  const scorer = new EvidenceQualityScorer();

  // All fields present = 100 completeness
  const fullResult = scorer.scoreEvidence({
    evidenceId: "ev_1",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: new Date().toISOString(),
    hasArtifactRef: true,
    hasContent: true,
    sourceSystem: "automated_pipeline",
    timestamp: new Date().toISOString(),
    collectedBy: "automated_system",
  });
  assert.equal(fullResult.dimensions.completeness, 100);

  // Only hasArtifactRef = 20
  const minimalResult = scorer.scoreEvidence({
    evidenceId: "ev_2",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: new Date().toISOString(),
    hasArtifactRef: true,
    hasContent: false,
  });
  assert.equal(minimalResult.dimensions.completeness, 20);
});

test("EvidenceQualityScorer: calculates freshness dimension correctly", () => {
  const scorer = new EvidenceQualityScorer(90);

  // Less than 30 days = 100 freshness
  const recentResult = scorer.scoreEvidence({
    evidenceId: "ev_1",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: new Date().toISOString(),
    hasArtifactRef: true,
    hasContent: true,
  });
  assert.equal(recentResult.dimensions.freshness, 100);

  // 60 days old (within threshold) should give lower score
  const olderDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const olderResult = scorer.scoreEvidence({
    evidenceId: "ev_2",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: olderDate,
    hasArtifactRef: true,
    hasContent: true,
  });
  assert.ok(olderResult.dimensions.freshness < 100);
  assert.ok(olderResult.dimensions.freshness >= 50);
});

test("EvidenceQualityScorer: calculates authenticity dimension correctly", () => {
  const scorer = new EvidenceQualityScorer();

  // Trusted source = 100
  const trustedResult = scorer.scoreEvidence({
    evidenceId: "ev_1",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: new Date().toISOString(),
    hasArtifactRef: true,
    hasContent: true,
    sourceSystem: "soc2_certified_pipeline",
  });
  assert.equal(trustedResult.dimensions.authenticity, 100);

  // Automated system collector = 90
  const automatedResult = scorer.scoreEvidence({
    evidenceId: "ev_2",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: new Date().toISOString(),
    hasArtifactRef: true,
    hasContent: true,
    collectedBy: "automated_system",
  });
  assert.equal(automatedResult.dimensions.authenticity, 90);

  // Manual collector = 70
  const manualResult = scorer.scoreEvidence({
    evidenceId: "ev_3",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: new Date().toISOString(),
    hasArtifactRef: true,
    hasContent: true,
    collectedBy: "user@example.com",
  });
  assert.equal(manualResult.dimensions.authenticity, 70);

  // No collector info = 50
  const unknownResult = scorer.scoreEvidence({
    evidenceId: "ev_4",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: new Date().toISOString(),
    hasArtifactRef: true,
    hasContent: true,
  });
  assert.equal(unknownResult.dimensions.authenticity, 50);
});

test("EvidenceQualityScorer: calculates chain of custody dimension correctly", () => {
  const scorer = new EvidenceQualityScorer();

  // Both timestamp and collector = 100
  const fullCustodyResult = scorer.scoreEvidence({
    evidenceId: "ev_1",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: new Date().toISOString(),
    hasArtifactRef: true,
    hasContent: true,
    timestamp: new Date().toISOString(),
    collectedBy: "automated_system",
  });
  assert.equal(fullCustodyResult.dimensions.chainOfCustody, 100);

  // Only timestamp = 70
  const timestampOnlyResult = scorer.scoreEvidence({
    evidenceId: "ev_2",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: new Date().toISOString(),
    hasArtifactRef: true,
    hasContent: true,
    timestamp: new Date().toISOString(),
  });
  assert.equal(timestampOnlyResult.dimensions.chainOfCustody, 70);

  // Only collector = 70
  const collectorOnlyResult = scorer.scoreEvidence({
    evidenceId: "ev_3",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: new Date().toISOString(),
    hasArtifactRef: true,
    hasContent: true,
    collectedBy: "automated_system",
  });
  assert.equal(collectorOnlyResult.dimensions.chainOfCustody, 70);

  // Neither = 30
  const noCustodyResult = scorer.scoreEvidence({
    evidenceId: "ev_4",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: new Date().toISOString(),
    hasArtifactRef: true,
    hasContent: true,
  });
  assert.equal(noCustodyResult.dimensions.chainOfCustody, 30);
});

test("EvidenceQualityScorer: uses default relevance score when not provided", () => {
  const scorer = new EvidenceQualityScorer();

  const result = scorer.scoreEvidence({
    evidenceId: "ev_1",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: new Date().toISOString(),
    hasArtifactRef: true,
    hasContent: true,
  });

  assert.equal(result.dimensions.relevance, 80);
});

test("EvidenceQualityScorer: uses provided relevance score", () => {
  const scorer = new EvidenceQualityScorer();

  const result = scorer.scoreEvidence({
    evidenceId: "ev_1",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: new Date().toISOString(),
    hasArtifactRef: true,
    hasContent: true,
    relevanceScore: 0.5,
  });

  assert.equal(result.dimensions.relevance, 50);
});

test("EvidenceQualityScorer: computes weighted overall score", () => {
  const scorer = new EvidenceQualityScorer();

  const result = scorer.scoreEvidence({
    evidenceId: "ev_1",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: new Date().toISOString(),
    hasArtifactRef: true,
    hasContent: true,
    sourceSystem: "automated_pipeline",
    timestamp: new Date().toISOString(),
    collectedBy: "automated_system",
    relevanceScore: 1.0,
  });

  // All dimensions at 100 should give score of 100
  assert.equal(result.score, 100);
});

test("EvidenceQualityScorer: freshness threshold affects freshness score", () => {
  const scorer30 = new EvidenceQualityScorer(30);
  const scorer90 = new EvidenceQualityScorer(90);

  const oldDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  const result30 = scorer30.scoreEvidence({
    evidenceId: "ev_1",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: oldDate,
    hasArtifactRef: true,
    hasContent: true,
  });

  const result90 = scorer90.scoreEvidence({
    evidenceId: "ev_2",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: oldDate,
    hasArtifactRef: true,
    hasContent: true,
  });

  // Lower threshold should result in lower freshness score
  assert.ok(result30.dimensions.freshness < result90.dimensions.freshness);
});

test("EvidenceQualityScorer: scores are rounded to integers", () => {
  const scorer = new EvidenceQualityScorer();

  const result = scorer.scoreEvidence({
    evidenceId: "ev_1",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: new Date().toISOString(),
    hasArtifactRef: true,
    hasContent: true,
    sourceSystem: "api_dashboard",
    collectedBy: "user",
    relevanceScore: 0.75,
  });

  // Score should be a rounded integer
  assert.equal(result.score, Math.round(result.score));
  assert.ok(Number.isInteger(result.score));
});

test("EvidenceQualityScorer: expiresAt is set to 30 days from calculation", () => {
  const scorer = new EvidenceQualityScorer();

  const before = Date.now();
  const result = scorer.scoreEvidence({
    evidenceId: "ev_1",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: new Date().toISOString(),
    hasArtifactRef: true,
    hasContent: true,
  });
  const after = Date.now();

  const expiresAtTime = new Date(result.expiresAt).getTime();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  // Should be approximately 30 days from now
  assert.ok(expiresAtTime >= before + thirtyDaysMs - 1000);
  assert.ok(expiresAtTime <= after + thirtyDaysMs + 1000);
});

test("EvidenceQualityScorer: handles case-insensitive trusted source matching", () => {
  const scorer = new EvidenceQualityScorer();

  const result1 = scorer.scoreEvidence({
    evidenceId: "ev_1",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: new Date().toISOString(),
    hasArtifactRef: true,
    hasContent: true,
    sourceSystem: "AUTOMATED_PIPELINE",
  });

  const result2 = scorer.scoreEvidence({
    evidenceId: "ev_2",
    frameworkId: "SOC2",
    controlId: "CC1.1",
    collectedAt: new Date().toISOString(),
    hasArtifactRef: true,
    hasContent: true,
    sourceSystem: "automated_pipeline",
  });

  // Both should have authenticity 100 due to case-insensitive matching
  assert.equal(result1.dimensions.authenticity, 100);
  assert.equal(result2.dimensions.authenticity, 100);
});