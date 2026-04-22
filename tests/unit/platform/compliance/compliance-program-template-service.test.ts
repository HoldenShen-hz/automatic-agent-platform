import assert from "node:assert/strict";
import test from "node:test";

import {
  ComplianceProgramTemplateService,
  type ComplianceProgramTemplate,
} from "../../../../src/platform/compliance/compliance-program-template-service.js";

test("ComplianceProgramTemplateService returns all predefined templates", () => {
  const service = new ComplianceProgramTemplateService();
  const templates = service.listTemplates();

  assert.equal(templates.length, 3);
  assert.ok(templates.some((t) => t.templateId === "gdpr-export-erasure"));
  assert.ok(templates.some((t) => t.templateId === "soc2-audit-evidence"));
  assert.ok(templates.some((t) => t.templateId === "hipaa-cross-region-transfer"));
});

test("ComplianceProgramTemplateService retrieves correct template by ID", () => {
  const service = new ComplianceProgramTemplateService();

  const gdpr = service.getTemplate("gdpr-export-erasure");
  assert.ok(gdpr);
  assert.equal(gdpr.regulation, "GDPR");
  assert.deepEqual(gdpr.requiredControls, [
    "residency_check",
    "subject_identity_verification",
    "lineage_capture",
  ]);
  assert.deepEqual(gdpr.dataDomains, ["knowledge", "artifacts", "memory"]);
});

test("ComplianceProgramTemplateService returns null for unknown template", () => {
  const service = new ComplianceProgramTemplateService();
  const unknown = service.getTemplate("unknown-template");
  assert.equal(unknown, null);
});

test("ComplianceProgramTemplateService builds correct coverage matrix", () => {
  const service = new ComplianceProgramTemplateService();
  const matrix = service.buildCoverageMatrix();

  assert.equal(matrix.length, 3);

  const gdprEntry = matrix.find((m) => m.templateId === "gdpr-export-erasure");
  assert.ok(gdprEntry);
  assert.equal(gdprEntry.regulation, "GDPR");
  assert.equal(gdprEntry.controlCount, 3);
  assert.equal(gdprEntry.reportTemplateCount, 2);

  const soc2Entry = matrix.find((m) => m.templateId === "soc2-audit-evidence");
  assert.ok(soc2Entry);
  assert.equal(soc2Entry.controlCount, 4);
  assert.equal(soc2Entry.reportTemplateCount, 2);

  const hipaaEntry = matrix.find((m) => m.templateId === "hipaa-cross-region-transfer");
  assert.ok(hipaaEntry);
  assert.equal(hipaaEntry.controlCount, 4);
  assert.equal(hipaaEntry.reportTemplateCount, 2);
});

test("ComplianceProgramTemplateService template immutability", () => {
  const service = new ComplianceProgramTemplateService();
  const templates = service.listTemplates();

  // Templates should be frozen/readonly
  templates.push({} as ComplianceProgramTemplate);
  assert.equal(service.listTemplates().length, 3);
});

test("ComplianceProgramTemplateService SOC2 template has correct structure", () => {
  const service = new ComplianceProgramTemplateService();
  const soc2 = service.getTemplate("soc2-audit-evidence");

  assert.ok(soc2);
  assert.equal(soc2.regulation, "SOC2");
  assert.ok(soc2.requiredControls.includes("audit_retention"));
  assert.ok(soc2.requiredControls.includes("access_review"));
  assert.ok(soc2.tenantProgramFlow.includes("control_sampling"));
  assert.ok(soc2.tenantProgramFlow.includes("evidence_export"));
  assert.deepEqual(soc2.dataDomains, ["audit", "events", "deployments"]);
});

test("ComplianceProgramTemplateService HIPAA template has correct structure", () => {
  const service = new ComplianceProgramTemplateService();
  const hipaa = service.getTemplate("hipaa-cross-region-transfer");

  assert.ok(hipaa);
  assert.equal(hipaa.regulation, "HIPAA");
  assert.ok(hipaa.requiredControls.includes("phi_classification"));
  assert.ok(hipaa.requiredControls.includes("field_encryption"));
  assert.ok(hipaa.requiredControls.includes("residency_check"));
  assert.ok(hipaa.tenantProgramFlow.includes("classification"));
  assert.ok(hipaa.tenantProgramFlow.includes("governance_review"));
  assert.deepEqual(hipaa.dataDomains, ["knowledge", "artifacts"]);
});
