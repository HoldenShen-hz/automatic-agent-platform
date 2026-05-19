import assert from "node:assert/strict";
import test from "node:test";
// These are index files that just re-export, so tests verify the exports exist
import * as approvalRoutingIndex from "../../../src/org-governance/approval-routing/index.js";
import * as complianceEngineIndex from "../../../src/org-governance/compliance-engine/index.js";
import * as knowledgeBoundaryIndex from "../../../src/org-governance/knowledge-boundary/index.js";
import * as ssoScimIndex from "../../../src/org-governance/sso-scim/index.js";
test("approval-routing index exports ApprovalRoutingService", () => {
    assert.ok(approvalRoutingIndex.ApprovalRoutingService !== undefined);
});
test("approval-routing index exports from delegation", () => {
    assert.ok(approvalRoutingIndex.resolveDelegatedApprover !== undefined);
});
test("approval-routing index exports from escalation", () => {
    assert.ok(approvalRoutingIndex.shouldEscalateApproval !== undefined);
});
test("approval-routing index exports from route-engine", () => {
    assert.ok(approvalRoutingIndex.resolveApprovalRoute !== undefined);
});
test("compliance-engine index exports ComplianceGovernanceService", () => {
    assert.ok(complianceEngineIndex.ComplianceGovernanceService !== undefined);
});
test("compliance-engine index exports from audit-enforcer", () => {
    assert.ok(complianceEngineIndex.buildGovernanceAuditRecord !== undefined);
});
test("compliance-engine index exports evidence collector", () => {
    assert.ok(complianceEngineIndex.ComplianceEvidenceCollector !== undefined);
});
test("compliance-engine index exports framework catalog", () => {
    assert.ok(complianceEngineIndex.DEFAULT_COMPLIANCE_FRAMEWORKS !== undefined);
});
test("knowledge-boundary index exports KnowledgeBoundaryService", () => {
    assert.ok(knowledgeBoundaryIndex.KnowledgeBoundaryService !== undefined);
});
test("knowledge-boundary index exports from boundary-manager", () => {
    assert.ok(knowledgeBoundaryIndex.KnowledgeBoundarySchema !== undefined);
});
test("sso-scim index exports identity-sync-service", () => {
    assert.ok(ssoScimIndex.IdentitySyncService !== undefined);
});
test("sso-scim index exports api-key-service", () => {
    assert.ok(ssoScimIndex.ApiKeyService !== undefined);
});
test("sso-scim index exports from oidc", () => {
    assert.ok(ssoScimIndex.OidcIdentityService !== undefined);
});
test("sso-scim index exports from scim-sync", () => {
    assert.ok(ssoScimIndex.ScimProvisionService !== undefined);
});
test("sso-scim index exports scim-dlq-reconciliation", () => {
    assert.ok(ssoScimIndex.ScimDlqReconciliationService !== undefined);
});
//# sourceMappingURL=index-re-exports.test.js.map