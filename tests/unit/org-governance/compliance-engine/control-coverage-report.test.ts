import assert from "node:assert/strict";
import test from "node:test";

import { ControlCoverageAnalyzer } from "../../../../src/org-governance/compliance-engine/control-coverage-report.js";

test("ControlCoverageAnalyzer: generates report with covered controls", () => {
  const analyzer = new ControlCoverageAnalyzer();

  const report = analyzer.generateReport({
    frameworkId: "SOC2",
    periodStart: "2026-01-01T00:00:00Z",
    periodEnd: "2026-03-31T23:59:59Z",
    controlDefinitions: [
      { controlId: "CC1.1", controlName: "Control 1", category: "logical" },
      { controlId: "CC1.2", controlName: "Control 2", category: "logical" },
    ],
    evidenceRecords: [
      {
        evidenceId: "ev_1",
        frameworkId: "SOC2",
        controlId: "CC1.1",
        collectedAt: "2026-02-15T00:00:00Z",
        source: "automated_pipeline",
        qualityScore: 85,
      },
      {
        evidenceId: "ev_2",
        frameworkId: "SOC2",
        controlId: "CC1.2",
        collectedAt: "2026-02-20T00:00:00Z",
        source: "api_dashboard",
        qualityScore: 75,
      },
    ],
  });

  assert.equal(report.frameworkId, "SOC2");
  assert.equal(report.summary.totalControls, 2);
  assert.equal(report.summary.coveredControls, 2);
  assert.equal(report.summary.partialControls, 0);
  assert.equal(report.summary.uncoveredControls, 0);
  assert.equal(report.summary.coveragePercentage, 100);
  assert.equal(report.summary.evidenceCount, 2);
});

test("ControlCoverageAnalyzer: generates report with uncovered controls", () => {
  const analyzer = new ControlCoverageAnalyzer();

  const report = analyzer.generateReport({
    frameworkId: "GDPR",
    periodStart: "2026-01-01T00:00:00Z",
    periodEnd: "2026-03-31T23:59:59Z",
    controlDefinitions: [
      { controlId: "data_retention", controlName: "Data Retention Control", category: "data_protection" },
      { controlId: "consent_mgmt", controlName: "Consent Management", category: "data_protection" },
    ],
    evidenceRecords: [
      {
        evidenceId: "ev_1",
        frameworkId: "GDPR",
        controlId: "data_retention",
        collectedAt: "2026-02-15T00:00:00Z",
        source: "automated_pipeline",
        qualityScore: 90,
      },
    ],
  });

  assert.equal(report.summary.totalControls, 2);
  assert.equal(report.summary.coveredControls, 1);
  assert.equal(report.summary.uncoveredControls, 1);
  assert.ok(report.gaps.length > 0);
  const uncoveredGap = report.gaps.find((g) => g.controlId === "consent_mgmt");
  assert.ok(uncoveredGap !== undefined);
  assert.equal(uncoveredGap!.gapSeverity, "high");
});

test("ControlCoverageAnalyzer: generates report with partial coverage when quality is low", () => {
  const analyzer = new ControlCoverageAnalyzer();

  const report = analyzer.generateReport({
    frameworkId: "ISO27001",
    periodStart: "2026-01-01T00:00:00Z",
    periodEnd: "2026-03-31T23:59:59Z",
    controlDefinitions: [
      { controlId: "access_control", controlName: "Access Control", category: "security" },
    ],
    evidenceRecords: [
      {
        evidenceId: "ev_1",
        frameworkId: "ISO27001",
        controlId: "access_control",
        collectedAt: "2026-02-15T00:00:00Z",
        source: "manual_process",
        qualityScore: 40,
      },
    ],
  });

  assert.equal(report.summary.totalControls, 1);
  assert.equal(report.summary.partialControls, 1);
  assert.ok(report.gaps.length > 0);
  const partialGap = report.gaps[0];
  assert.ok(partialGap != null);
  assert.equal(partialGap.gapSeverity, "medium");
  assert.ok(partialGap.description.includes("quality below threshold"));
});

test("ControlCoverageAnalyzer: calculates average evidence quality correctly", () => {
  const analyzer = new ControlCoverageAnalyzer();

  const report = analyzer.generateReport({
    frameworkId: "HIPAA",
    periodStart: "2026-01-01T00:00:00Z",
    periodEnd: "2026-03-31T23:59:59Z",
    controlDefinitions: [
      { controlId: "encryption", controlName: "Encryption Control", category: "technical" },
    ],
    evidenceRecords: [
      {
        evidenceId: "ev_1",
        frameworkId: "HIPAA",
        controlId: "encryption",
        collectedAt: "2026-02-15T00:00:00Z",
        source: "automated_pipeline",
        qualityScore: 80,
      },
      {
        evidenceId: "ev_2",
        frameworkId: "HIPAA",
        controlId: "encryption",
        collectedAt: "2026-02-20T00:00:00Z",
        source: "api_dashboard",
        qualityScore: 60,
      },
    ],
  });

  assert.equal(report.summary.averageEvidenceQuality, 70);
});

test("ControlCoverageAnalyzer: handles controls with no evidence", () => {
  const analyzer = new ControlCoverageAnalyzer();

  const report = analyzer.generateReport({
    frameworkId: "PCI DSS",
    periodStart: "2026-01-01T00:00:00Z",
    periodEnd: "2026-03-31T23:59:59Z",
    controlDefinitions: [
      { controlId: "network_security", controlName: "Network Security", category: "network" },
    ],
    evidenceRecords: [],
  });

  assert.equal(report.summary.totalControls, 1);
  assert.equal(report.summary.coveredControls, 0);
  assert.equal(report.summary.uncoveredControls, 1);
  assert.ok(report.gaps.length === 1);
  assert.ok(report.gaps[0] != null);
  assert.equal(report.gaps[0].controlId, "network_security");
  assert.equal(report.gaps[0].gapSeverity, "high");
  assert.ok(report.gaps[0].estimatedEffortHours === 4);
});

test("ControlCoverageAnalyzer: returns correct last evidence collected timestamp", () => {
  const analyzer = new ControlCoverageAnalyzer();

  const report = analyzer.generateReport({
    frameworkId: "SOC2",
    periodStart: "2026-01-01T00:00:00Z",
    periodEnd: "2026-03-31T23:59:59Z",
    controlDefinitions: [
      { controlId: "CC2.1", controlName: "Control 2.1", category: "control_environment" },
    ],
    evidenceRecords: [
      {
        evidenceId: "ev_old",
        frameworkId: "SOC2",
        controlId: "CC2.1",
        collectedAt: "2026-01-15T00:00:00Z",
        source: "api_dashboard",
        qualityScore: 70,
      },
      {
        evidenceId: "ev_new",
        frameworkId: "SOC2",
        controlId: "CC2.1",
        collectedAt: "2026-03-01T00:00:00Z",
        source: "automated_pipeline",
        qualityScore: 85,
      },
    ],
  });

  const controlDetail = report.controls[0];
  assert.ok(controlDetail != null);
  assert.equal(controlDetail.lastEvidenceCollectedAt, "2026-03-01T00:00:00Z");
});

test("ControlCoverageAnalyzer: calculates coverage percentage correctly", () => {
  const analyzer = new ControlCoverageAnalyzer();

  const report = analyzer.generateReport({
    frameworkId: "NIST",
    periodStart: "2026-01-01T00:00:00Z",
    periodEnd: "2026-03-31T23:59:59Z",
    controlDefinitions: [
      { controlId: "ac_1", controlName: "Access Control 1", category: "access" },
      { controlId: "ac_2", controlName: "Access Control 2", category: "access" },
      { controlId: "ac_3", controlName: "Access Control 3", category: "access" },
      { controlId: "ac_4", controlName: "Access Control 4", category: "access" },
    ],
    evidenceRecords: [
      {
        evidenceId: "ev_1",
        frameworkId: "NIST",
        controlId: "ac_1",
        collectedAt: "2026-02-15T00:00:00Z",
        source: "automated_pipeline",
        qualityScore: 80,
      },
      {
        evidenceId: "ev_2",
        frameworkId: "NIST",
        controlId: "ac_2",
        collectedAt: "2026-02-15T00:00:00Z",
        source: "automated_pipeline",
        qualityScore: 80,
      },
    ],
  });

  assert.equal(report.summary.totalControls, 4);
  assert.equal(report.summary.coveredControls, 2);
  assert.equal(report.summary.coveragePercentage, 50);
});

test("ControlCoverageAnalyzer: filters evidence by framework correctly", () => {
  const analyzer = new ControlCoverageAnalyzer();

  const report = analyzer.generateReport({
    frameworkId: "SOC2",
    periodStart: "2026-01-01T00:00:00Z",
    periodEnd: "2026-03-31T23:59:59Z",
    controlDefinitions: [
      { controlId: "CC1.1", controlName: "Control 1.1", category: "logical" },
    ],
    evidenceRecords: [
      {
        evidenceId: "ev_1",
        frameworkId: "SOC2",
        controlId: "CC1.1",
        collectedAt: "2026-02-15T00:00:00Z",
        source: "automated_pipeline",
        qualityScore: 80,
      },
      {
        evidenceId: "ev_2",
        frameworkId: "GDPR",
        controlId: "CC1.1",
        collectedAt: "2026-02-15T00:00:00Z",
        source: "automated_pipeline",
        qualityScore: 90,
      },
    ],
  });

  const controlDetail = report.controls[0];
  assert.ok(controlDetail != null);
  assert.equal(controlDetail.evidenceIds.length, 1);
  assert.equal(controlDetail.evidenceIds[0], "ev_1");
});

test("ControlCoverageAnalyzer: handles empty control definitions", () => {
  const analyzer = new ControlCoverageAnalyzer();

  const report = analyzer.generateReport({
    frameworkId: "EMPTY",
    periodStart: "2026-01-01T00:00:00Z",
    periodEnd: "2026-03-31T23:59:59Z",
    controlDefinitions: [],
    evidenceRecords: [],
  });

  assert.equal(report.summary.totalControls, 0);
  assert.equal(report.summary.coveredControls, 0);
  assert.equal(report.summary.coveragePercentage, 0);
  assert.equal(report.controls.length, 0);
  assert.equal(report.gaps.length, 0);
});

test("ControlCoverageAnalyzer: report contains period information", () => {
  const analyzer = new ControlCoverageAnalyzer();

  const report = analyzer.generateReport({
    frameworkId: "SOC2",
    periodStart: "2026-01-01T00:00:00Z",
    periodEnd: "2026-03-31T23:59:59Z",
    controlDefinitions: [],
    evidenceRecords: [],
  });

  assert.equal(report.periodStart, "2026-01-01T00:00:00Z");
  assert.equal(report.periodEnd, "2026-03-31T23:59:59Z");
  assert.ok(report.generatedAt.length > 0);
  assert.ok(report.reportId.startsWith("control_coverage_SOC2_"));
});

test("ControlCoverageAnalyzer: control detail contains all required fields", () => {
  const analyzer = new ControlCoverageAnalyzer();

  const report = analyzer.generateReport({
    frameworkId: "ISO27001",
    periodStart: "2026-01-01T00:00:00Z",
    periodEnd: "2026-03-31T23:59:59Z",
    controlDefinitions: [
      {
        controlId: "A.5.1.1",
        controlName: "Policies for information security",
        category: "organizational",
        requiredEvidenceTypes: ["policy_document", "approval_record"],
      },
    ],
    evidenceRecords: [
      {
        evidenceId: "ev_1",
        frameworkId: "ISO27001",
        controlId: "A.5.1.1",
        collectedAt: "2026-02-15T00:00:00Z",
        source: "automated_pipeline",
        qualityScore: 95,
      },
    ],
  });

  const detail = report.controls[0];
  assert.ok(detail != null);
  assert.equal(detail.controlId, "A.5.1.1");
  assert.equal(detail.controlName, "Policies for information security");
  assert.equal(detail.category, "organizational");
  assert.equal(detail.coverageStatus, "covered");
  assert.deepEqual(detail.notes, []);
});
