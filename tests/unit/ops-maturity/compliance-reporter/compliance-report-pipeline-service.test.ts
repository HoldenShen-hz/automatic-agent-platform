/**
 * Unit tests for ComplianceReportPipelineService
 *
 * @see src/ops-maturity/compliance-reporter/compliance-report-pipeline-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ComplianceReportRendererService,
  ComplianceReportPipelineService,
  ComplianceTemplateRegistryService,
  EvidenceMapperService,
  type ComplianceReportRequest,
  type ComplianceReportTemplateDefinition,
  type EvidenceReference,
} from "../../../../src/ops-maturity/compliance-reporter/index.js";

function createTestTemplates(): readonly ComplianceReportTemplateDefinition[] {
  return [
    {
      templateId: "soc2-type2",
      framework: "SOC2",
      reportType: "Type II",
      requiredEvidenceTypes: ["access_log", "change_record", "incident_log"],
      renderSchema: ["template", "evidence_coverage", "completeness"],
      version: "1.0",
    },
    {
      templateId: "gdpr-data-processing",
      framework: "GDPR",
      reportType: "Data Processing",
      requiredEvidenceTypes: ["consent_record", "erasure_request", "data_mapping"],
      renderSchema: ["template", "evidence_coverage", "completeness"],
      version: "1.0",
    },
  ];
}

function createEvidence(types: string[]): EvidenceReference[] {
  return types.map((type) => ({ evidenceType: type, evidenceId: `artifact-${type}` }));
}

test("ComplianceReportPipelineService.generate creates report for valid template", () => {
  const service = new ComplianceReportPipelineService(createTestTemplates());
  const request: ComplianceReportRequest = {
    templateId: "soc2-type2",
    evidence: [
      { evidenceId: "artifact-access_log", evidenceType: "access_log", freshnessHours: 12, trustScore: 0.95, tamperProof: true },
      { evidenceId: "artifact-change_record", evidenceType: "change_record", freshnessHours: 36, trustScore: 0.85, tamperProof: true },
      { evidenceId: "artifact-incident_log", evidenceType: "incident_log", freshnessHours: 48, trustScore: 0.8, tamperProof: false, controlId: "CC1", controlStatus: "partial" },
    ],
    requestedBy: "auditor-1",
  };

  const report = service.generate(request);

  assert.ok(report.artifactId);
  assert.equal(report.templateId, "soc2-type2");
  assert.equal(report.framework, "SOC2");
  assert.equal(report.reportType, "Type II");
  assert.equal(report.lockedOnGeneration, true);
  assert.ok(report.reportVersionLock.startsWith("report_vlock:"));
  assert.equal(report.legalVersion, "current");
  assert.equal(report.status, "generated");
  assert.equal(report.missingEvidenceTypes.length, 0);
  assert.ok(report.evidenceQualityScore < 100);
  assert.ok(report.evidenceQualityBreakdown.freshness > 0);
  assert.equal(report.controlPointMap["CC1"]?.status, "partial");
  assert.ok(report.markdown.length > 0);
  assert.equal(report.readOnly, true);
});

test("ComplianceReportPipelineService.generate marks partial status and records evidence gaps when evidence is missing", () => {
  const service = new ComplianceReportPipelineService(createTestTemplates());
  const request: ComplianceReportRequest = {
    templateId: "soc2-type2",
    evidence: createEvidence(["access_log"]), // missing change_record and incident_log
    requestedBy: "auditor-1",
  };

  const report = service.generate(request);

  assert.equal(report.status, "partial");
  assert.equal(report.missingEvidenceTypes.length, 2);
  assert.equal(report.evidenceQualityBreakdown.completeness, 33);
  assert.equal(report.evidenceQualityScore, 43);
  assert.ok(report.missingEvidenceTypes.includes("change_record"));
  assert.ok(report.missingEvidenceTypes.includes("incident_log"));
});

test("ComplianceReportPipelineService.generate throws for unknown template", () => {
  const service = new ComplianceReportPipelineService(createTestTemplates());
  const request: ComplianceReportRequest = {
    templateId: "unknown-template",
    evidence: [],
    requestedBy: "auditor-1",
  };

  assert.throws(
    () => service.generate(request),
    (err: Error) => err.message.includes("compliance_report.template_not_found"),
  );
});

test("ComplianceReportPipelineService.generate builds evidence map correctly", () => {
  const service = new ComplianceReportPipelineService(createTestTemplates());
  const request: ComplianceReportRequest = {
    templateId: "soc2-type2",
    evidence: createEvidence(["access_log", "change_record", "incident_log"]),
    requestedBy: "auditor-1",
  };

  const report = service.generate(request);

  assert.ok(report.evidenceMap["access_log"]);
  assert.ok(report.evidenceMap["change_record"]);
  assert.ok(report.evidenceMap["incident_log"]);
});

test("ComplianceReportPipelineService.generate requires human signoff when the template attestation policy says so", () => {
  const service = new ComplianceReportPipelineService([{
    templateId: "soc2-attested",
    framework: "SOC2",
    reportType: "Type II",
    requiredEvidenceTypes: ["access_log"],
    renderSchema: ["template"],
    version: "1.0",
    attestation: {
      requireHumanSignoff: true,
      signoffDueDays: 14,
      escalationOwner: "governance_oncall",
      timeoutAction: "freeze_report",
    },
  }]);

  const report = service.generate({
    templateId: "soc2-attested",
    evidence: createEvidence(["access_log"]),
    requestedBy: "auditor-1",
  });
  const signoff = service.evaluateHumanSignoff({
    artifact: report,
    signoffDueAt: "2026-06-01T00:00:00.000Z",
    now: "2026-06-02T00:00:00.000Z",
    escalationOwner: "governance_oncall",
    timeoutAction: "freeze_report",
  });

  assert.equal(report.status, "human_signoff");
  assert.equal(signoff.status, "not_attested_expired");
  assert.equal(signoff.escalationOwner, "governance_oncall");
  assert.equal(signoff.timeoutAction, "freeze_report");
});

test("ComplianceReportPipelineService.recordReadAccess creates receipt", () => {
  const service = new ComplianceReportPipelineService(createTestTemplates());
  const report = service.generate({
    templateId: "soc2-type2",
    evidence: createEvidence(["access_log", "change_record", "incident_log"]),
    requestedBy: "auditor-1",
  });

  const receipt = service.recordReadAccess(report, "reader-1");

  assert.equal(receipt.artifactId, report.artifactId);
  assert.equal(receipt.accessorId, "reader-1");
  assert.equal(receipt.accessMode, "read_only");
  assert.ok(receipt.accessedAt);
});

test("ComplianceReportPipelineService.getAccessLog returns access history", () => {
  const service = new ComplianceReportPipelineService(createTestTemplates());
  const report = service.generate({
    templateId: "soc2-type2",
    evidence: createEvidence(["access_log", "change_record", "incident_log"]),
    requestedBy: "auditor-1",
  });

  service.recordReadAccess(report, "reader-1");
  service.recordReadAccess(report, "reader-2");

  const log = service.getAccessLog(report.artifactId);

  assert.equal(log.length, 2);
  assert.equal(log[0]?.accessorId, "reader-1");
  assert.equal(log[1]?.accessorId, "reader-2");
});

test("ComplianceReportPipelineService.getAccessLog returns empty for unknown artifact", () => {
  const service = new ComplianceReportPipelineService(createTestTemplates());

  const log = service.getAccessLog("unknown-artifact");

  assert.equal(log.length, 0);
});

test("ComplianceReportPipelineService.generate uses provided generatedAt timestamp", () => {
  const service = new ComplianceReportPipelineService(createTestTemplates());
  const fixedTime = "2026-01-15T10:00:00.000Z";
  const request: ComplianceReportRequest = {
    templateId: "soc2-type2",
    evidence: createEvidence(["access_log", "change_record", "incident_log"]),
    requestedBy: "auditor-1",
    generatedAt: fixedTime,
  };

  const report = service.generate(request);

  assert.equal(report.generatedAt, fixedTime);
});

test("ComplianceReportPipelineService.generate handles GDPR template with data evidence", () => {
  const service = new ComplianceReportPipelineService(createTestTemplates());
  const request: ComplianceReportRequest = {
    templateId: "gdpr-data-processing",
    evidence: createEvidence(["consent_record", "erasure_request", "data_mapping"]),
    requestedBy: "dpo-1",
  };

  const report = service.generate(request);

  assert.equal(report.templateId, "gdpr-data-processing");
  assert.equal(report.framework, "GDPR");
  assert.equal(report.status, "generated");
});

test("EvidenceMapperService summarizes coverage ratio", () => {
  const service = new EvidenceMapperService();
  const coverage = service.summarizeCoverage(
    createEvidence(["access_log", "incident_log"]),
    ["access_log", "change_record", "incident_log"],
  );

  assert.equal(coverage.coverageRatio, 0.67);
  assert.deepEqual(coverage.missingTypes, ["change_record"]);
});

test("EvidenceMapperService treats empty required types as fully covered", () => {
  const service = new EvidenceMapperService();
  const coverage = service.summarizeCoverage([], []);

  assert.equal(coverage.coverageRatio, 1);
  assert.deepEqual(coverage.coveredTypes, []);
  assert.deepEqual(coverage.missingTypes, []);
});

test("ComplianceTemplateRegistryService finds templates by framework", () => {
  const service = new ComplianceTemplateRegistryService(createTestTemplates());
  const templates = service.listByFramework("SOC2");

  assert.equal(templates.length, 1);
  assert.equal(templates[0]?.templateId, "soc2-type2");
});

test("ComplianceTemplateRegistryService returns null for unknown template and exposes all", () => {
  const service = new ComplianceTemplateRegistryService(createTestTemplates());

  assert.equal(service.find("missing-template"), null);
  assert.equal(service.all().length, 2);
});

test("ComplianceReportRendererService renders JSON output", () => {
  const service = new ComplianceReportRendererService();
  const output = service.renderJson("report-title", [
    { title: "Template", lines: ["a=1"] },
  ]);

  assert.ok(output.includes("\"title\": \"report-title\""));
  assert.ok(output.includes("\"Template\""));
});
