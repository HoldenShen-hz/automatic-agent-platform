import assert from "node:assert/strict";
import test from "node:test";
import { DataClassificationService } from "../../../../src/platform/control-plane/iam/data-classification-service.js";
import { ComplianceCaseOrchestrationService } from "../../../../src/platform/compliance/compliance-case-orchestration-service.js";
import { ComplianceGovernanceService } from "../../../../src/org-governance/compliance-engine/compliance-governance-service.js";
function createGovernance(required) {
    return new ComplianceGovernanceService([
        {
            orgNodeId: "root",
            nodeType: "company",
            displayName: "Root",
            parentOrgNodeId: null,
            ownerUserIds: ["admin"],
            active: true,
            metadata: {},
            costCenter: "",
        },
        {
            orgNodeId: "dept_risk",
            nodeType: "department",
            displayName: "Risk",
            parentOrgNodeId: "root",
            ownerUserIds: ["risk_lead"],
            active: true,
            metadata: {},
            costCenter: "RISK-001",
        },
    ], required
        ? {
            root: [{ policyId: "root_policy", rules: { approvalRequired: true } }],
            dept_risk: [{ policyId: "risk_policy", rules: { retentionDays: 365, dataExportAllowed: true } }],
        }
        : {
            root: [{ policyId: "root_policy", rules: { approvalRequired: true } }],
        });
}
test("ComplianceCaseOrchestrationService approves redacted cross-region transfer with lineage", () => {
    const service = new ComplianceCaseOrchestrationService({
        classification: new DataClassificationService({ strictMode: true }),
        governance: createGovernance(true),
    });
    const result = service.prepareCrossRegionArtifactTransfer({
        actorId: "risk_lead",
        orgNodeId: "dept_risk",
        action: "artifact.export",
        tenantId: "tenant-risk",
        sourceRegion: "cn-shanghai",
        targetRegion: "eu-frankfurt",
        policy: {
            tenantId: "tenant-risk",
            allowedRegions: ["eu-frankfurt"],
            restrictedClassifications: ["confidential", "restricted"],
            allowRedactedTransfer: true,
        },
        content: "Customer email alice@example.com with password reset token",
        artifactRef: "artifact:source-1",
        exportRef: "artifact:export-1",
        record: { customer: { email: "alice@example.com", note: "secret" } },
        encryptionRules: [{ fieldPath: "customer.email", classification: "restricted" }],
        keyRef: "kms://tenant-risk/key-1",
        requiredPolicyKeys: ["approvalRequired", "retentionDays"],
        allowRedactedRestrictedTransfer: true,
    });
    assert.equal(result.status, "approved");
    assert.equal(result.redactionApplied, true);
    assert.equal(result.governance?.allowed, true);
    assert.equal(result.protectedRecord.protectedFields.length, 1);
    assert.equal(result.lineageEdges.length, 3);
    assert.ok(result.exportContent.includes("***@"));
});
test("ComplianceCaseOrchestrationService blocks transfer when governance policy keys are missing", () => {
    const service = new ComplianceCaseOrchestrationService({
        classification: new DataClassificationService({ strictMode: true }),
        governance: createGovernance(false),
    });
    const result = service.prepareCrossRegionArtifactTransfer({
        actorId: "risk_lead",
        orgNodeId: "dept_risk",
        action: "artifact.export",
        tenantId: "tenant-risk",
        sourceRegion: "cn-shanghai",
        targetRegion: "cn-beijing",
        policy: {
            tenantId: "tenant-risk",
            allowedRegions: ["cn-beijing"],
            restrictedClassifications: ["confidential", "restricted"],
            allowRedactedTransfer: true,
        },
        content: "Quarterly statement",
        artifactRef: "artifact:source-2",
        exportRef: "artifact:export-2",
        record: { summary: "Quarterly statement" },
        encryptionRules: [],
        keyRef: "kms://tenant-risk/key-2",
        requiredPolicyKeys: ["approvalRequired", "retentionDays"],
    });
    assert.equal(result.status, "blocked");
    assert.ok(result.reasons.includes("governance_missing:retentionDays"));
    assert.equal(result.lineageEdges.length, 0);
});
test("ComplianceCaseOrchestrationService plans erasure and records execution lineage", () => {
    const service = new ComplianceCaseOrchestrationService({
        classification: new DataClassificationService({ strictMode: true }),
        governance: createGovernance(true),
    });
    const result = service.planSubjectErasureRequest({
        actorId: "privacy_officer",
        orgNodeId: "dept_risk",
        action: "subject.erase",
        subjectRef: "user:alice",
        requestedBy: "privacy@example.com",
        slaHours: 24,
        requiredPolicyKeys: ["approvalRequired"],
        targets: [
            { targetRef: "artifact:1", targetKind: "artifact", containsPii: true },
            { targetRef: "backup:1", targetKind: "backup", containsPii: true, backupCopy: true },
        ],
    });
    assert.equal(result.status, "ready");
    assert.equal(result.plan.steps[0]?.action, "erase");
    assert.equal(result.plan.steps[1]?.action, "redact");
    assert.equal(result.lineageEdges.length, 2);
});
//# sourceMappingURL=compliance-case-orchestration-service.test.js.map