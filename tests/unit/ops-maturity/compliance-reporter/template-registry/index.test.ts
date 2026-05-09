import assert from "node:assert/strict";
import test from "node:test";

import {
  ComplianceTemplateRegistryService,
  findComplianceTemplate,
} from "../../../../../src/ops-maturity/compliance-reporter/template-registry/index.js";

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

test("ComplianceTemplateRegistryService normalizes template lock and legal metadata", () => {
  const service = new ComplianceTemplateRegistryService([
    makeTemplate("t1", "SOC2", "audit"),
  ]);

  const template = service.find("t1");

  assert.equal(template?.lockedOnGeneration, true);
  assert.ok(template?.reportVersionLock?.startsWith("report_vlock:"));
  assert.equal(template?.legalVersion, "current");
  assert.equal(template?.effectiveDate, "1970-01-01");
  assert.equal(template?.migrationRule, "no_migration_required");
});

test("ComplianceTemplateRegistryService preserves extended control, attestation, and auditor-access fields", () => {
  const service = new ComplianceTemplateRegistryService([
    {
      ...makeTemplate("t-extended", "SOC2", "audit"),
      controls: [{ controlId: "CC1", owner: "security", evidenceRequirements: ["access_log"] }],
      attestation: {
        requireHumanSignoff: true,
        signoffDueDays: 14,
        escalationOwner: "governance_oncall",
        timeoutAction: "freeze_report",
      },
      auditorAccess: {
        requiredPermissions: ["compliance:report:read", "compliance:soc2:read"],
        allowPiiAccess: false,
        redactionRequired: true,
      },
    },
  ]);

  const template = service.find("t-extended");

  assert.equal(template?.controls?.[0]?.controlId, "CC1");
  assert.equal(template?.attestation?.requireHumanSignoff, true);
  assert.equal(template?.attestation?.timeoutAction, "freeze_report");
  assert.deepEqual(template?.auditorAccess?.requiredPermissions, ["compliance:report:read", "compliance:soc2:read"]);
});
