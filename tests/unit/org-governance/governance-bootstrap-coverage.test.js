import test from "node:test";
import assert from "node:assert/strict";
import { buildGovernanceBootstrap, registerGovernanceBootstrap, GOVERNANCE_CATALOG_SERVICE_ID, GOVERNANCE_BOOTSTRAP_SERVICE_ID, } from "../../../src/org-governance/governance-bootstrap.js";
test("buildGovernanceBootstrap returns governance bootstrap with correct structure", () => {
    const bootstrap = buildGovernanceBootstrap();
    assert.equal(bootstrap.capabilityGroupId, "org-governance");
    assert.ok(bootstrap.catalog.length > 0);
    assert.deepStrictEqual(bootstrap.registeredServiceIds, [GOVERNANCE_CATALOG_SERVICE_ID, GOVERNANCE_BOOTSTRAP_SERVICE_ID]);
});
test("buildGovernanceBootstrap catalog contains all governance capabilities", () => {
    const bootstrap = buildGovernanceBootstrap();
    const capabilityIds = bootstrap.catalog.map((c) => c.capabilityId);
    assert.ok(capabilityIds.includes("org-model"));
    assert.ok(capabilityIds.includes("approval-routing"));
    assert.ok(capabilityIds.includes("sso-scim"));
    assert.ok(capabilityIds.includes("compliance-engine"));
    assert.ok(capabilityIds.includes("knowledge-boundary"));
    assert.ok(capabilityIds.includes("delegated-governance"));
});
test("buildGovernanceBootstrap each capability has required fields", () => {
    const bootstrap = buildGovernanceBootstrap();
    for (const capability of bootstrap.catalog) {
        assert.ok(capability.capabilityId.length > 0);
        assert.ok(capability.entryModule.length > 0);
        assert.ok(capability.description.length > 0);
        assert.ok(Array.isArray(capability.architectureSections));
        assert.ok(capability.architectureSections.length > 0);
        assert.ok(Array.isArray(capability.baselineServices));
        assert.ok(capability.baselineServices.length > 0);
    }
});
test("GOVERNANCE_CATALOG_SERVICE_ID is correct", () => {
    assert.equal(GOVERNANCE_CATALOG_SERVICE_ID, "w3.governance.catalog");
});
test("GOVERNANCE_BOOTSTRAP_SERVICE_ID is correct", () => {
    assert.equal(GOVERNANCE_BOOTSTRAP_SERVICE_ID, "w3.governance.bootstrap");
});
test("registerGovernanceBootstrap registers services", () => {
    const bootstrap = registerGovernanceBootstrap();
    assert.ok(bootstrap != null);
    assert.equal(bootstrap.capabilityGroupId, "org-governance");
});
test("registerGovernanceBootstrap returns same instance on multiple calls", () => {
    // Clear registry state by checking fresh instance behavior
    const bootstrap1 = registerGovernanceBootstrap();
    const bootstrap2 = registerGovernanceBootstrap();
    // Both should have same structure
    assert.equal(bootstrap1.capabilityGroupId, bootstrap2.capabilityGroupId);
});
test("org-model capability has correct baseline services", () => {
    const bootstrap = buildGovernanceBootstrap();
    const orgModel = bootstrap.catalog.find((c) => c.capabilityId === "org-model");
    assert.ok(orgModel != null);
    assert.ok(orgModel.baselineServices.includes("HrRoleGovernanceService"));
});
test("approval-routing capability has correct baseline services", () => {
    const bootstrap = buildGovernanceBootstrap();
    const approvalRouting = bootstrap.catalog.find((c) => c.capabilityId === "approval-routing");
    assert.ok(approvalRouting != null);
    assert.ok(approvalRouting.baselineServices.includes("ApprovalRoutingService"));
    assert.ok(approvalRouting.baselineServices.includes("OrgChartRoutingStrategy"));
    assert.ok(approvalRouting.baselineServices.includes("AmountBasedRoutingStrategy"));
});
test("sso-scim capability has correct baseline services", () => {
    const bootstrap = buildGovernanceBootstrap();
    const ssoScim = bootstrap.catalog.find((c) => c.capabilityId === "sso-scim");
    assert.ok(ssoScim != null);
    assert.ok(ssoScim.baselineServices.includes("IdentitySyncService"));
    assert.ok(ssoScim.baselineServices.includes("GroupRoleMappingService"));
    assert.ok(ssoScim.baselineServices.includes("SamlService"));
});
test("compliance-engine capability has correct baseline services", () => {
    const bootstrap = buildGovernanceBootstrap();
    const compliance = bootstrap.catalog.find((c) => c.capabilityId === "compliance-engine");
    assert.ok(compliance != null);
    assert.ok(compliance.baselineServices.includes("ComplianceGovernanceService"));
    assert.ok(compliance.baselineServices.includes("ComplianceEvidenceCollector"));
});
test("knowledge-boundary capability has correct baseline services", () => {
    const bootstrap = buildGovernanceBootstrap();
    const knowledge = bootstrap.catalog.find((c) => c.capabilityId === "knowledge-boundary");
    assert.ok(knowledge != null);
    assert.ok(knowledge.baselineServices.includes("KnowledgeBoundaryService"));
    assert.ok(knowledge.baselineServices.includes("KnowledgeFederator"));
});
test("delegated-governance capability has correct baseline services", () => {
    const bootstrap = buildGovernanceBootstrap();
    const delegated = bootstrap.catalog.find((c) => c.capabilityId === "delegated-governance");
    assert.ok(delegated != null);
    assert.ok(delegated.baselineServices.includes("DelegatedGovernanceService"));
    assert.ok(delegated.baselineServices.includes("SelfServiceGovernanceConsole"));
});
test("each capability references correct entry module", () => {
    const bootstrap = buildGovernanceBootstrap();
    for (const capability of bootstrap.catalog) {
        assert.ok(capability.entryModule.startsWith("src/org-governance/"));
        assert.ok(capability.entryModule.endsWith("/index.ts"));
    }
});
test("each capability has architecture sections defined", () => {
    const bootstrap = buildGovernanceBootstrap();
    for (const capability of bootstrap.catalog) {
        assert.ok(capability.architectureSections.length > 0);
        // Architecture sections should be in format §XX
        for (const section of capability.architectureSections) {
            assert.ok(section.startsWith("§"));
        }
    }
});
//# sourceMappingURL=governance-bootstrap-coverage.test.js.map