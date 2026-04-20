import assert from "node:assert/strict";
import test from "node:test";

import { ComplianceReportPipelineService } from "../../../src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.js";

test("integration: evidence store style inputs produce a readonly compliance artifact with explicit gaps", () => {
  const service = new ComplianceReportPipelineService([
    {
      templateId: "soc2_monthly",
      framework: "SOC2",
      reportType: "monthly",
      requiredEvidenceTypes: ["audit_log", "control_test", "approval_record"],
      renderSchema: ["Template", "Evidence Coverage", "Completeness"],
      version: "2.0",
    },
  ]);

  const artifact = service.generate({
    templateId: "soc2_monthly",
    evidence: [
      { evidenceId: "audit_1", evidenceType: "audit_log" },
      { evidenceId: "approval_1", evidenceType: "approval_record" },
    ],
    requestedBy: "auditor_1",
    generatedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(artifact.status, "partial");
  assert.deepEqual(artifact.missingEvidenceTypes, ["control_test"]);
  assert.match(artifact.markdown, /Gap: missing required evidence type control_test/);
  assert.equal(service.recordReadAccess(artifact, "auditor_1").accessMode, "read_only");
});
