import test from "node:test";
import assert from "node:assert/strict";

import { ComplianceGovernanceService } from "../../../src/org-governance/compliance-engine/compliance-governance-service.js";
import { ComplianceEvidenceCollector } from "../../../src/org-governance/compliance-engine/evidence-collector.js";
import type { OrgNode } from "../../../src/org-governance/org-model/org-node/index.js";

const companyNode: OrgNode = {
  orgNodeId: "company",
  nodeType: "company",
  displayName: "Acme Corp",
  parentOrgNodeId: null,
  ownerUserIds: ["ceo"],
  active: true,
  costCenter: "CC-000",
  metadata: {},
};

const deptNode: OrgNode = {
  orgNodeId: "dept",
  nodeType: "department",
  displayName: "Platform",
  parentOrgNodeId: "company",
  ownerUserIds: ["dir"],
  active: true,
  costCenter: "CC-110",
  metadata: {},
};

const orgNodes = [companyNode, deptNode];

test("ComplianceGovernanceService.evaluate returns allowed when all policies are satisfied", () => {
  const service = new ComplianceGovernanceService(
    orgNodes,
    {
      dept: [
        {
          policyId: "pol-1",
          rules: {
            segregationOfDuties: true,
            auditRetentionDays: 2555,
            approvalChainRequired: true,
          },
        },
      ],
    },
    [],
    [],
  );
  const result = service.evaluate({
    actorId: "engineer",
    orgNodeId: "dept",
    action: "budget.create",
    requiredPolicyKeys: ["segregationOfDuties", "approvalChainRequired"],
  });
  assert.equal(result.allowed, true);
  assert.equal(result.missingKeys.length, 0);
});

test("ComplianceGovernanceService.evaluate returns not allowed when required policies are missing", () => {
  const service = new ComplianceGovernanceService(
    orgNodes,
    { dept: [] },
    [],
    [],
  );
  const result = service.evaluate({
    actorId: "engineer",
    orgNodeId: "dept",
    action: "budget.create",
    requiredPolicyKeys: ["segregationOfDuties"],
  });
  assert.equal(result.allowed, false);
  assert.ok(result.missingKeys.includes("segregationOfDuties"));
});

test("ComplianceGovernanceService.evaluate resolves frameworks for org node lineage", () => {
  const soxFramework = {
    frameworkId: "sox",
    type: "sox" as const,
    displayName: "Sarbanes-Oxley",
    controlIds: ["access_review", "approval_segregation", "audit_retention"],
    auditRequirements: [],
    reportTemplate: "sox_control_attestation",
    minimumPolicies: { segregationOfDuties: true },
  };
  const service = new ComplianceGovernanceService(
    orgNodes,
    {
      company: [{ policyId: "pol-sox", rules: { segregationOfDuties: true } }],
      dept: [],
    },
    [soxFramework],
    [{ bindingId: "bind-1", orgNodeId: "dept", frameworkIds: ["sox"], attachedAt: new Date().toISOString(), attachedBy: "admin" }],
  );
  const result = service.evaluate({
    actorId: "engineer",
    orgNodeId: "dept",
    action: "budget.create",
    requiredPolicyKeys: [],
  });
  assert.ok(result.applicableFrameworks.some((f) => f.frameworkId === "sox"));
});

test("ComplianceGovernanceService.listFrameworks returns registered frameworks", () => {
  const customFramework = {
    frameworkId: "custom",
    type: "gdpr" as const,
    displayName: "Custom Framework",
    controlIds: ["custom_control"],
    auditRequirements: [],
    reportTemplate: "custom_report",
    minimumPolicies: {},
  };
  const service = new ComplianceGovernanceService(orgNodes, {}, [customFramework], []);
  const frameworks = service.listFrameworks();
  assert.ok(frameworks.some((f) => f.frameworkId === "custom"));
});

test("ComplianceGovernanceService.attachFrameworks binds framework to org node", () => {
  const soxFramework = {
    frameworkId: "sox",
    type: "sox" as const,
    displayName: "Sarbanes-Oxley",
    controlIds: ["access_review"],
    auditRequirements: [],
    reportTemplate: "sox_control_attestation",
    minimumPolicies: {},
  };
  const service = new ComplianceGovernanceService(orgNodes, {}, [soxFramework], []);
  service.attachFrameworks({
    bindingId: "bind-1",
    orgNodeId: "dept",
    frameworkIds: ["sox"],
    attachedAt: new Date().toISOString(),
    attachedBy: "admin",
  });
  const result = service.evaluate({
    actorId: "engineer",
    orgNodeId: "dept",
    action: "budget.create",
    requiredPolicyKeys: [],
  });
  assert.ok(result.applicableFrameworks.length > 0);
});

test("ComplianceGovernanceService.createExceptionWorkflow generates exception record", () => {
  const service = new ComplianceGovernanceService(orgNodes, {}, [], []);
  const exception = service.createExceptionWorkflow({
    scope: "budget.override",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    approver: "compliance_officer",
    compensatingControls: ["additional_review"],
    auditRef: "audit-ref-123",
  });
  assert.ok(exception.exceptionId.startsWith("compliance_exception:"));
  assert.equal(exception.scope, "budget.override");
  assert.equal(exception.approver, "compliance_officer");
});

test("ComplianceGovernanceService.collectEvidence adds evidence record with hash chain", () => {
  const service = new ComplianceGovernanceService(orgNodes, {}, [], []);
  const evidence = service.collectEvidence({
    frameworkId: "sox",
    controlId: "access_review",
    source: "idp",
    artifactRef: "access_log_2024_01",
  });
  assert.ok(evidence.evidenceId.startsWith("compliance_evidence_"));
  assert.ok(evidence.hash.length > 0);
  assert.equal(evidence.previousHash, "GENESIS");
});

test("ComplianceGovernanceService.collectEvidence maintains hash chain continuity", () => {
  const service = new ComplianceGovernanceService(orgNodes, {}, [], []);
  const first = service.collectEvidence({
    frameworkId: "sox",
    controlId: "access_review",
    source: "idp",
    artifactRef: "access_log_2024_01",
  });
  const second = service.collectEvidence({
    frameworkId: "sox",
    controlId: "approval_segregation",
    source: "workflow",
    artifactRef: "approval_log_2024_01",
  });
  assert.equal(second.previousHash, first.hash);
});

test("ComplianceGovernanceService.listEvidence returns collected evidence", () => {
  const service = new ComplianceGovernanceService(orgNodes, {}, [], []);
  service.collectEvidence({
    frameworkId: "sox",
    controlId: "access_review",
    source: "idp",
    artifactRef: "access_log_2024_01",
  });
  const evidence = service.listEvidence("sox");
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0]?.controlId, "access_review");
});

test("ComplianceGovernanceService.listEvidence filters by framework when specified", () => {
  const service = new ComplianceGovernanceService(orgNodes, {}, [], []);
  service.collectEvidence({
    frameworkId: "sox",
    controlId: "access_review",
    source: "idp",
    artifactRef: "access_log_2024_01",
  });
  service.collectEvidence({
    frameworkId: "hipaa",
    controlId: "phi_access",
    source: "ehr",
    artifactRef: "phi_log_2024_01",
  });
  const soxEvidence = service.listEvidence("sox");
  assert.equal(soxEvidence.length, 1);
  assert.equal(soxEvidence[0]?.frameworkId, "sox");
});

test("ComplianceGovernanceService.scoreEvidenceQuality calculates completeness score", () => {
  const service = new ComplianceGovernanceService(orgNodes, {}, [], []);
  service.collectEvidence({
    frameworkId: "sox",
    controlId: "access_review",
    source: "idp",
    artifactRef: "access_log_2024_01",
  });
  service.collectEvidence({
    frameworkId: "sox",
    controlId: "approval_segregation",
    source: "workflow",
    artifactRef: "",
  });
  const score = service.scoreEvidenceQuality("sox");
  assert.ok(score.score > 0 && score.score < 100);
  assert.ok(score.missingEvidenceIds.length > 0);
});

test("ComplianceGovernanceService.buildControlCoverageReport identifies missing controls", () => {
  const soxFramework = {
    frameworkId: "sox",
    type: "sox" as const,
    displayName: "Sarbanes-Oxley",
    controlIds: ["access_review", "approval_segregation", "audit_retention"],
    auditRequirements: [],
    reportTemplate: "sox_control_attestation",
    minimumPolicies: {},
  };
  const service = new ComplianceGovernanceService(
    orgNodes,
    {
      dept: [{ policyId: "pol-1", rules: { access_review: true } }],
    },
    [soxFramework],
    [],
  );
  const report = service.buildControlCoverageReport("sox", "dept");
  assert.ok(report.coveredControlIds.includes("access_review"));
  assert.ok(report.missingControlIds.includes("approval_segregation"));
  assert.ok(report.missingControlIds.includes("audit_retention"));
  assert.ok(report.coverageRatio > 0 && report.coverageRatio < 1);
});

test("ComplianceEvidenceCollector.scheduleEvidenceCollection creates scheduled job", () => {
  const collector = new ComplianceEvidenceCollector();
  const schedule = collector.scheduleEvidenceCollection(
    "sox",
    "access_review",
    { type: "periodic", intervalMinutes: 1440 },
    60,
  );
  assert.ok(schedule.scheduleId.startsWith("evidence_schedule_"));
  assert.equal(schedule.frameworkId, "sox");
  assert.equal(schedule.controlId, "access_review");
  assert.ok(schedule.nextRunAt.length > 0);
  assert.equal(schedule.active, true);
});

test("ComplianceEvidenceCollector.getDueCollections returns schedules ready to run", () => {
  const collector = new ComplianceEvidenceCollector();
  const now = new Date().toISOString();
  collector.scheduleEvidenceCollection("sox", "access_review", { type: "periodic", intervalMinutes: 60 }, 30);
  collector.scheduleEvidenceCollection("sox", "approval_segregation", { type: "on_demand" }, 30);
  const due = collector.getDueCollections(now);
  assert.ok(due.length >= 1);
});

test("ComplianceEvidenceCollector.verifyChain passes for untampered evidence", () => {
  const collector = new ComplianceEvidenceCollector();
  collector.collect({
    frameworkId: "sox",
    controlId: "access_review",
    source: "idp",
    artifactRef: "access_log",
  });
  collector.collect({
    frameworkId: "sox",
    controlId: "approval_segregation",
    source: "workflow",
    artifactRef: "approval_log",
  });
  const tamperedRecords = collector.verifyChain("sox");
  assert.equal(tamperedRecords.length, 0);
});

test("ComplianceEvidenceCollector.deactivateSchedule disables scheduled collection", () => {
  const collector = new ComplianceEvidenceCollector();
  const schedule = collector.scheduleEvidenceCollection(
    "sox",
    "access_review",
    { type: "periodic", intervalMinutes: 1440 },
  );
  const deactivated = collector.deactivateSchedule(schedule.scheduleId);
  assert.equal(deactivated, true);
  const allSchedules = collector.listScheduledCollections();
  const updated = allSchedules.find((s) => s.scheduleId === schedule.scheduleId);
  assert.equal(updated?.active, false);
});

test("ComplianceGovernanceService.registerFramework adds custom framework dynamically", () => {
  const service = new ComplianceGovernanceService(orgNodes, {}, [], []);
  const customFramework = {
    frameworkId: "custom-gdpr",
    type: "gdpr" as const,
    displayName: "Custom GDPR",
    controlIds: ["lawful_basis"],
    auditRequirements: [],
    reportTemplate: "custom_gdpr_report",
    minimumPolicies: {},
  };
  const registered = service.registerFramework(customFramework);
  assert.equal(registered.frameworkId, "custom-gdpr");
  const frameworks = service.listFrameworks();
  assert.ok(frameworks.some((f) => f.frameworkId === "custom-gdpr"));
});
