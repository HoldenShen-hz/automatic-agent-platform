import assert from "node:assert/strict";
import test from "node:test";

import {
  ComplianceTemplateRegistryService,
  findComplianceTemplate,
} from "../../../../src/ops-maturity/compliance-reporter/template-registry/index.js";

const makeTemplate = (id: string, framework: string, reportType: string) => ({
  templateId: id,
  framework,
  reportType,
  requiredEvidenceTypes: [],
  renderSchema: [],
  version: "1.0",
});

test("findComplianceTemplate returns matching template", () => {
  const templates = [
    makeTemplate("t1", "SOC2", "audit"),
    makeTemplate("t2", "SOC2", "review"),
  ];

  const result = findComplianceTemplate(templates, "t2");

  assert.equal(result?.templateId, "t2");
});

test("findComplianceTemplate returns null for unknown id", () => {
  const templates = [makeTemplate("t1", "SOC2", "audit")];

  const result = findComplianceTemplate(templates, "unknown");

  assert.equal(result, null);
});

test("ComplianceTemplateRegistryService.find returns template by id", () => {
  const templates = [
    makeTemplate("t1", "SOC2", "audit"),
    makeTemplate("t2", "SOC2", "review"),
  ];
  const service = new ComplianceTemplateRegistryService(templates);

  const result = service.find("t1");

  assert.equal(result?.templateId, "t1");
});

test("ComplianceTemplateRegistryService.find returns null for unknown id", () => {
  const service = new ComplianceTemplateRegistryService([makeTemplate("t1", "SOC2", "audit")]);

  const result = service.find("unknown");

  assert.equal(result, null);
});

test("ComplianceTemplateRegistryService.listByFramework filters by framework", () => {
  const templates = [
    makeTemplate("t1", "SOC2", "audit"),
    makeTemplate("t2", "ISO27001", "audit"),
    makeTemplate("t3", "SOC2", "review"),
  ];
  const service = new ComplianceTemplateRegistryService(templates);

  const results = service.listByFramework("SOC2");

  assert.equal(results.length, 2);
  assert.ok(results.every((t) => t.framework === "SOC2"));
});

test("ComplianceTemplateRegistryService.all returns all templates", () => {
  const templates = [
    makeTemplate("t1", "SOC2", "audit"),
    makeTemplate("t2", "ISO27001", "audit"),
  ];
  const service = new ComplianceTemplateRegistryService(templates);

  const results = service.all();

  assert.equal(results.length, 2);
});
