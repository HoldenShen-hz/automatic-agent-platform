import test from "node:test";
import assert from "node:assert/strict";
import {
  ComplianceFrameworkSchema,
  DepartmentComplianceBindingSchema,
  DEFAULT_COMPLIANCE_FRAMEWORKS,
} from "../../../../src/org-governance/compliance-engine/framework-catalog.js";

test("ComplianceFrameworkSchema parses valid framework", () => {
  const valid = {
    frameworkId: "custom",
    type: "soc2",
    displayName: "Custom Framework",
    controlIds: ["ctrl1", "ctrl2"],
    auditRequirements: ["attestation"],
    reportTemplate: "custom_template",
    minimumPolicies: { enabled: true },
  };

  const result = ComplianceFrameworkSchema.parse(valid);

  assert.strictEqual(result.frameworkId, "custom");
  assert.strictEqual(result.type, "soc2");
  assert.strictEqual(result.displayName, "Custom Framework");
  assert.deepStrictEqual(result.controlIds, ["ctrl1", "ctrl2"]);
  assert.deepStrictEqual(result.auditRequirements, [{
    requirementId: "attestation",
    evidenceType: "attestation",
    frequency: "monthly",
    retentionPeriodDays: 365,
  }]);
  assert.strictEqual(result.reportTemplate, "custom_template");
  assert.deepStrictEqual(result.minimumPolicies, { enabled: true });
});

test("ComplianceFrameworkSchema throws on missing frameworkId", () => {
  assert.throws(() => {
    ComplianceFrameworkSchema.parse({ displayName: "Test", controlIds: [] });
  });
});

test("ComplianceFrameworkSchema throws on empty displayName", () => {
  assert.throws(() => {
    ComplianceFrameworkSchema.parse({ frameworkId: "test", displayName: "", controlIds: [] });
  });
});

test("DepartmentComplianceBindingSchema parses valid binding", () => {
  const valid = {
    bindingId: "binding-001",
    orgNodeId: "dept-001",
    frameworkIds: ["sox", "hipaa"],
    attachedAt: "2024-01-15T00:00:00.000Z",
    attachedBy: "admin-user",
  };

  const result = DepartmentComplianceBindingSchema.parse(valid);

  assert.strictEqual(result.bindingId, "binding-001");
  assert.strictEqual(result.orgNodeId, "dept-001");
  assert.deepStrictEqual(result.frameworkIds, ["sox", "hipaa"]);
  assert.strictEqual(result.attachedAt, "2024-01-15T00:00:00.000Z");
  assert.strictEqual(result.attachedBy, "admin-user");
});

test("DepartmentComplianceBindingSchema defaults frameworkIds to empty array", () => {
  const valid = {
    bindingId: "binding-001",
    orgNodeId: "dept-001",
    attachedAt: "2024-01-15T00:00:00.000Z",
    attachedBy: "admin-user",
  };

  const result = DepartmentComplianceBindingSchema.parse(valid);

  assert.deepStrictEqual(result.frameworkIds, []);
});

test("DepartmentComplianceBindingSchema throws on missing bindingId", () => {
  assert.throws(() => {
    DepartmentComplianceBindingSchema.parse({ orgNodeId: "dept", frameworkIds: [], attachedAt: "2024", attachedBy: "user" });
  });
});

test("DEFAULT_COMPLIANCE_FRAMEWORKS contains SOX framework", () => {
  const sox = DEFAULT_COMPLIANCE_FRAMEWORKS.find((f) => f.frameworkId === "sox");

  assert.ok(sox);
  assert.strictEqual(sox.type, "sox");
  assert.strictEqual(sox.displayName, "Sarbanes-Oxley");
  assert.ok(sox.controlIds.includes("access_review"));
  assert.ok(sox.controlIds.includes("approval_segregation"));
  assert.ok(sox.controlIds.includes("audit_retention"));
  assert.ok(sox.auditRequirements.some((requirement) => requirement.requirementId === "quarterly_access_review"));
  assert.strictEqual(sox.reportTemplate, "sox_control_attestation");
  assert.strictEqual(sox.minimumPolicies.segregationOfDuties, true);
  assert.strictEqual(sox.minimumPolicies.auditRetentionDays, 2555);
  assert.strictEqual(sox.minimumPolicies.approvalChainRequired, true);
});

test("DEFAULT_COMPLIANCE_FRAMEWORKS contains HIPAA framework", () => {
  const hipaa = DEFAULT_COMPLIANCE_FRAMEWORKS.find((f) => f.frameworkId === "hipaa");

  assert.ok(hipaa);
  assert.strictEqual(hipaa.type, "hipaa");
  assert.strictEqual(hipaa.displayName, "HIPAA");
  assert.ok(hipaa.controlIds.includes("phi_access"));
  assert.ok(hipaa.controlIds.includes("minimum_necessary"));
  assert.ok(hipaa.controlIds.includes("encryption_required"));
  assert.ok(hipaa.auditRequirements.some((requirement) => requirement.requirementId === "phi_access_log"));
  assert.strictEqual(hipaa.reportTemplate, "hipaa_phi_control_report");
  assert.strictEqual(hipaa.minimumPolicies.dataClassification, "restricted");
  assert.strictEqual(hipaa.minimumPolicies.encryptionRequired, true);
  assert.strictEqual(hipaa.minimumPolicies.breachNotificationHours, 72);
});

test("DEFAULT_COMPLIANCE_FRAMEWORKS contains PCI DSS framework", () => {
  const pci = DEFAULT_COMPLIANCE_FRAMEWORKS.find((f) => f.frameworkId === "pci_dss");

  assert.ok(pci);
  assert.strictEqual(pci.type, "pci_dss");
  assert.strictEqual(pci.displayName, "PCI DSS");
  assert.ok(pci.controlIds.includes("network_segmentation"));
  assert.ok(pci.controlIds.includes("key_rotation"));
  assert.ok(pci.controlIds.includes("payment_audit"));
  assert.ok(pci.auditRequirements.some((requirement) => requirement.requirementId === "cardholder_data_scan"));
  assert.strictEqual(pci.reportTemplate, "pci_dss_attestation");
  assert.strictEqual(pci.minimumPolicies.cardDataIsolation, true);
  assert.strictEqual(pci.minimumPolicies.keyRotationDays, 90);
  assert.strictEqual(pci.minimumPolicies.dualControl, true);
});

test("DEFAULT_COMPLIANCE_FRAMEWORKS contains GDPR framework", () => {
  const gdpr = DEFAULT_COMPLIANCE_FRAMEWORKS.find((f) => f.frameworkId === "gdpr");

  assert.ok(gdpr);
  assert.strictEqual(gdpr.type, "gdpr");
  assert.strictEqual(gdpr.displayName, "GDPR");
  assert.ok(gdpr.controlIds.includes("lawful_basis"));
  assert.ok(gdpr.controlIds.includes("erasure"));
  assert.ok(gdpr.controlIds.includes("residency"));
  assert.ok(gdpr.controlIds.includes("consent_audit"));
  assert.ok(gdpr.auditRequirements.some((requirement) => requirement.requirementId === "lawful_basis_register"));
  assert.strictEqual(gdpr.reportTemplate, "gdpr_data_governance_report");
  assert.strictEqual(gdpr.minimumPolicies.erasureWorkflowRequired, true);
  assert.strictEqual(gdpr.minimumPolicies.residencyAwareProcessing, true);
  assert.strictEqual(gdpr.minimumPolicies.consentTracking, true);
});

test("DEFAULT_COMPLIANCE_FRAMEWORKS includes SOC2 and PIPL canonical types", () => {
  const soc2 = DEFAULT_COMPLIANCE_FRAMEWORKS.find((f) => f.frameworkId === "soc2");
  const pipl = DEFAULT_COMPLIANCE_FRAMEWORKS.find((f) => f.frameworkId === "pipl");

  assert.ok(soc2);
  assert.strictEqual(soc2.type, "soc2");
  assert.ok(soc2.auditRequirements.some((requirement) => requirement.requirementId === "control_owner_attestation"));

  assert.ok(pipl);
  assert.strictEqual(pipl.type, "pipl");
  assert.ok(pipl.auditRequirements.some((requirement) => requirement.requirementId === "cross_border_transfer_register"));
});

test("DEFAULT_COMPLIANCE_FRAMEWORKS frameworks are readonly", () => {
  assert.ok(Object.isFrozen(DEFAULT_COMPLIANCE_FRAMEWORKS));
  assert.ok(DEFAULT_COMPLIANCE_FRAMEWORKS.every((f) => Object.isFrozen(f)));
});

test("DEFAULT_COMPLIANCE_FRAMEWORKS all frameworks have non-empty controlIds", () => {
  for (const framework of DEFAULT_COMPLIANCE_FRAMEWORKS) {
    assert.ok(framework.controlIds.length > 0, `Framework ${framework.frameworkId} should have at least one controlId`);
  }
});
