/**
 * Extended unit tests for Compliance Report Pipeline Service
 *
 * @see src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { ComplianceReportPipelineService } from "../../../../src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.js";
import type { ComplianceReportRequest, ComplianceReportArtifact } from "../../../../src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.js";

describe("ComplianceReportPipelineService", () => {
  describe("generate", () => {
    test("generates report with complete evidence", () => {
      const service = new ComplianceReportPipelineService([
        {
          templateId: "soc2-audit",
          framework: "SOC2",
          reportType: "audit",
          requiredEvidenceTypes: ["access_log", "config_snapshot"],
          renderSchema: ["template", "evidence_coverage", "completeness"],
          version: "1.0",
        },
      ]);

      const request: ComplianceReportRequest = {
        templateId: "soc2-audit",
        evidence: [
          { evidenceId: "e1", evidenceType: "access_log" },
          { evidenceId: "e2", evidenceType: "access_log" },
          { evidenceId: "e3", evidenceType: "config_snapshot" },
        ],
        requestedBy: "admin@example.com",
      };

      const artifact = service.generate(request);

      assert.equal(artifact.templateId, "soc2-audit");
      assert.equal(artifact.framework, "SOC2");
      assert.equal(artifact.reportType, "audit");
      assert.equal(artifact.status, "generated");
      assert.equal(artifact.missingEvidenceTypes.length, 0);
      assert.equal(artifact.evidenceQualityScore, 100);
      assert.deepEqual(artifact.evidenceMap["access_log"], ["e1", "e2"]);
      assert.deepEqual(artifact.evidenceMap["config_snapshot"], ["e3"]);
    });

    test("generates report with partial evidence", () => {
      const service = new ComplianceReportPipelineService([
        {
          templateId: "iso27001-review",
          framework: "ISO27001",
          reportType: "review",
          requiredEvidenceTypes: ["access_log", "config_snapshot", "metrics"],
          renderSchema: ["template", "evidence_coverage", "completeness"],
          version: "1.0",
        },
      ]);

      const request: ComplianceReportRequest = {
        templateId: "iso27001-review",
        evidence: [
          { evidenceId: "e1", evidenceType: "access_log" },
        ],
        requestedBy: "auditor@example.com",
      };

      const artifact = service.generate(request);

      assert.equal(artifact.status, "partial");
      assert.deepEqual(artifact.missingEvidenceTypes, ["config_snapshot", "metrics"]);
      assert.equal(artifact.evidenceQualityScore, 33);
    });

    test("throws for unknown template", () => {
      const service = new ComplianceReportPipelineService([]);

      const request: ComplianceReportRequest = {
        templateId: "unknown-template",
        evidence: [],
        requestedBy: "admin@example.com",
      };

      assert.throws(
        () => service.generate(request),
        /compliance_report.template_not_found/,
      );
    });

    test("uses custom generatedAt when provided", () => {
      const service = new ComplianceReportPipelineService([
        {
          templateId: "test-template",
          framework: "Test",
          reportType: "test",
          requiredEvidenceTypes: [],
          renderSchema: [],
          version: "1.0",
        },
      ]);

      const customDate = "2026-01-15T10:00:00Z";
      const request: ComplianceReportRequest = {
        templateId: "test-template",
        evidence: [],
        requestedBy: "admin@example.com",
        generatedAt: customDate,
      };

      const artifact = service.generate(request);

      assert.equal(artifact.generatedAt, customDate);
      assert.equal(artifact.generatedBy, "admin@example.com");
    });
  });

  describe("recordReadAccess", () => {
    test("records read access for artifact", () => {
      const service = new ComplianceReportPipelineService([
        {
          templateId: "test-template",
          framework: "Test",
          reportType: "test",
          requiredEvidenceTypes: [],
          renderSchema: [],
          version: "1.0",
        },
      ]);

      const artifact = service.generate({
        templateId: "test-template",
        evidence: [],
        requestedBy: "admin@example.com",
      });

      const receipt = service.recordReadAccess(artifact, "viewer@example.com");

      assert.equal(receipt.artifactId, artifact.artifactId);
      assert.equal(receipt.accessorId, "viewer@example.com");
      assert.equal(receipt.accessMode, "read_only");
    });

    test("records multiple read accesses", () => {
      const service = new ComplianceReportPipelineService([
        {
          templateId: "test-template",
          framework: "Test",
          reportType: "test",
          requiredEvidenceTypes: [],
          renderSchema: [],
          version: "1.0",
        },
      ]);

      const artifact = service.generate({
        templateId: "test-template",
        evidence: [],
        requestedBy: "admin@example.com",
      });

      service.recordReadAccess(artifact, "viewer1@example.com");
      service.recordReadAccess(artifact, "viewer2@example.com");

      const log = service.getAccessLog(artifact.artifactId);

      assert.equal(log.length, 2);
      assert.equal(log[0]!.accessorId, "viewer1@example.com");
      assert.equal(log[1]!.accessorId, "viewer2@example.com");
    });

    test("uses custom accessedAt when provided", () => {
      const service = new ComplianceReportPipelineService([
        {
          templateId: "test-template",
          framework: "Test",
          reportType: "test",
          requiredEvidenceTypes: [],
          renderSchema: [],
          version: "1.0",
        },
      ]);

      const artifact = service.generate({
        templateId: "test-template",
        evidence: [],
        requestedBy: "admin@example.com",
      });

      const customDate = "2026-02-20T15:30:00Z";
      const receipt = service.recordReadAccess(artifact, "viewer@example.com", customDate);

      assert.equal(receipt.accessedAt, customDate);
    });
  });

  describe("getAccessLog", () => {
    test("returns empty array for unknown artifact", () => {
      const service = new ComplianceReportPipelineService([]);

      const log = service.getAccessLog("unknown-artifact-id");

      assert.deepEqual(log, []);
    });

    test("returns access log for known artifact", () => {
      const service = new ComplianceReportPipelineService([
        {
          templateId: "test-template",
          framework: "Test",
          reportType: "test",
          requiredEvidenceTypes: [],
          renderSchema: [],
          version: "1.0",
        },
      ]);

      const artifact = service.generate({
        templateId: "test-template",
        evidence: [],
        requestedBy: "admin@example.com",
      });

      service.recordReadAccess(artifact, "viewer@example.com");

      const log = service.getAccessLog(artifact.artifactId);

      assert.equal(log.length, 1);
      assert.equal(log[0]!.accessorId, "viewer@example.com");
    });

    test("returns new array copy each time", () => {
      const service = new ComplianceReportPipelineService([
        {
          templateId: "test-template",
          framework: "Test",
          reportType: "test",
          requiredEvidenceTypes: [],
          renderSchema: [],
          version: "1.0",
        },
      ]);

      const artifact = service.generate({
        templateId: "test-template",
        evidence: [],
        requestedBy: "admin@example.com",
      });

      service.recordReadAccess(artifact, "viewer@example.com");

      const log1 = service.getAccessLog(artifact.artifactId);
      const log2 = service.getAccessLog(artifact.artifactId);

      assert.equal(log1.length, 1);
      assert.equal(log2.length, 1);
      // Both should be independent copies
      log1.push({} as any);
      assert.equal(log2.length, 1);
    });
  });

  describe("evidence mapping", () => {
    test("maps multiple evidence types correctly", () => {
      const service = new ComplianceReportPipelineService([
        {
          templateId: "multi-evidence",
          framework: "Test",
          reportType: "test",
          requiredEvidenceTypes: ["type_a", "type_b", "type_c"],
          renderSchema: [],
          version: "1.0",
        },
      ]);

      const artifact = service.generate({
        templateId: "multi-evidence",
        evidence: [
          { evidenceId: "a1", evidenceType: "type_a" },
          { evidenceId: "a2", evidenceType: "type_a" },
          { evidenceId: "b1", evidenceType: "type_b" },
          { evidenceId: "c1", evidenceType: "type_c" },
          { evidenceId: "c2", evidenceType: "type_c" },
          { evidenceId: "c3", evidenceType: "type_c" },
        ],
        requestedBy: "admin@example.com",
      });

      assert.equal(artifact.evidenceMap["type_a"]?.length, 2);
      assert.equal(artifact.evidenceMap["type_b"]?.length, 1);
      assert.equal(artifact.evidenceMap["type_c"]?.length, 3);
    });

    test("handles empty evidence array", () => {
      const service = new ComplianceReportPipelineService([
        {
          templateId: "empty-evidence",
          framework: "Test",
          reportType: "test",
          requiredEvidenceTypes: ["type_a"],
          renderSchema: [],
          version: "1.0",
        },
      ]);

      const artifact = service.generate({
        templateId: "empty-evidence",
        evidence: [],
        requestedBy: "admin@example.com",
      });

      assert.equal(artifact.status, "partial");
      assert.deepEqual(artifact.missingEvidenceTypes, ["type_a"]);
      assert.deepEqual(artifact.evidenceMap["type_a"], undefined);
    });
  });

  describe("markdown rendering", () => {
    test("generates markdown with all sections", () => {
      const service = new ComplianceReportPipelineService([
        {
          templateId: "markdown-test",
          framework: "TestFramework",
          reportType: "MarkdownTest",
          requiredEvidenceTypes: ["evidence_type_1"],
          renderSchema: ["template", "evidence_coverage", "completeness"],
          version: "2.0",
        },
      ]);

      const artifact = service.generate({
        templateId: "markdown-test",
        evidence: [
          { evidenceId: "ev1", evidenceType: "evidence_type_1" },
        ],
        requestedBy: "admin@example.com",
      });

      assert.ok(artifact.markdown.includes("TestFramework"));
      assert.ok(artifact.markdown.includes("MarkdownTest"));
      assert.ok(artifact.markdown.includes("template_id=markdown-test"));
      assert.ok(artifact.markdown.includes("framework=TestFramework"));
      assert.ok(artifact.markdown.includes("version=2.0"));
    });

    test("marks missing evidence in markdown", () => {
      const service = new ComplianceReportPipelineService([
        {
          templateId: "missing-test",
          framework: "Test",
          reportType: "MissingTest",
          requiredEvidenceTypes: ["required_type"],
          renderSchema: [],
          version: "1.0",
        },
      ]);

      const artifact = service.generate({
        templateId: "missing-test",
        evidence: [],
        requestedBy: "admin@example.com",
      });

      assert.ok(artifact.markdown.includes("MISSING"));
      assert.ok(artifact.markdown.includes("coverage_ratio="));
    });
  });

  describe("coverage ratio", () => {
    test("calculates 100% coverage correctly", () => {
      const service = new ComplianceReportPipelineService([
        {
          templateId: "full-coverage",
          framework: "Test",
          reportType: "FullCoverage",
          requiredEvidenceTypes: ["type_a", "type_b"],
          renderSchema: [],
          version: "1.0",
        },
      ]);

      const artifact = service.generate({
        templateId: "full-coverage",
        evidence: [
          { evidenceId: "a1", evidenceType: "type_a" },
          { evidenceId: "b1", evidenceType: "type_b" },
        ],
        requestedBy: "admin@example.com",
      });

      assert.equal(artifact.status, "generated");
      assert.equal(artifact.evidenceQualityScore, 100);
      assert.ok(artifact.markdown.includes("coverage_ratio=1"));
    });

    test("calculates 0% coverage correctly", () => {
      const service = new ComplianceReportPipelineService([
        {
          templateId: "no-coverage",
          framework: "Test",
          reportType: "NoCoverage",
          requiredEvidenceTypes: ["type_a", "type_b"],
          renderSchema: [],
          version: "1.0",
        },
      ]);

      const artifact = service.generate({
        templateId: "no-coverage",
        evidence: [],
        requestedBy: "admin@example.com",
      });

      assert.equal(artifact.status, "partial");
      assert.equal(artifact.evidenceQualityScore, 0);
      assert.ok(artifact.markdown.includes("coverage_ratio=0"));
    });

    test("calculates partial coverage correctly", () => {
      const service = new ComplianceReportPipelineService([
        {
          templateId: "partial-coverage",
          framework: "Test",
          reportType: "PartialCoverage",
          requiredEvidenceTypes: ["type_a", "type_b", "type_c", "type_d"],
          renderSchema: [],
          version: "1.0",
        },
      ]);

      const artifact = service.generate({
        templateId: "partial-coverage",
        evidence: [
          { evidenceId: "a1", evidenceType: "type_a" },
          { evidenceId: "b1", evidenceType: "type_b" },
        ],
        requestedBy: "admin@example.com",
      });

      assert.equal(artifact.status, "partial");
      assert.equal(artifact.evidenceQualityScore, 50);
      // 2 out of 4 = 0.50
      assert.ok(artifact.markdown.includes("coverage_ratio=0.50"));
    });
  });
});
