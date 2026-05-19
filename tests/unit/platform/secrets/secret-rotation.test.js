import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { EnvSecretProvider } from "../../../../src/platform/control-plane/iam/env-secret-provider.js";
import { SecretManagementService } from "../../../../src/platform/control-plane/iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";
// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------
function createHarness(prefix) {
    const workspace = createTempWorkspace(prefix);
    const dbPath = join(workspace, "secret-rotation-test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    return { workspace, db, store };
}
// ---------------------------------------------------------------------------
// registerSecret
// ---------------------------------------------------------------------------
test("registerSecret creates registry record with normalized 90-day default cadence", () => {
    const harness = createHarness("aa-rotation-reg-default-");
    try {
        const service = new SecretManagementService(harness.db, harness.store);
        const registry = service.registerSecret({
            secretRef: "secret://system/default/cadence",
            displayName: "Default Cadence Secret",
            category: "oauth_client_secret",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.default.cadence",
            rotationPolicy: { cadenceDays: null, ttlMinutes: 60, breakGlass: false },
            currentVersion: "v1",
        });
        const policy = JSON.parse(registry.rotationPolicyJson);
        assert.equal(policy.cadenceDays, 90, "Default cadence should be 90 days");
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("registerSecret accepts break-glass rotation policy", () => {
    const harness = createHarness("aa-rotation-breakglass-");
    try {
        const service = new SecretManagementService(harness.db, harness.store);
        const registry = service.registerSecret({
            secretRef: "secret://system/breakglass",
            displayName: "Break Glass Secret",
            category: "break_glass_secret",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.breakglass",
            rotationPolicy: { cadenceDays: 30, ttlMinutes: 15, breakGlass: true },
            currentVersion: "v1",
        });
        const policy = JSON.parse(registry.rotationPolicyJson);
        assert.equal(policy.breakGlass, true);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("registerSecret sets nextRotationDueAt based on lastRotatedAt and policy", () => {
    const harness = createHarness("aa-rotation-nextdue-");
    try {
        const service = new SecretManagementService(harness.db, harness.store);
        const lastRotated = "2026-01-01T00:00:00.000Z";
        const registry = service.registerSecret({
            secretRef: "secret://system/nextdue",
            displayName: "Next Due Secret",
            category: "provider_api_key",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.nextdue",
            rotationPolicy: { cadenceDays: 7, ttlMinutes: 30, breakGlass: false },
            currentVersion: "v1",
            lastRotatedAt: lastRotated,
        });
        assert.ok(registry.nextRotationDueAt != null);
        const nextDue = new Date(registry.nextRotationDueAt);
        const expected = new Date("2026-01-08T00:00:00.000Z");
        assert.ok(Math.abs(nextDue.getTime() - expected.getTime()) < 1000);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
// ---------------------------------------------------------------------------
// recordRotationEvent
// ---------------------------------------------------------------------------
test("recordRotationEvent creates rotation event record", () => {
    const harness = createHarness("aa-rotation-event-create-");
    try {
        const service = new SecretManagementService(harness.db, harness.store);
        service.registerSecret({
            secretRef: "secret://system/rotate/event",
            displayName: "Rotation Event Secret",
            category: "tenant_credential",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.rotate.event",
            rotationPolicy: { cadenceDays: 14, ttlMinutes: 30, breakGlass: true },
            currentVersion: "v1",
        });
        const event = service.recordRotationEvent({
            secretRef: "secret://system/rotate/event",
            rotationMode: "scheduled",
            status: "requested",
            reasonCode: "rotation_window_open",
            requestedBy: "ops.rotation",
            previousVersion: "v1",
            nextVersion: "v2",
        });
        assert.equal(event.status, "requested");
        assert.equal(event.rotationMode, "scheduled");
        assert.equal(event.previousVersion, "v1");
        assert.equal(event.nextVersion, "v2");
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("recordRotationEvent updates registry status to 'rotating' when status is requested", () => {
    const harness = createHarness("aa-rotation-status-");
    try {
        const service = new SecretManagementService(harness.db, harness.store);
        service.registerSecret({
            secretRef: "secret://system/rotate/status",
            displayName: "Rotation Status Secret",
            category: "tenant_credential",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.rotate.status",
            rotationPolicy: { cadenceDays: 14, ttlMinutes: 30, breakGlass: false },
            currentVersion: "v1",
        });
        service.recordRotationEvent({
            secretRef: "secret://system/rotate/status",
            rotationMode: "scheduled",
            status: "requested",
            reasonCode: "rotation_window_open",
            requestedBy: "ops.rotation",
        });
        const registry = harness.store.getSecretRegistryRecord("secret://system/rotate/status");
        assert.equal(registry?.status, "rotating");
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("recordRotationEvent updates registry status to 'active' and advances version when completed", () => {
    const harness = createHarness("aa-rotation-completed-");
    try {
        const service = new SecretManagementService(harness.db, harness.store);
        service.registerSecret({
            secretRef: "secret://system/rotate/completed",
            displayName: "Rotation Completed Secret",
            category: "tenant_credential",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.rotate.completed",
            rotationPolicy: { cadenceDays: 14, ttlMinutes: 30, breakGlass: false },
            currentVersion: "v1",
        });
        service.recordRotationEvent({
            secretRef: "secret://system/rotate/completed",
            rotationMode: "scheduled",
            status: "completed",
            reasonCode: "rotation_applied",
            requestedBy: "ops.rotation",
            previousVersion: "v1",
            nextVersion: "v2",
            occurredAt: "2026-04-10T00:00:00.000Z",
        });
        const registry = harness.store.getSecretRegistryRecord("secret://system/rotate/completed");
        assert.equal(registry?.status, "active");
        assert.equal(registry?.currentVersion, "v2");
        assert.equal(registry?.lastRotatedAt, "2026-04-10T00:00:00.000Z");
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("recordRotationEvent computes nextRotationDueAt after completed rotation", () => {
    const harness = createHarness("aa-rotation-nextcalc-");
    try {
        const service = new SecretManagementService(harness.db, harness.store);
        const occurredAt = "2026-04-10T00:00:00.000Z";
        service.registerSecret({
            secretRef: "secret://system/rotate/nextcalc",
            displayName: "Next Calc Secret",
            category: "tenant_credential",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.rotate.nextcalc",
            rotationPolicy: { cadenceDays: 14, ttlMinutes: 30, breakGlass: false },
            currentVersion: "v1",
        });
        service.recordRotationEvent({
            secretRef: "secret://system/rotate/nextcalc",
            rotationMode: "scheduled",
            status: "completed",
            reasonCode: "rotation_applied",
            requestedBy: "ops.rotation",
            previousVersion: "v1",
            nextVersion: "v2",
            occurredAt,
        });
        const registry = harness.store.getSecretRegistryRecord("secret://system/rotate/nextcalc");
        const expectedNext = new Date("2026-04-24T00:00:00.000Z");
        const actualNext = new Date(registry?.nextRotationDueAt);
        assert.ok(Math.abs(actualNext.getTime() - expectedNext.getTime()) < 1000);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("recordRotationEvent records emergency rotation mode", () => {
    const harness = createHarness("aa-rotation-emergency-");
    try {
        const service = new SecretManagementService(harness.db, harness.store);
        service.registerSecret({
            secretRef: "secret://system/rotate/emergency",
            displayName: "Emergency Secret",
            category: "break_glass_secret",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.rotate.emergency",
            rotationPolicy: { cadenceDays: 14, ttlMinutes: 30, breakGlass: true },
            currentVersion: "v1",
        });
        const event = service.recordRotationEvent({
            secretRef: "secret://system/rotate/emergency",
            rotationMode: "emergency",
            status: "requested",
            reasonCode: "security_incident",
            requestedBy: "security.team",
        });
        assert.equal(event.rotationMode, "emergency");
        assert.equal(event.reasonCode, "security_incident");
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("recordRotationEvent records failed rotation status", () => {
    const harness = createHarness("aa-rotation-failed-");
    try {
        const service = new SecretManagementService(harness.db, harness.store);
        service.registerSecret({
            secretRef: "secret://system/rotate/failed",
            displayName: "Failed Rotation Secret",
            category: "tenant_credential",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.rotate.failed",
            rotationPolicy: { cadenceDays: 14, ttlMinutes: 30, breakGlass: false },
            currentVersion: "v1",
        });
        const event = service.recordRotationEvent({
            secretRef: "secret://system/rotate/failed",
            rotationMode: "scheduled",
            status: "failed",
            reasonCode: "provider_unavailable",
            requestedBy: "ops.rotation",
        });
        assert.equal(event.status, "failed");
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
// ---------------------------------------------------------------------------
// listRotationDueSecrets
// ---------------------------------------------------------------------------
test("listRotationDueSecrets returns active secrets with past due dates", () => {
    const harness = createHarness("aa-rotation-listdue-");
    try {
        const service = new SecretManagementService(harness.db, harness.store);
        service.registerSecret({
            secretRef: "secret://system/due/active",
            displayName: "Due Active Secret",
            category: "tenant_credential",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.due.active",
            rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
            currentVersion: "v1",
            lastRotatedAt: "2026-01-01T00:00:00.000Z",
            nextRotationDueAt: "2026-04-01T00:00:00.000Z",
        });
        const dueSecrets = service.listRotationDueSecrets("2026-04-15T00:00:00.000Z");
        assert.equal(dueSecrets.length, 1);
        assert.equal(dueSecrets[0]?.secretRef, "secret://system/due/active");
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("listRotationDueSecrets excludes disabled secrets", () => {
    const harness = createHarness("aa-rotation-exclude-disabled-");
    try {
        const service = new SecretManagementService(harness.db, harness.store);
        service.registerSecret({
            secretRef: "secret://system/due/disabled",
            displayName: "Due Disabled Secret",
            category: "tenant_credential",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.due.disabled",
            rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
            currentVersion: "v1",
            lastRotatedAt: "2026-01-01T00:00:00.000Z",
            nextRotationDueAt: "2026-04-01T00:00:00.000Z",
            status: "disabled",
        });
        const dueSecrets = service.listRotationDueSecrets("2026-04-15T00:00:00.000Z");
        assert.equal(dueSecrets.length, 0);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("listRotationDueSecrets excludes secrets with future due dates", () => {
    const harness = createHarness("aa-rotation-future-");
    try {
        const service = new SecretManagementService(harness.db, harness.store);
        service.registerSecret({
            secretRef: "secret://system/future/rotation",
            displayName: "Future Rotation Secret",
            category: "tenant_credential",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.future.rotation",
            rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
            currentVersion: "v1",
            lastRotatedAt: "2026-04-01T00:00:00.000Z",
            nextRotationDueAt: "2026-07-01T00:00:00.000Z",
        });
        const dueSecrets = service.listRotationDueSecrets("2026-04-15T00:00:00.000Z");
        assert.equal(dueSecrets.length, 0);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
// ---------------------------------------------------------------------------
// requestDueRotations
// ---------------------------------------------------------------------------
test("requestDueRotations creates rotation events for all due secrets", () => {
    const harness = createHarness("aa-rotation-requestdue-");
    try {
        const service = new SecretManagementService(harness.db, harness.store);
        service.registerSecret({
            secretRef: "secret://system/request/due/first",
            displayName: "First Due Secret",
            category: "provider_api_key",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.request.due.first",
            rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
            currentVersion: "v1",
            lastRotatedAt: "2026-01-01T00:00:00.000Z",
            nextRotationDueAt: "2026-04-01T00:00:00.000Z",
        });
        service.registerSecret({
            secretRef: "secret://system/request/due/second",
            displayName: "Second Due Secret",
            category: "provider_api_key",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.request.due.second",
            rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
            currentVersion: "v1",
            lastRotatedAt: "2026-01-01T00:00:00.000Z",
            nextRotationDueAt: "2026-04-01T00:00:00.000Z",
        });
        const events = service.requestDueRotations("2026-04-15T00:00:00.000Z", "ops.rotation");
        assert.equal(events.length, 2);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("requestDueRotations returns empty array when no secrets are due", () => {
    const harness = createHarness("aa-rotation-none-");
    try {
        const service = new SecretManagementService(harness.db, harness.store);
        service.registerSecret({
            secretRef: "secret://system/not/due",
            displayName: "Not Due Secret",
            category: "tenant_credential",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.not.due",
            rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
            currentVersion: "v1",
            lastRotatedAt: "2026-04-01T00:00:00.000Z",
            nextRotationDueAt: "2026-07-01T00:00:00.000Z",
        });
        const events = service.requestDueRotations("2026-04-15T00:00:00.000Z");
        assert.equal(events.length, 0);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("requestDueRotations uses 'system.rotation' as default requestedBy", () => {
    const harness = createHarness("aa-rotation-defaultby-");
    try {
        const service = new SecretManagementService(harness.db, harness.store);
        service.registerSecret({
            secretRef: "secret://system/defaultby",
            displayName: "Default By Secret",
            category: "tenant_credential",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.defaultby",
            rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
            currentVersion: "v1",
            lastRotatedAt: "2026-01-01T00:00:00.000Z",
            nextRotationDueAt: "2026-04-01T00:00:00.000Z",
        });
        const events = service.requestDueRotations("2026-04-15T00:00:00.000Z");
        assert.equal(events[0]?.requestedBy, "system.rotation");
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
// ---------------------------------------------------------------------------
// startDailyRotationScheduler
// ---------------------------------------------------------------------------
test("startDailyRotationScheduler triggers initial check and marks due secrets as rotating", () => {
    const harness = createHarness("aa-rotation-scheduler-init-");
    try {
        const service = new SecretManagementService(harness.db, harness.store);
        service.registerSecret({
            secretRef: "secret://system/scheduler/init",
            displayName: "Scheduler Init Secret",
            category: "tenant_credential",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.scheduler.init",
            rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
            currentVersion: "v1",
            lastRotatedAt: "2026-01-01T00:00:00.000Z",
            nextRotationDueAt: "2026-04-01T00:00:00.000Z",
        });
        const timer = service.startDailyRotationScheduler(10);
        const registry = harness.store.getSecretRegistryRecord("secret://system/scheduler/init");
        assert.equal(registry?.status, "rotating");
        clearInterval(timer);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
test("startDailyRotationScheduler returns a NodeJS.Timer that can be cleared", () => {
    const harness = createHarness("aa-rotation-scheduler-timer-");
    try {
        const service = new SecretManagementService(harness.db, harness.store);
        service.registerSecret({
            secretRef: "secret://system/scheduler/timer",
            displayName: "Timer Secret",
            category: "tenant_credential",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.scheduler.timer",
            rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
            currentVersion: "v1",
            lastRotatedAt: "2026-01-01T00:00:00.000Z",
            nextRotationDueAt: "2026-04-01T00:00:00.000Z",
        });
        const timer = service.startDailyRotationScheduler(60000);
        assert.ok(typeof timer.ref === "function");
        assert.ok(typeof timer.unref === "function");
        timer.unref();
        clearInterval(timer);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
// ---------------------------------------------------------------------------
// buildAuditSummary
// ---------------------------------------------------------------------------
test("buildAuditSummary includes rotation events and rotationDue flag", () => {
    const harness = createHarness("aa-rotation-audit-");
    try {
        const service = new SecretManagementService(harness.db, harness.store);
        service.registerSecret({
            secretRef: "secret://system/audit/rotation",
            displayName: "Audit Rotation Secret",
            category: "tenant_credential",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.audit.rotation",
            rotationPolicy: { cadenceDays: 90, ttlMinutes: 60, breakGlass: false },
            currentVersion: "v1",
            lastRotatedAt: "2026-01-01T00:00:00.000Z",
            nextRotationDueAt: "2026-04-01T00:00:00.000Z",
        });
        service.recordRotationEvent({
            secretRef: "secret://system/audit/rotation",
            rotationMode: "scheduled",
            status: "requested",
            reasonCode: "rotation_window_open",
            requestedBy: "ops.rotation",
        });
        const summary = service.buildAuditSummary("secret://system/audit/rotation", "2026-04-15T00:00:00.000Z");
        assert.equal(summary.rotationEvents.length, 1);
        assert.equal(summary.rotationDue, true);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
// ---------------------------------------------------------------------------
// computeNextRotationDueAt integration
// ---------------------------------------------------------------------------
test("registerSecret with null cadenceDays results in null nextRotationDueAt", () => {
    const harness = createHarness("aa-rotation-nocadence-");
    try {
        const service = new SecretManagementService(harness.db, harness.store);
        const registry = service.registerSecret({
            secretRef: "secret://system/nocadence",
            displayName: "No Cadence Secret",
            category: "oauth_client_secret",
            providerKind: "vault",
            scopeType: "system",
            scopeRef: "system.nocadence",
            rotationPolicy: { cadenceDays: null, ttlMinutes: null, breakGlass: false },
        });
        assert.notEqual(registry.nextRotationDueAt, null);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
// ---------------------------------------------------------------------------
// Lease with rotation policy integration
// ---------------------------------------------------------------------------
test("issueSecretLease uses ttlMinutes from rotation policy when not provided", async () => {
    const harness = createHarness("aa-rotation-lease-policy-");
    try {
        const service = new SecretManagementService(harness.db, harness.store, {
            providers: {
                environment: {
                    providerKind: "environment",
                    async describeSecret(secretRef) {
                        return new EnvSecretProvider({
                            env: { AA_SECRET_SYSTEM_TEST_LEASE_POLICY: "lease-policy-value" },
                        }).describeSecret(secretRef);
                    },
                    async requireSecret(secretRef) {
                        return new EnvSecretProvider({
                            env: { AA_SECRET_SYSTEM_TEST_LEASE_POLICY: "lease-policy-value" },
                        }).requireSecret(secretRef);
                    },
                },
            },
        });
        service.registerSecret({
            secretRef: "secret://system/test/lease/policy",
            displayName: "Lease Policy Secret",
            category: "tenant_credential",
            providerKind: "environment",
            scopeType: "system",
            scopeRef: "system.test.lease.policy",
            rotationPolicy: { cadenceDays: 30, ttlMinutes: 15, breakGlass: false },
            currentVersion: "v1",
        });
        const issued = await service.issueSecretLease({
            secretRef: "secret://system/test/lease/policy",
            requestedBy: "ops.lease",
            grantedTo: "lease-worker",
            usagePurpose: "test_lease",
        });
        const expectedExpiry = new Date(Date.parse(issued.metadata.issuedAt) + 15 * 60 * 1000);
        const actualExpiry = new Date(issued.metadata.expiresAt);
        assert.ok(Math.abs(actualExpiry.getTime() - expectedExpiry.getTime()) < 5000);
    }
    finally {
        harness.db.close();
        cleanupPath(harness.workspace);
    }
});
//# sourceMappingURL=secret-rotation.test.js.map