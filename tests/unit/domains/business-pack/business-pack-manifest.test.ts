import { describe, it } from "node:test";
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

describe("BusinessPackManifestSchema", () => {
  it("should parse a valid minimal manifest", () => {
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

  it("should parse a full manifest with all fields", () => {
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

  it("should reject invalid semver version", () => {
    const manifest = {
      packId: "pack-001",
      name: "Test Pack",
      version: "1.0", // Invalid - should be 1.0.0
      domainId: "domain-001",
    };

    const result = BusinessPackManifestSchema.safeParse(manifest);

    assert.ok(!result.success, "Invalid semver should fail");
  });

  it("should apply default values", () => {
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
});

describe("isValidLifecycleTransition", () => {
  const cases: Array<{ from: BusinessPackLifecycleStage; to: BusinessPackLifecycleStage; expected: boolean }> = [
    { from: "draft", to: "review", expected: true },
    { from: "draft", to: "archived", expected: true },
    { from: "draft", to: "published", expected: false },
    { from: "review", to: "approved", expected: true },
    { from: "review", to: "draft", expected: true },
    { from: "review", to: "published", expected: false },
    { from: "approved", to: "published", expected: true },
    { from: "approved", to: "draft", expected: true },
    { from: "approved", to: "deprecated", expected: false },
    { from: "published", to: "deprecated", expected: true },
    { from: "published", to: "archived", expected: true },
    { from: "published", to: "draft", expected: false },
    { from: "deprecated", to: "published", expected: true },
    { from: "deprecated", to: "archived", expected: true },
    { from: "deprecated", to: "draft", expected: false },
    { from: "archived", to: "draft", expected: false },
    { from: "archived", to: "published", expected: false },
  ];

  cases.forEach(({ from, to, expected }) => {
    it(`should return ${expected} for ${from} → ${to}`, () => {
      assert.strictEqual(isValidLifecycleTransition(from, to), expected);
    });
  });
});

describe("isExecutableStage", () => {
  it("should return true for published and deprecated", () => {
    assert.strictEqual(isExecutableStage("published"), true);
    assert.strictEqual(isExecutableStage("deprecated"), true);
  });

  it("should return false for non-executable stages", () => {
    assert.strictEqual(isExecutableStage("draft"), false);
    assert.strictEqual(isExecutableStage("review"), false);
    assert.strictEqual(isExecutableStage("approved"), false);
    assert.strictEqual(isExecutableStage("archived"), false);
  });
});

describe("isTerminalStage", () => {
  it("should return true only for archived", () => {
    assert.strictEqual(isTerminalStage("archived"), true);
    assert.strictEqual(isTerminalStage("draft"), false);
    assert.strictEqual(isTerminalStage("published"), false);
  });
});

describe("transitionLifecycle", () => {
  it("should allow valid transitions", () => {
    const result = transitionLifecycle("draft", "review");

    assert.strictEqual(result.allowed, true);
    assert.strictEqual(result.from, "draft");
    assert.strictEqual(result.to, "review");
    assert.strictEqual(result.reason, undefined);
  });

  it("should reject invalid transitions", () => {
    const result = transitionLifecycle("draft", "published");

    assert.strictEqual(result.allowed, false);
    assert.strictEqual(result.from, "draft");
    assert.strictEqual(result.to, "published");
    assert.ok(result.reason);
  });
});

describe("validateBusinessPackManifest", () => {
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

  describe("required fields", () => {
    it("should return error for missing packId", () => {
      const manifest = { ...baseManifest, packId: "" };
      const result = validateBusinessPackManifest(manifest);

      assert.ok(!result.valid);
      assert.ok(result.issues.some((i) => i.code === "manifest.missing_pack_id"));
    });

    it("should return error for missing name", () => {
      const manifest = { ...baseManifest, name: "" };
      const result = validateBusinessPackManifest(manifest);

      assert.ok(!result.valid);
      assert.ok(result.issues.some((i) => i.code === "manifest.missing_name"));
    });

    it("should return error for invalid version format", () => {
      const manifest = { ...baseManifest, version: "1.0" };
      const result = validateBusinessPackManifest(manifest);

      assert.ok(!result.valid);
      assert.ok(result.issues.some((i) => i.code === "manifest.invalid_version_format"));
    });

    it("should return error for missing domainId", () => {
      const manifest = { ...baseManifest, domainId: "" };
      const result = validateBusinessPackManifest(manifest);

      assert.ok(!result.valid);
      assert.ok(result.issues.some((i) => i.code === "manifest.missing_domain_id"));
    });
  });

  describe("dependency validation", () => {
    it("should warn for missing dependency version range", () => {
      const manifest = {
        ...baseManifest,
        dependencies: [{ packId: "pack-002", versionRange: "", optional: false, reason: "" }],
      };
      const result = validateBusinessPackManifest(manifest, { existingPackIds: ["pack-002"] });

      assert.ok(result.issues.some((i) => i.code === "manifest.missing_version_range"));
    });

    it("should error for non-existent required dependency", () => {
      const manifest = {
        ...baseManifest,
        dependencies: [{ packId: "nonexistent", versionRange: "*", optional: false, reason: "" }],
      };
      const result = validateBusinessPackManifest(manifest, { existingPackIds: ["pack-001"] });

      assert.ok(result.issues.some((i) => i.code === "manifest.dependency_not_found"));
    });

    it("should warn (not error) for non-existent optional dependency", () => {
      const manifest = {
        ...baseManifest,
        dependencies: [{ packId: "nonexistent", versionRange: "*", optional: true, reason: "" }],
      };
      const result = validateBusinessPackManifest(manifest, { existingPackIds: ["pack-001"] });

      const issue = result.issues.find((i) => i.code === "manifest.dependency_not_found");
      assert.ok(issue);
      assert.strictEqual(issue.severity, "warning");
    });
  });

  describe("plugin validation", () => {
    it("should error for non-installed plugin", () => {
      const manifest = { ...baseManifest, pluginIds: ["nonexistent-plugin"] };
      const result = validateBusinessPackManifest(manifest, { installedPluginIds: ["other-plugin"] });

      assert.ok(result.issues.some((i) => i.code === "manifest.plugin_not_installed"));
    });
  });

  describe("sandbox tier validation", () => {
    it("should error for critical risk with no sandbox", () => {
      const manifest = {
        ...baseManifest,
        riskMatrix: [{ riskId: "r1", level: "critical" as const, triggers: [] as string[], mitigation: "", escalationPolicy: "" }],
        sandboxTier: "none" as const,
      };
      const result = validateBusinessPackManifest(manifest);

      assert.ok(result.issues.some((i) => i.code === "manifest.insecure_sandbox_tier"));
    });

    it("should warn for high risk with process sandbox", () => {
      const manifest = {
        ...baseManifest,
        riskMatrix: [{ riskId: "r1", level: "high" as const, triggers: [] as string[], mitigation: "", escalationPolicy: "" }],
        sandboxTier: "process" as const,
      };
      const result = validateBusinessPackManifest(manifest);

      assert.ok(result.issues.some((i) => i.code === "manifest.insecure_sandbox_tier"));
    });
  });

  describe("permission validation", () => {
    it("should warn for admin permission without justification", () => {
      const manifest = {
        ...baseManifest,
        permissions: [{ permission: "user:admin", level: "admin" as const, justification: "" }],
      };
      const result = validateBusinessPackManifest(manifest);

      assert.ok(result.issues.some((i) => i.code === "manifest.admin_permission_without_justification"));
    });
  });

  describe("approval point validation", () => {
    it("should error when required approvals exceed available roles", () => {
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

    it("should error for non-positive timeout", () => {
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
  });

  describe("rollback validation", () => {
    it("should warn for fail_fast without rollback capability", () => {
      const manifest = { ...baseManifest, failureStrategy: "fail_fast" as const, rollbackCapability: false };
      const result = validateBusinessPackManifest(manifest);

      assert.ok(result.issues.some((i) => i.code === "manifest.rollback_recommended"));
    });
  });

  describe("lifecycle validation", () => {
    it("should warn for published pack without risk matrix", () => {
      const manifest = { ...baseManifest, lifecycleStage: "published" as const };
      const result = validateBusinessPackManifest(manifest);

      assert.ok(result.issues.some((i) => i.code === "manifest.published_without_risk_matrix"));
    });

    it("should not warn for published pack with risk matrix", () => {
      const manifest = {
        ...baseManifest,
        lifecycleStage: "published" as const,
        riskMatrix: [{ riskId: "r1", level: "low" as const, triggers: [] as string[], mitigation: "", escalationPolicy: "" }],
      };
      const result = validateBusinessPackManifest(manifest);

      assert.ok(!result.issues.some((i) => i.code === "manifest.published_without_risk_matrix"));
    });
  });

  describe("with existing resources", () => {
    it("should pass when all dependencies exist", () => {
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

    it("should pass when all plugins are installed", () => {
      const manifest = { ...baseManifest, pluginIds: ["plugin-1", "plugin-2"] };
      const result = validateBusinessPackManifest(manifest, {
        installedPluginIds: ["plugin-1", "plugin-2", "plugin-3"],
      });

      assert.ok(result.valid, "Should be valid when plugins are installed");
    });
  });
});
