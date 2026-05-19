import assert from "node:assert/strict";
import test from "node:test";
import { EnterpriseCapabilityMatrixService, DEFAULT_ENTERPRISE_CAPABILITIES, } from "../../../../src/scale-ecosystem/enterprise/enterprise-capability-matrix-service.js";
// Mock stores
function createMockStore() {
    return {
        release: {
            upsertEnvironmentReadinessRecord: () => { },
            getActiveEnvironmentReadinessRecord: () => null,
            listEnvironmentReadinessRecords: () => [],
            insertEnterpriseCapabilityReport: () => { },
            listEnterpriseCapabilityReports: () => [],
        },
        billing: {
            getBillingAccount: () => null,
        },
    };
}
function createMockDb() {
    return {
        connection: {
            prepare: () => ({
                get: () => null,
                all: () => [],
            }),
        },
        transaction: () => { },
    };
}
test("DEFAULT_ENTERPRISE_CAPABILITIES contains expected capabilities", () => {
    const capabilityKeys = DEFAULT_ENTERPRISE_CAPABILITIES.map(c => c.capabilityKey);
    assert.ok(capabilityKeys.includes("admin_console"));
    assert.ok(capabilityKeys.includes("sso"));
    assert.ok(capabilityKeys.includes("scim"));
    assert.ok(capabilityKeys.includes("tenant_isolation"));
    assert.ok(capabilityKeys.includes("private_model"));
    assert.ok(capabilityKeys.includes("private_network_deployment"));
    assert.ok(capabilityKeys.includes("rollout_and_rollback"));
    assert.ok(capabilityKeys.includes("incident_console"));
    assert.ok(capabilityKeys.includes("data_residency_controls"));
    assert.ok(capabilityKeys.includes("audit_export"));
});
test("EnterpriseCapabilityMatrixService registers environment readiness", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb(), createMockStore());
    const record = service.registerEnvironmentReadiness({
        environment: "production",
        componentType: "gateway",
        componentId: "ops_gateway",
        credentialReady: true,
        owner: "platform_team",
    });
    assert.equal(record.environment, "production");
    assert.equal(record.componentType, "gateway");
    assert.equal(record.componentId, "ops_gateway");
    assert.equal(record.credentialReady, 1);
    assert.equal(record.owner, "platform_team");
});
test("EnterpriseCapabilityMatrixService builds matrix with community tier", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb(), createMockStore());
    const result = service.buildMatrix({
        environment: "production",
        deploymentMode: "cloud_shared",
    });
    assert.equal(result.report.tier, "community");
    assert.equal(result.report.environment, "production");
    assert.equal(result.report.deploymentMode, "cloud_shared");
    assert.ok(result.report.entries.length > 0);
});
test("EnterpriseCapabilityMatrixService blocks enterprise features for community tier", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb(), createMockStore());
    const result = service.buildMatrix({
        environment: "production",
        deploymentMode: "cloud_shared",
    });
    const ssoEntry = result.report.entries.find(e => e.capabilityKey === "sso");
    assert.ok(ssoEntry);
    assert.equal(ssoEntry.status, "blocked");
    assert.ok(ssoEntry.reasonCodes.some(r => r.includes("license_tier_below_requirement")));
});
test("EnterpriseCapabilityMatrixService allows professional features for professional tier", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ planId: "pro" });
    mockStore.release.getActiveEnvironmentReadinessRecord = () => ({
        readinessId: "read_123",
        environment: "production",
        componentType: "gateway",
        componentId: "ops_gateway",
        credentialReady: 1,
        secondaryGatesJson: JSON.stringify({}),
        owner: "team",
        lastVerifiedAt: new Date().toISOString(),
        isActive: 1,
        notes: null,
    });
    const service = new EnterpriseCapabilityMatrixService(createMockDb(), mockStore);
    const result = service.buildMatrix({
        accountId: "acct_123",
        environment: "production",
        deploymentMode: "cloud_shared",
    });
    const adminEntry = result.report.entries.find(e => e.capabilityKey === "admin_console");
    assert.ok(adminEntry);
    assert.equal(adminEntry.status, "available");
    assert.equal(adminEntry.requiredTier, "professional");
});
test("EnterpriseCapabilityMatrixService blocks features not supported in deployment mode", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ planId: "enterprise" });
    const service = new EnterpriseCapabilityMatrixService(createMockDb(), mockStore);
    // private_model is only supported in private_cloud and on_prem
    const result = service.buildMatrix({
        accountId: "acct_123",
        environment: "production",
        deploymentMode: "cloud_shared",
    });
    const privateModelEntry = result.report.entries.find(e => e.capabilityKey === "private_model");
    assert.ok(privateModelEntry);
    assert.equal(privateModelEntry.status, "blocked");
    assert.ok(privateModelEntry.reasonCodes.some(r => r.includes("deployment_mode_not_supported")));
});
test("EnterpriseCapabilityMatrixService summary counts are correct", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb(), createMockStore());
    const result = service.buildMatrix({
        environment: "production",
        deploymentMode: "cloud_shared",
    });
    assert.equal(result.report.summary.total, result.report.entries.length);
    assert.equal(result.report.summary.available +
        result.report.summary.degraded +
        result.report.summary.blocked, result.report.summary.total);
});
test("EnterpriseCapabilityMatrixService overall verdict is blocked when any blocked", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb(), createMockStore());
    const result = service.buildMatrix({
        environment: "production",
        deploymentMode: "cloud_shared",
    });
    // With community tier, enterprise features are blocked
    const blockedCount = result.report.entries.filter(e => e.status === "blocked").length;
    if (blockedCount > 0) {
        assert.equal(result.report.summary.overallVerdict, "blocked");
    }
});
test("EnterpriseCapabilityMatrixService evaluates readiness correctly", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ planId: "enterprise" });
    mockStore.release.getActiveEnvironmentReadinessRecord = () => ({
        readinessId: "read_123",
        environment: "production",
        componentType: "gateway",
        componentId: "identity_gateway",
        credentialReady: 1,
        secondaryGatesJson: JSON.stringify({ sso_ready: true }),
        owner: "team",
        lastVerifiedAt: new Date().toISOString(),
        isActive: 1,
        notes: null,
    });
    const service = new EnterpriseCapabilityMatrixService(createMockDb(), mockStore);
    const result = service.buildMatrix({
        accountId: "acct_123",
        environment: "production",
        deploymentMode: "cloud_shared",
    });
    const ssoEntry = result.report.entries.find(e => e.capabilityKey === "sso");
    assert.ok(ssoEntry);
    assert.equal(ssoEntry.status, "available");
});
test("EnterpriseCapabilityMatrixService handles missing readiness records", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => ({ planId: "enterprise" });
    // No readiness records returned
    const service = new EnterpriseCapabilityMatrixService(createMockDb(), mockStore);
    const result = service.buildMatrix({
        accountId: "acct_123",
        environment: "production",
        deploymentMode: "cloud_shared",
    });
    const ssoEntry = result.report.entries.find(e => e.capabilityKey === "sso");
    assert.ok(ssoEntry);
    assert.equal(ssoEntry.status, "degraded");
    assert.ok(ssoEntry.reasonCodes.some(r => r.includes("readiness_missing")));
});
test("EnterpriseCapabilityMatrixService listEnvironmentReadiness works", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb(), createMockStore());
    const records = service.listEnvironmentReadiness("production");
    assert.ok(Array.isArray(records));
});
test("EnterpriseCapabilityMatrixService listReports works", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb(), createMockStore());
    const reports = service.listReports(10);
    assert.ok(Array.isArray(reports));
});
test("EnterpriseCapabilityMatrixService buildMatrix validates generatedAt", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb(), createMockStore());
    const result = service.buildMatrix({
        environment: "production",
        deploymentMode: "cloud_shared",
        generatedAt: "2026-04-14T00:00:00.000Z",
    });
    assert.equal(result.report.generatedAt, "2026-04-14T00:00:00.000Z");
});
test("EnterpriseCapabilityMatrixService buildMatrix throws on invalid generatedAt", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb(), createMockStore());
    assert.throws(() => {
        service.buildMatrix({
            environment: "production",
            deploymentMode: "cloud_shared",
            generatedAt: "invalid-date",
        });
    });
});
test("EnterpriseCapabilityMatrixService registerEnvironmentReadiness validates componentId", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb(), createMockStore());
    assert.throws(() => {
        service.registerEnvironmentReadiness({
            environment: "production",
            componentType: "gateway",
            componentId: "invalid component id!", // Invalid characters
            credentialReady: true,
            owner: "team",
        });
    });
});
test("EnterpriseCapabilityMatrixService registerEnvironmentReadiness validates owner", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb(), createMockStore());
    assert.throws(() => {
        service.registerEnvironmentReadiness({
            environment: "production",
            componentType: "gateway",
            componentId: "gateway_1",
            credentialReady: true,
            owner: "invalid owner!", // Invalid characters
        });
    });
});
test("EnterpriseCapabilityMatrixService exports matrix", () => {
    const service = new EnterpriseCapabilityMatrixService(createMockDb(), createMockStore());
    const result = service.exportMatrix({
        environment: "production",
        deploymentMode: "cloud_shared",
    });
    assert.ok(result.jsonArtifact);
    assert.ok(result.markdownArtifact);
    assert.ok(result.report);
});
test("EnterpriseCapabilityMatrixService buildMatrix throws on non-existent account", () => {
    const mockStore = createMockStore();
    mockStore.billing.getBillingAccount = () => null;
    const service = new EnterpriseCapabilityMatrixService(createMockDb(), mockStore);
    assert.throws(() => {
        service.buildMatrix({
            accountId: "nonexistent_account",
            environment: "production",
            deploymentMode: "cloud_shared",
        });
    });
});
//# sourceMappingURL=enterprise-capability-matrix-service.test.js.map