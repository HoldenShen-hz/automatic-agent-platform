import assert from "node:assert/strict";
import test from "node:test";

import type {
  ComplianceProgramInput,
  ComplianceResidencySummary,
  ComplianceProgramReport,
  ComplianceProgramExportResult,
  ComplianceProgramServiceOptions,
} from "../../../../src/scale-ecosystem/marketplace/compliance-program-service.js";
import type { ArtifactRef, DataNamespaceRecord } from "../../../../src/platform/contracts/types/domain.js";

test("ComplianceProgramInput structure is correct", () => {
  const input: ComplianceProgramInput = {
    generatedAt: "2026-04-14T12:00:00.000Z",
  };

  assert.equal(input.generatedAt, "2026-04-14T12:00:00.000Z");
});

test("ComplianceProgramInput allows empty input", () => {
  const input: ComplianceProgramInput = {};
  assert.equal(input.generatedAt, undefined);
});

test("ComplianceResidencySummary structure is correct", () => {
  const summary: ComplianceResidencySummary = {
    residencyPolicy: "us-east",
    namespaceCount: 10,
  };

  assert.equal(summary.residencyPolicy, "us-east");
  assert.equal(summary.namespaceCount, 10);
});

test("ComplianceProgramReport structure is correct", () => {
  const report: ComplianceProgramReport = {
    reportId: "report_123",
    generatedAt: "2026-04-14T00:00:00.000Z",
    tenantCount: 50,
    workspaceCount: 200,
    organizationCount: 25,
    namespaceCount: 500,
    residencySummary: [
      { residencyPolicy: "us-east", namespaceCount: 300 },
      { residencyPolicy: "eu-west", namespaceCount: 200 },
    ],
    auditExportReady: true,
    complianceControls: ["CC1", "CC2", "CC3"],
  };

  assert.equal(report.reportId, "report_123");
  assert.equal(report.tenantCount, 50);
  assert.equal(report.namespaceCount, 500);
  assert.equal(report.auditExportReady, true);
  assert.equal(report.complianceControls.length, 3);
});

test("ComplianceProgramReport allows empty residency summary", () => {
  const report: ComplianceProgramReport = {
    reportId: "report_empty",
    generatedAt: "2026-04-14T00:00:00.000Z",
    tenantCount: 0,
    workspaceCount: 0,
    organizationCount: 0,
    namespaceCount: 0,
    residencySummary: [],
    auditExportReady: false,
    complianceControls: [],
  };

  assert.equal(report.residencySummary.length, 0);
  assert.equal(report.auditExportReady, false);
});

test("ComplianceProgramExportResult structure is correct", () => {
  const result: ComplianceProgramExportResult = {
    report: {
      reportId: "report_export",
      generatedAt: "2026-04-14T00:00:00.000Z",
      tenantCount: 10,
      workspaceCount: 50,
      organizationCount: 5,
      namespaceCount: 100,
      residencySummary: [],
      auditExportReady: true,
      complianceControls: ["CC1"],
    },
    jsonArtifact: {
      artifactId: "art_json",
      kind: "json",
      uri: "file:///artifacts/compliance-report.json",
      mimeType: "application/json",
      sizeBytes: 2048,
      createdAt: "2026-04-14T00:00:00.000Z",
    } as unknown as ArtifactRef,
    markdownArtifact: {
      artifactId: "art_md",
      kind: "markdown",
      uri: "file:///artifacts/compliance-report.md",
      mimeType: "text/markdown",
      sizeBytes: 1024,
      createdAt: "2026-04-14T00:00:00.000Z",
    } as unknown as ArtifactRef,
  };

  assert.equal(result.report.reportId, "report_export");
  assert.equal(result.jsonArtifact.artifactId, "art_json");
  assert.equal(result.markdownArtifact.artifactId, "art_md");
});

test("ComplianceProgramServiceOptions structure is correct", () => {
  const options: ComplianceProgramServiceOptions = {
    artifactStoreOptions: {
      rootDir: "/var/compliance/artifacts",
    },
  };

  assert.ok(options.artifactStoreOptions !== undefined);
  assert.equal(options.artifactStoreOptions?.rootDir, "/var/compliance/artifacts");
});

test("ComplianceProgramServiceOptions allows empty options", () => {
  const options: ComplianceProgramServiceOptions = {};
  assert.equal(options.artifactStoreOptions, undefined);
});
