import assert from "node:assert/strict";
import test from "node:test";

import { ComplianceReportPipelineService } from "../../../src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.js";

test("ComplianceReportPipelineService marks reports partial when required evidence is missing", () => {
  const service = new ComplianceReportPipelineService([
    {
      templateId: "soc2_monthly",
      framework: "SOC2",
      reportType: "monthly",
      requiredEvidenceTypes: ["audit_log", "control_test"],
      renderSchema: ["Template", "Evidence Coverage", "Completeness"],
      version: "2.0",
    },
  ]);

  const artifact = service.generate({
    templateId: "soc2_monthly",
    evidence: [{ evidenceId: "ev_audit_1", evidenceType: "audit_log" }],
    requestedBy: "auditor_1",
    generatedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(artifact.status, "partial");
  assert.deepEqual(artifact.missingEvidenceTypes, ["control_test"]);
  assert.match(artifact.markdown, /control_test: MISSING/);
  assert.equal(artifact.readOnly, true);

  const accessReceipt = service.recordReadAccess(artifact, "auditor_1", "2026-04-20T00:05:00.000Z");
  assert.equal(accessReceipt.accessMode, "read_only");
  assert.equal(service.getAccessLog(artifact.artifactId).length, 1);
});

test("ComplianceReportPipelineService marks reports complete when all evidence exists", () => {
  const service = new ComplianceReportPipelineService([
    {
      templateId: "iso27001_quarterly",
      framework: "ISO27001",
      reportType: "quarterly",
      requiredEvidenceTypes: ["audit_log", "control_test"],
      renderSchema: ["Template", "Evidence Coverage", "Completeness"],
      version: "1.1",
    },
  ]);

  const artifact = service.generate({
    templateId: "iso27001_quarterly",
    evidence: [
      { evidenceId: "ev_audit_1", evidenceType: "audit_log" },
      { evidenceId: "ev_control_1", evidenceType: "control_test" },
    ],
    requestedBy: "auditor_2",
  });

  assert.equal(artifact.status, "complete");
  assert.deepEqual(artifact.missingEvidenceTypes, []);
});
