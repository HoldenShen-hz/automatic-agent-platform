import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { EnterpriseCapabilityMatrixService } from "../../../../src/scale-ecosystem/marketplace/enterprise-capability-matrix-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
function createServiceHarness(prefix) {
    const workspace = createTempWorkspace(prefix);
    const dbPath = join(workspace, "enterprise.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new EnterpriseCapabilityMatrixService(db, store, {
        artifactStoreOptions: {
            rootDir: join(workspace, "artifacts"),
        },
    });
    return {
        workspace,
        db,
        store,
        service,
    };
}
test("enterprise capability matrix reports available enterprise capabilities when readiness is complete", () => {
    const harness = createServiceHarness("aa-enterprise-unit-");
    try {
        harness.store.upsertBillingAccount({
            accountId: "acct-enterprise-1",
            ownerId: "owner-1",
            workspaceId: "workspace-1",
            planId: "enterprise",
            status: "active",
            createdAt: nowIso(),
            updatedAt: nowIso(),
        });
        const readinessInputs = [
            ["gateway", "ops_gateway", {}],
            ["artifact_store", "audit_export_store", {}],
            ["external_service", "audit_export_pipeline", { export_ready: true }],
            ["gateway", "identity_gateway", { sso_ready: true }],
            ["external_service", "scim_bridge", { scim_ready: true }],
            ["worker_fleet", "tenant_scoped_workers", {}],
            ["artifact_store", "tenant_scoped_artifacts", { namespace_ready: true }],
            ["provider", "private_model_provider", {}],
            ["sandbox", "private_network_boundary", { network_ready: true }],
            ["worker_fleet", "enterprise_worker_fleet", {}],
            ["artifact_store", "release_artifacts", { artifact_namespace_ready: true }],
            ["gateway", "incident_console_gateway", {}],
            ["notification_channel", "oncall_notifications", { webhook_ready: true }],
            ["artifact_store", "residency_store", { artifact_namespace_ready: true }],
            ["external_service", "residency_controls", { attestation_ready: true }],
        ];
        for (const [componentType, componentId, secondaryGates] of readinessInputs) {
            harness.service.registerEnvironmentReadiness({
                environment: "prod",
                componentType,
                componentId,
                credentialReady: true,
                secondaryGates,
                owner: "ops.team",
            });
        }
        const result = harness.service.buildMatrix({
            accountId: "acct-enterprise-1",
            environment: "prod",
            deploymentMode: "private_cloud",
        });
        assert.equal(result.report.tier, "enterprise");
        assert.equal(result.report.summary.blocked, 0);
        assert.equal(result.report.summary.degraded, 0);
        assert.equal(result.report.summary.overallVerdict, "ready");
        assert.equal(result.report.entries.length >= 9, true);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("enterprise capability matrix blocks enterprise-only capabilities for professional plans", () => {
    const harness = createServiceHarness("aa-enterprise-unit-");
    try {
        harness.store.upsertBillingAccount({
            accountId: "acct-pro-1",
            ownerId: "owner-1",
            workspaceId: "workspace-1",
            planId: "pro",
            status: "active",
            createdAt: nowIso(),
            updatedAt: nowIso(),
        });
        harness.service.registerEnvironmentReadiness({
            environment: "staging",
            componentType: "gateway",
            componentId: "ops_gateway",
            credentialReady: true,
            owner: "ops.team",
        });
        const result = harness.service.buildMatrix({
            accountId: "acct-pro-1",
            environment: "staging",
            deploymentMode: "cloud_shared",
        });
        const sso = result.report.entries.find((entry) => entry.capabilityKey === "sso");
        const admin = result.report.entries.find((entry) => entry.capabilityKey === "admin_console");
        assert.equal(admin?.status, "available");
        assert.equal(sso?.status, "blocked");
        assert.ok(sso?.reasonCodes.some((code) => code.startsWith("license_tier_below_requirement")));
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("enterprise readiness registration validates identifiers", () => {
    const harness = createServiceHarness("aa-enterprise-unit-");
    try {
        assert.throws(() => harness.service.registerEnvironmentReadiness({
            environment: "prod",
            componentType: "provider",
            componentId: "../bad",
            credentialReady: true,
            owner: "ops.team",
        }), /enterprise\.invalid_component_id/);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
//# sourceMappingURL=enterprise-capability-matrix-service.test.js.map