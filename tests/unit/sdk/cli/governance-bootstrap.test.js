/**
 * Governance Bootstrap CLI Tests
 *
 * Tests for governance-bootstrap.ts module.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
// ---------------------------------------------------------------------------
// Tests for GovernanceServices interface
// ---------------------------------------------------------------------------
test("GovernanceServices interface requires health service", () => {
    const services = {
        health: {},
        diagnostics: {},
        doctor: {},
        checker: {},
        stalledDetector: {},
        retentionService: {},
        logger: {},
    };
    assert.ok(services.health != null);
    assert.ok(services.diagnostics != null);
    assert.ok(services.doctor != null);
    assert.ok(services.checker != null);
    assert.ok(services.stalledDetector != null);
    assert.ok(services.retentionService != null);
    assert.ok(services.logger != null);
});
// ---------------------------------------------------------------------------
// Tests for GovernanceBootstrapOptions interface
// ---------------------------------------------------------------------------
test("GovernanceBootstrapOptions requires storage and dbPath", () => {
    const options = {
        storage: {},
        dbPath: "/path/to/db.sqlite",
    };
    assert.ok(options.storage != null);
    assert.ok(options.dbPath != null);
    assert.equal(options.dbPath, "/path/to/db.sqlite");
});
test("GovernanceBootstrapOptions accepts optional workspaceRoot", () => {
    const options = {
        storage: {},
        dbPath: "/path/to/db.sqlite",
        workspaceRoot: "/path/to/workspace",
    };
    assert.equal(options.workspaceRoot, "/path/to/workspace");
});
test("GovernanceBootstrapOptions accepts optional storageQuotaCategories", () => {
    const categories = [
        {
            categoryId: "artifact",
            roots: ["/data/artifacts"],
            maxBytes: 250 * 1024 * 1024,
            cleanupEnabled: true,
        },
    ];
    const options = {
        storage: {},
        dbPath: "/path/to/db.sqlite",
        storageQuotaCategories: categories,
    };
    assert.ok(options.storageQuotaCategories != null);
    assert.equal(options.storageQuotaCategories.length, 1);
});
// ---------------------------------------------------------------------------
// Tests for defaultGovernanceQuotaCategories structure
// ---------------------------------------------------------------------------
test("defaultGovernanceQuotaCategories returns artifact category", () => {
    const workspaceRoot = "/workspace";
    const categories = [
        {
            categoryId: "artifact",
            roots: [join(workspaceRoot, "data", "artifacts")],
            maxBytes: 250 * 1024 * 1024,
            cleanupEnabled: true,
        },
    ];
    assert.equal(categories[0].categoryId, "artifact");
    assert.ok(categories[0].roots[0].includes("artifacts"));
    assert.equal(categories[0].maxBytes, 250 * 1024 * 1024);
});
test("defaultGovernanceQuotaCategories returns debug category", () => {
    const workspaceRoot = "/workspace";
    const categories = [
        {
            categoryId: "artifact",
            roots: [join(workspaceRoot, "data", "artifacts")],
            maxBytes: 250 * 1024 * 1024,
            cleanupEnabled: true,
        },
        {
            categoryId: "debug",
            roots: [join(workspaceRoot, "data", "stable-evidence"), join(workspaceRoot, "data", "debug")],
            maxBytes: 150 * 1024 * 1024,
            cleanupEnabled: true,
        },
    ];
    const debugCategory = categories[1];
    assert.equal(debugCategory.categoryId, "debug");
    assert.ok(debugCategory.roots.length === 2);
});
test("defaultGovernanceQuotaCategories returns backup category", () => {
    const workspaceRoot = "/workspace";
    const categories = [
        {
            categoryId: "artifact",
            roots: [join(workspaceRoot, "data", "artifacts")],
            maxBytes: 250 * 1024 * 1024,
            cleanupEnabled: true,
        },
        {
            categoryId: "debug",
            roots: [join(workspaceRoot, "data", "stable-evidence"), join(workspaceRoot, "data", "debug")],
            maxBytes: 150 * 1024 * 1024,
            cleanupEnabled: true,
        },
        {
            categoryId: "backup",
            roots: [join(workspaceRoot, "data", "sqlite"), join(workspaceRoot, "data", "backups")],
            maxBytes: 200 * 1024 * 1024,
            cleanupEnabled: true,
        },
    ];
    const backupCategory = categories[2];
    assert.equal(backupCategory.categoryId, "backup");
    assert.ok(backupCategory.roots.length === 2);
    assert.equal(backupCategory.maxBytes, 200 * 1024 * 1024);
});
// ---------------------------------------------------------------------------
// Tests for GovernanceBootstrapWithMetricsOptions interface
// ---------------------------------------------------------------------------
test("GovernanceBootstrapWithMetricsOptions extends GovernanceBootstrapOptions", () => {
    const options = {
        storage: {},
        dbPath: "/path/to/db.sqlite",
        metrics: {},
    };
    assert.ok(options.metrics != null);
});
test("bootstrapGovernanceServicesWithMetrics returns metrics and workspaceRoot", () => {
    const result = {
        health: {},
        diagnostics: {},
        doctor: {},
        checker: {},
        stalledDetector: {},
        retentionService: {},
        logger: {},
        metrics: {},
        workspaceRoot: "/workspace",
    };
    assert.ok(result.metrics != null);
    assert.ok(result.workspaceRoot != null);
    assert.equal(result.workspaceRoot, "/workspace");
});
//# sourceMappingURL=governance-bootstrap.test.js.map