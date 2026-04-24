import test from "node:test";
import assert from "node:assert";
import {
  type BusinessPackManifest,
  type ManifestValidationResult,
  type ManifestValidationIssue,
  BusinessPackManifestSchema,
  isValidLifecycleTransition,
  isExecutableStage,
  isTerminalStage,
  transitionLifecycle,
  validateBusinessPackManifest,
  type BusinessPackLifecycleStage,
} from "../../../../src/domains/business-pack/business-pack-manifest.js";

test("BusinessPackManifestSchema parses a valid minimal manifest", () => {
  const manifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
  };

  const result = BusinessPackManifestSchema.safeParse(manifest);

  assert.ok(result.success, "Valid manifest should parse successfully");
  if (result.success) {
    assert.strictEqual(result.data.packId, "pack-001");
    assert.strictEqual(result.data.lifecycleStage, "draft");
    assert.deepStrictEqual(result.data.riskMatrix, []);
    assert.deepStrictEqual(result.data.toolBundles, []);
  }
});

test("BusinessPackManifestSchema parses a full manifest with all fields", () => {
  const manifest = {
    packId: "pack-002",
    name: "Full Pack",
    version: "1.0.0",
    domainId: "domain-001",
    description: "A fully featured pack",
    lifecycleStage: "published",
    riskMatrix: [
      {
        riskId: "risk-001",
        level: "high",
        triggers: ["concurrent_access", "large_data"],
        mitigation: "Use container sandbox",
        escalationPolicy: "alert_oncall",
      },
    ],
    toolBundles: ["tool-bundle-1"],
    pluginIds: ["plugin-1"],
    dependencies: [
      { packId: "pack-001", versionRange: ">=1.0.0", optional: true, reason: "Optional enhancement" },
    ],
    approvalPoints: [
      {
        pointId: "approval-001",
        name: "Security Review",
        description: "Security team approval",
        triggerCondition: "risk_level >= high",
        requiredApprovals: 2,
        approverRoles: ["security-admin", "security-reviewer"],
        timeoutMinutes: 120,
        autoApproveRoles: ["security-admin"],
      },
    ],
    artifactTypes: ["code", "document"],
    knowledgeNamespaces: ["kb:engineering"],
    failureStrategy: "fallback",
    rollbackCapability: true,
    domainMetrics: [
      {
        metricId: "metric-001",
        name: "Execution Count",
        description: "Number of executions",
        unit: "count",
        aggregation: "sum",
        threshold: { warning: 1000, critical: 5000 },
      },
    ],
    sandboxTier: "container",
    permissions: [
      { permission: "user:read", level: "read", justification: "Required for user data access" },
      { permission: "user:admin", level: "admin", justification: "Needed for user provisioning" },
    ],
    author: "team-engineering",
    tags: ["production", "verified"],
  };

  const result = BusinessPackManifestSchema.safeParse(manifest);

  assert.ok(result.success, "Full manifest should parse successfully");
  if (result.success) {
    assert.strictEqual(result.data.lifecycleStage, "published");
    assert.strictEqual(result.data.riskMatrix.length, 1);
    assert.strictEqual(result.data.dependencies.length, 1);
    assert.strictEqual(result.data.approvalPoints.length, 1);
    assert.strictEqual(result.data.domainMetrics.length, 1);
    assert.strictEqual(result.data.sandboxTier, "container");
  }
});

test("BusinessPackManifestSchema rejects invalid semver version", () => {
  const manifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0", // Invalid - should be 1.0.0
    domainId: "domain-001",
  };

  const result = BusinessPackManifestSchema.safeParse(manifest);

  assert.ok(!result.success, "Invalid semver should fail");
});

test("BusinessPackManifestSchema applies default values", () => {
  const manifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
  };

  const result = BusinessPackManifestSchema.safeParse(manifest);

  assert.ok(result.success);
  if (result.success) {
    assert.strictEqual(result.data.lifecycleStage, "draft");
    assert.strictEqual(result.data.failureStrategy, "fail_fast");
    assert.strictEqual(result.data.sandboxTier, "process");
    assert.strictEqual(result.data.author, "");
  }
});

test("isValidLifecycleTransition returns true for draft → certifying", () => {
  assert.strictEqual(isValidLifecycleTransition("draft", "certifying"), true);
});

test("isValidLifecycleTransition returns true for draft → archived", () => {
  assert.strictEqual(isValidLifecycleTransition("draft", "archived"), true);
});

test("isValidLifecycleTransition returns false for draft → published", () => {
  assert.strictEqual(isValidLifecycleTransition("draft", "published"), false);
});

test("isValidLifecycleTransition returns true for certifying → published", () => {
  assert.strictEqual(isValidLifecycleTransition("certifying", "published"), true);
});

test("isValidLifecycleTransition returns true for certifying → draft", () => {
  assert.strictEqual(isValidLifecycleTransition("certifying", "draft"), true);
});

test("isValidLifecycleTransition returns true for certifying → archived", () => {
  assert.strictEqual(isValidLifecycleTransition("certifying", "archived"), true);
});

test("isValidLifecycleTransition returns false for certifying → deprecated", () => {
  assert.strictEqual(isValidLifecycleTransition("certifying", "deprecated"), false);
});

test("isValidLifecycleTransition returns true for published → deprecated", () => {
  assert.strictEqual(isValidLifecycleTransition("published", "deprecated"), true);
});

test("isValidLifecycleTransition returns true for published → archived", () => {
  assert.strictEqual(isValidLifecycleTransition("published", "archived"), true);
});

test("isValidLifecycleTransition returns false for published → draft", () => {
  assert.strictEqual(isValidLifecycleTransition("published", "draft"), false);
});

test("isValidLifecycleTransition returns true for deprecated → published", () => {
  assert.strictEqual(isValidLifecycleTransition("deprecated", "published"), true);
});

test("isValidLifecycleTransition returns true for deprecated → archived", () => {
  assert.strictEqual(isValidLifecycleTransition("deprecated", "archived"), true);
});

test("isValidLifecycleTransition returns false for deprecated → draft", () => {
  assert.strictEqual(isValidLifecycleTransition("deprecated", "draft"), false);
});

test("isValidLifecycleTransition returns false for archived → draft", () => {
  assert.strictEqual(isValidLifecycleTransition("archived", "draft"), false);
});

test("isValidLifecycleTransition returns false for archived → published", () => {
  assert.strictEqual(isValidLifecycleTransition("archived", "published"), false);
});

test("isExecutableStage returns true for published and deprecated", () => {
  assert.strictEqual(isExecutableStage("published"), true);
  assert.strictEqual(isExecutableStage("deprecated"), true);
});

test("isExecutableStage returns false for non-executable stages", () => {
  assert.strictEqual(isExecutableStage("draft"), false);
  assert.strictEqual(isExecutableStage("certifying"), false);
  assert.strictEqual(isExecutableStage("archived"), false);
});

test("isTerminalStage returns true only for archived", () => {
  assert.strictEqual(isTerminalStage("archived"), true);
  assert.strictEqual(isTerminalStage("draft"), false);
  assert.strictEqual(isTerminalStage("published"), false);
});

test("transitionLifecycle allows valid transitions", () => {
  const result = transitionLifecycle("draft", "certifying");

  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.from, "draft");
  assert.strictEqual(result.to, "certifying");
  assert.strictEqual(result.reason, undefined);
});

test("transitionLifecycle rejects invalid transitions", () => {
  const result = transitionLifecycle("draft", "published");

  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.from, "draft");
  assert.strictEqual(result.to, "published");
  assert.ok(result.reason);
});

test("validateBusinessPackManifest returns error for missing packId", () => {
  const baseManifest: BusinessPackManifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
    description: "",
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
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const manifest = { ...baseManifest, packId: "" };
  const result = validateBusinessPackManifest(manifest);

  assert.ok(!result.valid);
  assert.ok(result.issues.some((i) => i.code === "manifest.missing_pack_id"));
});

test("validateBusinessPackManifest returns error for missing name", () => {
  const baseManifest: BusinessPackManifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
    description: "",
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
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const manifest = { ...baseManifest, name: "" };
  const result = validateBusinessPackManifest(manifest);

  assert.ok(!result.valid);
  assert.ok(result.issues.some((i) => i.code === "manifest.missing_name"));
});

test("validateBusinessPackManifest returns error for invalid version format", () => {
  const baseManifest: BusinessPackManifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
    description: "",
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
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const manifest = { ...baseManifest, version: "1.0" };
  const result = validateBusinessPackManifest(manifest);

  assert.ok(!result.valid);
  assert.ok(result.issues.some((i) => i.code === "manifest.invalid_version_format"));
});

test("validateBusinessPackManifest returns error for missing domainId", () => {
  const baseManifest: BusinessPackManifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
    description: "",
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
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const manifest = { ...baseManifest, domainId: "" };
  const result = validateBusinessPackManifest(manifest);

  assert.ok(!result.valid);
  assert.ok(result.issues.some((i) => i.code === "manifest.missing_domain_id"));
});

test("validateBusinessPackManifest warns for missing dependency version range", () => {
  const baseManifest: BusinessPackManifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
    description: "",
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
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const manifest = {
    ...baseManifest,
    dependencies: [{ packId: "pack-002", versionRange: "", optional: false, reason: "" }],
  };
  const result = validateBusinessPackManifest(manifest, { existingPackIds: ["pack-002"] });

  assert.ok(result.issues.some((i) => i.code === "manifest.missing_version_range"));
});

test("validateBusinessPackManifest errors for non-existent required dependency", () => {
  const baseManifest: BusinessPackManifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
    description: "",
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
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const manifest = {
    ...baseManifest,
    dependencies: [{ packId: "nonexistent", versionRange: "*", optional: false, reason: "" }],
  };
  const result = validateBusinessPackManifest(manifest, { existingPackIds: ["pack-001"] });

  assert.ok(result.issues.some((i) => i.code === "manifest.dependency_not_found"));
});

test("validateBusinessPackManifest warns for non-existent optional dependency", () => {
  const baseManifest: BusinessPackManifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
    description: "",
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
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const manifest = {
    ...baseManifest,
    dependencies: [{ packId: "nonexistent", versionRange: "*", optional: true, reason: "" }],
  };
  const result = validateBusinessPackManifest(manifest, { existingPackIds: ["pack-001"] });

  const issue = result.issues.find((i) => i.code === "manifest.dependency_not_found");
  assert.ok(issue);
  assert.strictEqual(issue.severity, "warning");
});

test("validateBusinessPackManifest errors for non-installed plugin", () => {
  const baseManifest: BusinessPackManifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
    description: "",
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
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const manifest = { ...baseManifest, pluginIds: ["nonexistent-plugin"] };
  const result = validateBusinessPackManifest(manifest, { installedPluginIds: ["other-plugin"] });

  assert.ok(result.issues.some((i) => i.code === "manifest.plugin_not_installed"));
});

test("validateBusinessPackManifest errors for critical risk with no sandbox", () => {
  const baseManifest: BusinessPackManifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
    description: "",
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
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const manifest = {
    ...baseManifest,
    riskMatrix: [{ riskId: "r1", level: "critical" as const, triggers: [] as string[], mitigation: "", escalationPolicy: "" }],
    sandboxTier: "none" as const,
  };
  const result = validateBusinessPackManifest(manifest);

  assert.ok(result.issues.some((i) => i.code === "manifest.insecure_sandbox_tier"));
});

test("validateBusinessPackManifest warns for high risk with process sandbox", () => {
  const baseManifest: BusinessPackManifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
    description: "",
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
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const manifest = {
    ...baseManifest,
    riskMatrix: [{ riskId: "r1", level: "high" as const, triggers: [] as string[], mitigation: "", escalationPolicy: "" }],
    sandboxTier: "process" as const,
  };
  const result = validateBusinessPackManifest(manifest);

  assert.ok(result.issues.some((i) => i.code === "manifest.insecure_sandbox_tier"));
});

test("validateBusinessPackManifest warns for admin permission without justification", () => {
  const baseManifest: BusinessPackManifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
    description: "",
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
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const manifest = {
    ...baseManifest,
    permissions: [{ permission: "user:admin", level: "admin" as const, justification: "" }],
  };
  const result = validateBusinessPackManifest(manifest);

  assert.ok(result.issues.some((i) => i.code === "manifest.admin_permission_without_justification"));
});

test("validateBusinessPackManifest errors when required approvals exceed available roles", () => {
  const baseManifest: BusinessPackManifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
    description: "",
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
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const manifest = {
    ...baseManifest,
    approvalPoints: [
      {
        pointId: "ap1",
        name: "Test Approval",
        description: "",
        triggerCondition: "",
        requiredApprovals: 3,
        approverRoles: ["role1"],
        timeoutMinutes: 60,
        autoApproveRoles: [] as string[],
      },
    ],
  };
  const result = validateBusinessPackManifest(manifest);

  assert.ok(result.issues.some((i) => i.code === "manifest.insufficient_approvers"));
});

test("validateBusinessPackManifest errors for non-positive timeout", () => {
  const baseManifest: BusinessPackManifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
    description: "",
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
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const manifest = {
    ...baseManifest,
    approvalPoints: [
      {
        pointId: "ap1",
        name: "Test Approval",
        description: "",
        triggerCondition: "",
        requiredApprovals: 1,
        approverRoles: ["role1"],
        timeoutMinutes: 0,
        autoApproveRoles: [] as string[],
      },
    ],
  };
  const result = validateBusinessPackManifest(manifest);

  assert.ok(result.issues.some((i) => i.code === "manifest.invalid_timeout"));
});

test("validateBusinessPackManifest warns for fail_fast without rollback capability", () => {
  const baseManifest: BusinessPackManifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
    description: "",
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
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const manifest = { ...baseManifest, failureStrategy: "fail_fast" as const, rollbackCapability: false };
  const result = validateBusinessPackManifest(manifest);

  assert.ok(result.issues.some((i) => i.code === "manifest.rollback_recommended"));
});

test("validateBusinessPackManifest warns for published pack without risk matrix", () => {
  const baseManifest: BusinessPackManifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
    description: "",
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
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const manifest = { ...baseManifest, lifecycleStage: "published" as const };
  const result = validateBusinessPackManifest(manifest);

  assert.ok(result.issues.some((i) => i.code === "manifest.published_without_risk_matrix"));
});

test("validateBusinessPackManifest does not warn for published pack with risk matrix", () => {
  const baseManifest: BusinessPackManifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
    description: "",
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
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const manifest = {
    ...baseManifest,
    lifecycleStage: "published" as const,
    riskMatrix: [{ riskId: "r1", level: "low" as const, triggers: [] as string[], mitigation: "", escalationPolicy: "" }],
  };
  const result = validateBusinessPackManifest(manifest);

  assert.ok(!result.issues.some((i) => i.code === "manifest.published_without_risk_matrix"));
});

test("validateBusinessPackManifest passes when all dependencies exist", () => {
  const baseManifest: BusinessPackManifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
    description: "",
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
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const manifest = {
    ...baseManifest,
    dependencies: [
      { packId: "pack-002", versionRange: ">=1.0.0", optional: false, reason: "Needed for X" },
    ],
  };
  const result = validateBusinessPackManifest(manifest, {
    existingPackIds: ["pack-001", "pack-002"],
  });

  assert.ok(result.valid, "Should be valid when dependencies exist");
});

test("validateBusinessPackManifest passes when all plugins are installed", () => {
  const baseManifest: BusinessPackManifest = {
    packId: "pack-001",
    name: "Test Pack",
    version: "1.0.0",
    domainId: "domain-001",
    description: "",
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
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  };
  const manifest = { ...baseManifest, pluginIds: ["plugin-1", "plugin-2"] };
  const result = validateBusinessPackManifest(manifest, {
    installedPluginIds: ["plugin-1", "plugin-2", "plugin-3"],
  });

  assert.ok(result.valid, "Should be valid when plugins are installed");
});
