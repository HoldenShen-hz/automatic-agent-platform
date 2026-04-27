/**
 * Compliance Program Template Service Integration Tests
 *
 * Tests the ComplianceProgramTemplateService with real template data
 * and coverage matrix building across multiple compliance regulations.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ComplianceProgramTemplateService } from "../../../../src/platform/compliance/compliance-program-template-service.js";

test("compliance-program-template: listTemplates returns all default templates", () => {
  const service = new ComplianceProgramTemplateService();
  const templates = service.listTemplates();

  assert.equal(templates.length, 3, "Should have 3 default templates");

  const templateIds = templates.map((t) => t.templateId);
  assert.ok(templateIds.includes("gdpr-export-erasure"), "Should include GDPR template");
  assert.ok(templateIds.includes("soc2-audit-evidence"), "Should include SOC2 template");
  assert.ok(templateIds.includes("hipaa-cross-region-transfer"), "Should include HIPAA template");
});

test("compliance-program-template: getTemplate returns correct template by ID", () => {
  const service = new ComplianceProgramTemplateService();

  const gdprTemplate = service.getTemplate("gdpr-export-erasure");
  assert.ok(gdprTemplate !== null, "GDPR template should be found");
  assert.equal(gdprTemplate?.regulation, "GDPR");
  assert.ok(gdprTemplate?.requiredControls.includes("residency_check"));
  assert.ok(gdprTemplate?.tenantProgramFlow.includes("intake"));

  const soc2Template = service.getTemplate("soc2-audit-evidence");
  assert.ok(soc2Template !== null, "SOC2 template should be found");
  assert.equal(soc2Template?.regulation, "SOC2");

  const hipaaTemplate = service.getTemplate("hipaa-cross-region-transfer");
  assert.ok(hipaaTemplate !== null, "HIPAA template should be found");
  assert.equal(hipaaTemplate?.regulation, "HIPAA");
});

test("compliance-program-template: getTemplate returns null for unknown ID", () => {
  const service = new ComplianceProgramTemplateService();

  const unknown = service.getTemplate("unknown-regulation");
  assert.equal(unknown, null, "Should return null for unknown template");
});

test("compliance-program-template: buildCoverageMatrix produces correct structure", () => {
  const service = new ComplianceProgramTemplateService();
  const matrix = service.buildCoverageMatrix();

  assert.equal(matrix.length, 3, "Matrix should have 3 entries");

  const gdprEntry = matrix.find((e) => e.templateId === "gdpr-export-erasure");
  assert.ok(gdprEntry !== undefined, "GDPR entry should exist");
  assert.equal(gdprEntry?.regulation, "GDPR");
  assert.equal(gdprEntry?.controlCount, 3, "GDPR has 3 required controls");
  assert.equal(gdprEntry?.reportTemplateCount, 2, "GDPR has 2 report templates");

  const soc2Entry = matrix.find((e) => e.templateId === "soc2-audit-evidence");
  assert.ok(soc2Entry !== undefined, "SOC2 entry should exist");
  assert.equal(soc2Entry?.controlCount, 4, "SOC2 has 4 required controls");
  assert.equal(soc2Entry?.reportTemplateCount, 2, "SOC2 has 2 report templates");
});

test("compliance-program-template: templates are immutable copies", () => {
  const service = new ComplianceProgramTemplateService();
  const templates1 = service.listTemplates();

  // Modifying returned array should not affect subsequent calls
  templates1.push({
    templateId: "custom",
    regulation: "CUSTOM",
    reportTemplateRefs: [],
    requiredControls: [],
    tenantProgramFlow: [],
    dataDomains: [],
  } as any);

  const templates2 = service.listTemplates();
  assert.equal(templates2.length, 3, "Original templates should be unchanged");
});

test("compliance-program-template: each template has required data domains", () => {
  const service = new ComplianceProgramTemplateService();
  const templates = service.listTemplates();

  for (const template of templates) {
    assert.ok(Array.isArray(template.dataDomains), "dataDomains should be array");
    assert.ok(template.dataDomains.length > 0, "dataDomains should not be empty");
    assert.ok(Array.isArray(template.tenantProgramFlow), "tenantProgramFlow should be array");
    assert.ok(template.tenantProgramFlow.length > 0, "tenantProgramFlow should not be empty");
    assert.ok(Array.isArray(template.reportTemplateRefs), "reportTemplateRefs should be array");
    assert.ok(template.reportTemplateRefs.length > 0, "reportTemplateRefs should not be empty");
    assert.ok(Array.isArray(template.requiredControls), "requiredControls should be array");
    assert.ok(template.requiredControls.length > 0, "requiredControls should not be empty");
  }
});

test("compliance-program-template: GDPR template covers knowledge, artifacts, memory domains", () => {
  const service = new ComplianceProgramTemplateService();
  const gdpr = service.getTemplate("gdpr-export-erasure");

  assert.ok(gdpr !== null);
  assert.ok(gdpr.dataDomains.includes("knowledge"));
  assert.ok(gdpr.dataDomains.includes("artifacts"));
  assert.ok(gdpr.dataDomains.includes("memory"));
});

test("compliance-program-template: SOC2 template covers audit, events, deployments domains", () => {
  const service = new ComplianceProgramTemplateService();
  const soc2 = service.getTemplate("soc2-audit-evidence");

  assert.ok(soc2 !== null);
  assert.ok(soc2.dataDomains.includes("audit"));
  assert.ok(soc2.dataDomains.includes("events"));
  assert.ok(soc2.dataDomains.includes("deployments"));
});
