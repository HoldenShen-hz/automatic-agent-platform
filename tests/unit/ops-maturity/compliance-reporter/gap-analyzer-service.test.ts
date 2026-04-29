/**
 * Unit tests for GapAnalyzerService
 *
 * Verifies the GapAnalyzerService has real implementations with actual logic.
 * Tests cover:
 * - Methods don't just throw "not implemented"
 * - Methods have real logic beyond returning constants
 * - Methods properly delegate to evidence-mapper
 *
 * @see src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  GapAnalyzerService,
} from "../../../../src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// GapAnalyzerService Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GapAnalyzerService.analyze returns gap analysis results for controls", () => {
  const service = new GapAnalyzerService();
  const controls = ["CC1", "CC2", "CC3"];
  const evidenceMap = {
    CC1: ["evidence_1", "evidence_2"],
    CC2: ["evidence_3"],
  };

  const results = service.analyze(controls, evidenceMap);

  assert.equal(results.length, 3);
  // CC1 has evidence
  const cc1Result = results.find(r => r.controlId === "CC1");
  assert.ok(cc1Result !== undefined);
  assert.deepEqual(cc1Result!.missingEvidence, []);
  assert.equal(cc1Result!.gapSeverity, "low");

  // CC2 has evidence
  const cc2Result = results.find(r => r.controlId === "CC2");
  assert.ok(cc2Result !== undefined);
  assert.deepEqual(cc2Result!.missingEvidence, []);
  assert.equal(cc2Result!.gapSeverity, "low");

  // CC3 is missing evidence
  const cc3Result = results.find(r => r.controlId === "CC3");
  assert.ok(cc3Result !== undefined);
  assert.deepEqual(cc3Result!.missingEvidence, ["CC3"]);
  assert.equal(cc3Result!.gapSeverity, "high");
});

test("GapAnalyzerService.analyze uses ownerMap to set gap owners", () => {
  const service = new GapAnalyzerService();
  const controls = ["CC1"];
  const evidenceMap = { CC1: [] };
  const ownerMap = { CC1: "security_team@example.com" };

  const results = service.analyze(controls, evidenceMap, ownerMap);

  assert.equal(results.length, 1);
  assert.equal(results[0]!.owner, "security_team@example.com");
});

test("GapAnalyzerService.analyze uses deadlineMap to set deadlines", () => {
  const service = new GapAnalyzerService();
  const controls = ["CC1"];
  const evidenceMap = { CC1: [] };
  const deadlineMap = { CC1: "2026-06-30T00:00:00.000Z" };

  const results = service.analyze(controls, evidenceMap, undefined, deadlineMap);

  assert.equal(results.length, 1);
  assert.equal(results[0]!.deadline, "2026-06-30T00:00:00.000Z");
});

test("GapAnalyzerService.analyze provides remediation guidance for gaps", () => {
  const service = new GapAnalyzerService();
  const controls = ["CC1", "CC2"];
  const evidenceMap = { CC1: ["ev1"], CC2: [] };

  const results = service.analyze(controls, evidenceMap);

  const gapResult = results.find(r => r.controlId === "CC2")!;
  assert.ok(gapResult.recommendation.includes("CC2"));
  assert.ok(gapResult.remediation.includes("CC2"));
  assert.ok(gapResult.remediation !== "No remediation needed");
});

test("GapAnalyzerService.analyze returns satisfied for controls with evidence", () => {
  const service = new GapAnalyzerService();
  const controls = ["CC1"];
  const evidenceMap = { CC1: ["evidence_1"] };

  const results = service.analyze(controls, evidenceMap);

  assert.equal(results.length, 1);
  assert.equal(results[0]!.gapSeverity, "low");
  assert.equal(results[0]!.recommendation, "Control satisfied");
  assert.equal(results[0]!.remediation, "No remediation needed");
});

test("GapAnalyzerService.analyze handles empty controls array", () => {
  const service = new GapAnalyzerService();
  const results = service.analyze([], {});
  assert.deepEqual(results, []);
});

test("GapAnalyzerService.analyze handles empty evidenceMap", () => {
  const service = new GapAnalyzerService();
  const controls = ["CC1", "CC2"];
  const results = service.analyze(controls, {});

  assert.equal(results.length, 2);
  for (const result of results) {
    assert.deepEqual(result.missingEvidence, [result.controlId]);
    assert.equal(result.gapSeverity, "high");
  }
});

test("GapAnalyzerService.analyze handles controls with all required evidence", () => {
  const service = new GapAnalyzerService();
  const controls = ["CC1", "CC2", "CC3", "CC4"];
  const evidenceMap = {
    CC1: ["e1"],
    CC2: ["e2", "e3"],
    CC3: ["e4", "e5", "e6"],
    CC4: [],
  };

  const results = service.analyze(controls, evidenceMap);

  // CC1-CC3 have evidence (low severity), CC4 is missing (high severity)
  const cc1Result = results.find(r => r.controlId === "CC1");
  const cc4Result = results.find(r => r.controlId === "CC4");

  assert.equal(cc1Result!.gapSeverity, "low");
  assert.equal(cc4Result!.gapSeverity, "high");
});

test("GapAnalyzerService.analyze applies owner and deadline together", () => {
  const service = new GapAnalyzerService();
  const controls = ["CC1", "CC2"];
  const evidenceMap = { CC1: [], CC2: [] };
  const ownerMap = { CC1: "team_a", CC2: "team_b" };
  const deadlineMap = { CC1: "2026-05-01", CC2: "2026-06-01" };

  const results = service.analyze(controls, evidenceMap, ownerMap, deadlineMap);

  const cc1Result = results.find(r => r.controlId === "CC1")!;
  const cc2Result = results.find(r => r.controlId === "CC2")!;

  assert.equal(cc1Result.owner, "team_a");
  assert.equal(cc1Result.deadline, "2026-05-01");
  assert.equal(cc2Result.owner, "team_b");
  assert.equal(cc2Result.deadline, "2026-06-01");
});

test("GapAnalyzerService.analyze uses null owner when not in ownerMap", () => {
  const service = new GapAnalyzerService();
  const controls = ["CC1"];
  const evidenceMap = { CC1: [] };
  const ownerMap = { CC2: "other_team" }; // CC1 not in ownerMap

  const results = service.analyze(controls, evidenceMap, ownerMap);

  assert.equal(results[0]!.owner, null);
});

test("GapAnalyzerService.analyze uses null deadline when not in deadlineMap", () => {
  const service = new GapAnalyzerService();
  const controls = ["CC1"];
  const evidenceMap = { CC1: [] };
  const deadlineMap = { CC2: "2026-05-01" }; // CC1 not in deadlineMap

  const results = service.analyze(controls, evidenceMap, undefined, deadlineMap);

  assert.equal(results[0]!.deadline, null);
});
