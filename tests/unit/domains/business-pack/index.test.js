import assert from "node:assert/strict";
import test from "node:test";
import { BusinessPackManifestSchema, isValidLifecycleTransition, validateBusinessPackManifest, } from "../../../../src/domains/business-pack/index.js";
test("BusinessPackManifestSchema parses valid manifest with required fields", () => {
    const manifest = BusinessPackManifestSchema.parse({
        packId: "test-pack",
        name: "Test Pack",
        version: "1.0.0",
        domainId: "testing",
    });
    assert.equal(manifest.packId, "test-pack");
    assert.equal(manifest.name, "Test Pack");
    assert.equal(manifest.version, "1.0.0");
    assert.equal(manifest.domainId, "testing");
    assert.equal(manifest.lifecycleStage, "draft");
    assert.equal(manifest.failureStrategy, "fail_fast");
});
test("BusinessPackManifestSchema parses full manifest with all optional fields", () => {
    const manifest = BusinessPackManifestSchema.parse({
        packId: "enterprise-pack",
        name: "Enterprise Pack",
        version: "2.0.0",
        domainId: "enterprise",
        description: "Enterprise capabilities",
        lifecycleStage: "published",
        riskMatrix: [
            { riskId: "risk-1", level: "high", triggers: ["data_loss"], mitigation: "backup", escalationPolicy: "notify" },
        ],
        toolBundles: ["tool-1", "tool-2"],
        dependencies: [
            { packId: "base-pack", versionRange: ">=1.0.0", optional: false, reason: "core functionality" },
        ],
        approvalPoints: [
            {
                pointId: "ap-1",
                name: "Security Review",
                description: "Security approval required",
                triggerCondition: "risk=high",
                requiredApprovals: 2,
                approverRoles: ["security_admin"],
                timeoutMinutes: 120,
                autoApproveRoles: [],
            },
        ],
        artifactTypes: ["code", "document"],
        knowledgeNamespaces: ["ns-1"],
        failureStrategy: "continue",
        rollbackCapability: true,
        domainMetrics: [
            {
                metricId: "executions",
                name: "Executions",
                description: "Number of executions",
                unit: "count",
                aggregation: "sum",
            },
        ],
        sandboxTier: "container",
        permissions: [
            { permission: "workflow:execute", level: "write", justification: "required for execution" },
        ],
        author: "Test Author",
        tags: ["enterprise", "automation"],
    });
    assert.equal(manifest.packId, "enterprise-pack");
    assert.equal(manifest.lifecycleStage, "published");
    assert.equal(manifest.riskMatrix.length, 1);
    assert.equal(manifest.dependencies.length, 1);
    assert.equal(manifest.approvalPoints.length, 1);
    assert.equal(manifest.sandboxTier, "workspace_write");
});
test("BusinessPackManifestSchema uses canonical defaults for optional fields", () => {
    const manifest = BusinessPackManifestSchema.parse({
        packId: "minimal-pack",
        name: "Minimal Pack",
        version: "1.0.0",
        domainId: "test",
    });
    assert.equal(manifest.lifecycleStage, "draft");
    assert.equal(manifest.description, "");
    assert.equal(manifest.riskMatrix.length, 0);
    assert.equal(manifest.toolBundles.length, 0);
    assert.equal(manifest.pluginIds.length, 0);
    assert.equal(manifest.dependencies.length, 0);
    assert.equal(manifest.approvalPoints.length, 0);
    assert.equal(manifest.artifactTypes.length, 0);
    assert.equal(manifest.knowledgeNamespaces.length, 0);
    assert.equal(manifest.failureStrategy, "fail_fast");
    assert.equal(manifest.rollbackCapability, false);
    assert.equal(manifest.domainMetrics.length, 0);
    assert.equal(manifest.sandboxTier, "read_only");
    assert.equal(manifest.permissions.length, 0);
    assert.equal(manifest.author, "");
    assert.equal(manifest.tags.length, 0);
});
test("BusinessPackManifestSchema rejects invalid version format", () => {
    assert.throws(() => BusinessPackManifestSchema.parse({
        packId: "invalid-version",
        name: "Test",
        version: "1.0",
        domainId: "test",
    }));
    assert.throws(() => BusinessPackManifestSchema.parse({
        packId: "invalid-version",
        name: "Test",
        version: "v1.0.0",
        domainId: "test",
    }));
});
test("isValidLifecycleTransition validates transitions correctly", () => {
    assert.equal(isValidLifecycleTransition("draft", "certifying"), true);
    assert.equal(isValidLifecycleTransition("certifying", "published"), true);
    assert.equal(isValidLifecycleTransition("published", "deprecated"), true);
    assert.equal(isValidLifecycleTransition("deprecated", "published"), true);
    assert.equal(isValidLifecycleTransition("draft", "published"), false);
    assert.equal(isValidLifecycleTransition("published", "draft"), false);
    assert.equal(isValidLifecycleTransition("archived", "draft"), false);
    assert.equal(isValidLifecycleTransition("archived", "published"), false);
});
test("validateBusinessPackManifest returns valid result for correct manifest", () => {
    const manifest = {
        packId: "valid-pack",
        name: "Valid Pack",
        version: "1.0.0",
        domainId: "testing",
        lifecycleStage: "draft",
        deprecatedAt: null,
        archivedAt: null,
        riskMatrix: [],
        toolBundles: [],
        pluginIds: [],
        dependencies: [],
        approvalPoints: [],
        artifactTypes: [],
        knowledgeNamespaces: [],
        failureStrategy: "continue",
        rollbackCapability: true,
        domainMetrics: [],
        sandboxTier: "container",
        permissions: [],
        author: "",
        tags: [],
        createdAt: "2026-04-20T00:00:00.000Z",
        updatedAt: "2026-04-20T00:00:00.000Z",
    };
    const result = validateBusinessPackManifest(manifest);
    assert.equal(result.valid, true);
    assert.equal(result.issues.filter(i => i.severity === "error").length, 0);
});
test("validateBusinessPackManifest returns errors for missing name", () => {
    const manifest = {
        packId: "test-pack",
        name: "",
        version: "1.0.0",
        domainId: "testing",
        lifecycleStage: "draft",
        deprecatedAt: null,
        archivedAt: null,
        riskMatrix: [],
        toolBundles: [],
        pluginIds: [],
        dependencies: [],
        approvalPoints: [],
        artifactTypes: [],
        knowledgeNamespaces: [],
        failureStrategy: "continue",
        rollbackCapability: true,
        domainMetrics: [],
        sandboxTier: "container",
        permissions: [],
        author: "",
        tags: [],
        createdAt: "",
        updatedAt: "",
    };
    const result = validateBusinessPackManifest(manifest);
    assert.equal(result.valid, false);
    assert.ok(result.issues.some(i => i.field === "name" && i.code === "manifest.missing_name"));
});
test("validateBusinessPackManifest checks sandbox tier for critical risk", () => {
    const manifest = {
        packId: "critical-pack",
        name: "Critical Pack",
        version: "1.0.0",
        domainId: "test",
        sandboxTier: "none",
        riskMatrix: [
            { riskId: "r1", level: "critical", triggers: [], mitigation: "", escalationPolicy: "" },
        ],
        permissions: [],
        toolBundles: [],
        pluginIds: [],
        dependencies: [],
        approvalPoints: [],
        artifactTypes: [],
        knowledgeNamespaces: [],
        failureStrategy: "fail_fast",
        rollbackCapability: false,
        domainMetrics: [],
        author: "",
        tags: [],
        createdAt: "",
        updatedAt: "",
        lifecycleStage: "draft",
        deprecatedAt: null,
        archivedAt: null,
    };
    const result = validateBusinessPackManifest(manifest);
    assert.ok(result.issues.some(i => i.code === "manifest.insecure_sandbox_tier"));
});
test("type exports are usable", () => {
    const stage = "draft";
    assert.equal(stage, "draft");
    const riskLevel = "medium";
    assert.equal(riskLevel, "medium");
    const approvalPoint = {
        pointId: "ap-1",
        name: "Test Approval",
        description: "Test",
        triggerCondition: "always",
        requiredApprovals: 1,
        approverRoles: ["admin"],
        timeoutMinutes: 60,
        autoApproveRoles: [],
    };
    assert.equal(approvalPoint.pointId, "ap-1");
    const metric = {
        metricId: "uptime",
        name: "Uptime",
        description: "System uptime",
        unit: "percent",
        aggregation: "avg",
    };
    assert.equal(metric.metricId, "uptime");
    const dependency = {
        packId: "base-pack",
        versionRange: ">=1.0.0",
        optional: false,
        reason: "required",
    };
    assert.equal(dependency.packId, "base-pack");
    const permission = {
        permission: "workflow:execute",
        level: "write",
        justification: "required for automation",
    };
    assert.equal(permission.permission, "workflow:execute");
    const riskEntry = {
        riskId: "risk-1",
        level: "high",
        triggers: ["data_loss"],
        mitigation: "backup",
        escalationPolicy: "notify",
    };
    assert.equal(riskEntry.level, "high");
    const sandboxTier = "workspace_write";
    assert.equal(sandboxTier, "workspace_write");
    const transition = {
        from: "draft",
        to: "certifying",
        allowed: true,
    };
    assert.equal(transition.from, "draft");
    assert.equal(transition.allowed, true);
    const validationIssue = {
        code: "test.error",
        field: "testField",
        message: "Test error",
        severity: "error",
    };
    assert.equal(validationIssue.field, "testField");
    const validationResult = {
        valid: true,
        issues: [],
    };
    assert.equal(validationResult.valid, true);
});
test("BusinessPackManifest type is correctly typed", () => {
    const manifest = {
        packId: "typed-pack",
        name: "Typed Pack",
        version: "1.0.0",
        domainId: "test",
        lifecycleStage: "draft",
        deprecatedAt: null,
        archivedAt: null,
        riskMatrix: [],
        toolBundles: [],
        pluginIds: [],
        dependencies: [],
        approvalPoints: [],
        artifactTypes: [],
        knowledgeNamespaces: [],
        failureStrategy: "fail_fast",
        rollbackCapability: false,
        domainMetrics: [],
        sandboxTier: "process",
        permissions: [],
        author: "",
        tags: [],
        createdAt: "",
        updatedAt: "",
    };
    assert.equal(manifest.packId, "typed-pack");
});
//# sourceMappingURL=index.test.js.map