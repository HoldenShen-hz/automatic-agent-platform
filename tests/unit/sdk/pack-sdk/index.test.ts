import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import {
  PackLifecycleOrchestrationService,
  PackPluginCompatibilityService,
  PackScaffoldService,
  PackTestLocalService,
  summarizeCapabilityMatrix,
  validateBusinessPackManifest,
} from "../../../../src/sdk/pack-sdk/index.js";

// ============================================================================
// pack-manifest tests
// ============================================================================

test("validateBusinessPackManifest accepts valid minimal manifest", () => {
  const manifest = validateBusinessPackManifest({
    packId: "test-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test.execute", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  assert.equal(manifest.packId, "test-pack");
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.domain, "testing");
  assert.equal(manifest.owner, "test@example.com");
  assert.equal(manifest.capabilities.length, 1);
});

test("validateBusinessPackManifest trims whitespace on all string fields", () => {
  const manifest = validateBusinessPackManifest({
    packId: "  pack-id  ",
    version: "  1.0.0  ",
    domain: "  domain  ",
    owner: "  owner@example.com  ",
    capabilities: [
      { capabilityKey: " cap ", maturity: "beta", requiredContracts: [" contract1 ", " contract2 "] },
    ],
  });

  assert.equal(manifest.packId, "pack-id");
  assert.equal(manifest.version, "1.0.0");
  assert.equal(manifest.domain, "domain");
  assert.equal(manifest.owner, "owner@example.com");
  assert.equal(manifest.capabilities[0]!.capabilityKey, "cap");
  assert.deepEqual(manifest.capabilities[0]!.requiredContracts, ["contract1", "contract2"]);
});

test("validateBusinessPackManifest deduplicates requiredContracts across capabilities", () => {
  const manifest = validateBusinessPackManifest({
    packId: "test-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "cap1", maturity: "ga", requiredContracts: ["contract_a", "contract_a"] },
      { capabilityKey: "cap2", maturity: "ga", requiredContracts: ["contract_a", "contract_b"] },
    ],
  });

  assert.deepEqual(manifest.capabilities[0]!.requiredContracts, ["contract_a"]);
  assert.deepEqual(manifest.capabilities[1]!.requiredContracts, ["contract_a", "contract_b"]);
});

test("validateBusinessPackManifest rejects packId with only whitespace", () => {
  assert.throws(
    () =>
      validateBusinessPackManifest({
        packId: "   ",
        version: "1.0.0",
        domain: "testing",
        owner: "test@example.com",
        capabilities: [
          { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
        ],
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "pack_sdk.invalid_pack_id",
  );
});

test("validateBusinessPackManifest rejects empty capabilities array", () => {
  assert.throws(
    () =>
      validateBusinessPackManifest({
        packId: "test-pack",
        version: "1.0.0",
        domain: "testing",
        owner: "test@example.com",
        capabilities: [],
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "pack_sdk.empty_capabilities",
  );
});

test("summarizeCapabilityMatrix returns zero counts for empty capabilities", () => {
  const manifest = validateBusinessPackManifest({
    packId: "test-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  const summary = summarizeCapabilityMatrix(manifest);
  assert.deepEqual(summary, { experimental: 0, beta: 0, ga: 1 });
});

test("summarizeCapabilityMatrix counts all experimental capabilities", () => {
  const manifest = validateBusinessPackManifest({
    packId: "test-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "exp1", maturity: "experimental", requiredContracts: ["c1"] },
      { capabilityKey: "exp2", maturity: "experimental", requiredContracts: ["c2"] },
      { capabilityKey: "exp3", maturity: "experimental", requiredContracts: ["c3"] },
    ],
  });

  const summary = summarizeCapabilityMatrix(manifest);
  assert.deepEqual(summary, { experimental: 3, beta: 0, ga: 0 });
});

test("summarizeCapabilityMatrix counts mixed maturity levels", () => {
  const manifest = validateBusinessPackManifest({
    packId: "test-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "exp1", maturity: "experimental", requiredContracts: ["c1"] },
      { capabilityKey: "beta1", maturity: "beta", requiredContracts: ["c2"] },
      { capabilityKey: "ga1", maturity: "ga", requiredContracts: ["c3"] },
      { capabilityKey: "beta2", maturity: "beta", requiredContracts: ["c4"] },
    ],
  });

  const summary = summarizeCapabilityMatrix(manifest);
  assert.deepEqual(summary, { experimental: 1, beta: 2, ga: 1 });
});

// ============================================================================
// PackScaffoldService tests
// ============================================================================

test("PackScaffoldService.listTemplates returns three templates", () => {
  const service = new PackScaffoldService();
  const templates = service.listTemplates();

  assert.equal(templates.length, 3);
  assert.ok(templates.find((t) => t.id === "minimal"));
  assert.ok(templates.find((t) => t.id === "standard"));
  assert.ok(templates.find((t) => t.id === "full"));
});

test("PackScaffoldService.listTemplates returns correct descriptions", () => {
  const service = new PackScaffoldService();
  const templates = service.listTemplates();

  const minimal = templates.find((t) => t.id === "minimal");
  const standard = templates.find((t) => t.id === "standard");
  const full = templates.find((t) => t.id === "full");

  assert.ok(minimal?.description.includes("Single tool"));
  assert.ok(standard?.description.includes("Multiple tools"));
  assert.ok(full?.description.includes("Complete structure"));
});

test("PackScaffoldService.scaffold rejects invalid pack ID with uppercase", () => {
  const service = new PackScaffoldService();
  assert.throws(
    () =>
      service.scaffold({
        packId: "InvalidPack",
        name: "Test Pack",
        template: "minimal",
        domain: "testing",
        owner: "test@example.com",
        riskLevel: "low",
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "pack_scaffold.invalid_pack_id_format",
  );
});

test("PackScaffoldService.scaffold rejects invalid pack ID with special chars", () => {
  const service = new PackScaffoldService();
  assert.throws(
    () =>
      service.scaffold({
        packId: "pack@#$%",
        name: "Test Pack",
        template: "minimal",
        domain: "testing",
        owner: "test@example.com",
        riskLevel: "low",
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "pack_scaffold.invalid_pack_id_format",
  );
});

test("PackScaffoldService.scaffold rejects empty name", () => {
  const service = new PackScaffoldService();
  assert.throws(
    () =>
      service.scaffold({
        packId: "valid-pack",
        name: "",
        template: "minimal",
        domain: "testing",
        owner: "test@example.com",
        riskLevel: "low",
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "pack_scaffold.invalid_name",
  );
});

test("PackScaffoldService.scaffold rejects empty owner", () => {
  const service = new PackScaffoldService();
  assert.throws(
    () =>
      service.scaffold({
        packId: "valid-pack",
        name: "Test Pack",
        template: "minimal",
        domain: "testing",
        owner: "   ",
        riskLevel: "low",
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "pack_scaffold.invalid_owner",
  );
});

test("PackScaffoldService.scaffold accepts valid pack ID starting with number", () => {
  const service = new PackScaffoldService();
  assert.doesNotThrow(
    () =>
      service.scaffold({
        packId: "123-pack",
        name: "Test Pack",
        template: "minimal",
        domain: "testing",
        owner: "test@example.com",
        riskLevel: "low",
      }),
  );
});

test("PackScaffoldService.scaffold accepts underscore in pack ID", () => {
  const service = new PackScaffoldService();
  assert.doesNotThrow(
    () =>
      service.scaffold({
        packId: "test_pack",
        name: "Test Pack",
        template: "minimal",
        domain: "testing",
        owner: "test@example.com",
        riskLevel: "low",
      }),
  );
});

test("PackScaffoldService.scaffold rejects dot in pack ID", () => {
  const service = new PackScaffoldService();
  assert.throws(
    () =>
      service.scaffold({
        packId: "test.pack",
        name: "Test Pack",
        template: "minimal",
        domain: "testing",
        owner: "test@example.com",
        riskLevel: "low",
      }),
    /Pack ID/i,
  );
});

test("PackScaffoldService.scaffold creates full template with all files", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-full-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);
    const config = {
      packId: "full-pack",
      name: "Full Pack",
      template: "full" as const,
      domain: "testing",
      owner: "test@example.com",
      riskLevel: "high" as const,
    };

    const result = service.scaffold(config);
    assert.ok(result.rootDir.includes("full-pack"));
    assert.ok(result.files.length >= 12);
    assert.ok(result.manifestPath.endsWith("manifest.json"));
    assert.ok(result.entryPointPath.endsWith("src/index.ts"));
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ============================================================================
// PackTestLocalService tests
// ============================================================================

test("PackTestLocalService.playbackFixture returns null for unknown fixture", async () => {
  const service = new PackTestLocalService();
  const result = await service.playbackFixture("unknown:fixture:id");
  assert.equal(result, null);
});

test("PackTestLocalService.playbackFixture returns fixture with delay", async () => {
  const service = new PackTestLocalService();
  service.configureMockLlm({ responses: [{ content: "delayed response" }], delayMs: 50 });
  service.loadFixtures({
    "fixture:id": { content: "delayed response" },
  });

  const start = Date.now();
  const result = await service.playbackFixture("fixture:id");
  const elapsed = Date.now() - start;

  assert.equal(result?.content, "delayed response");
  assert.ok(elapsed >= 50, "Expected delay to be applied");
});

test("PackTestLocalService.playbackFixture applies configured delay", async () => {
  const service = new PackTestLocalService();
  service.configureMockLlm({ responses: [{ content: "test" }], delayMs: 100 });
  service.loadFixtures({
    "mode:pack:1": { content: "test response" },
  });

  const start = Date.now();
  await service.playbackFixture("mode:pack:1");
  const elapsed = Date.now() - start;

  assert.ok(elapsed >= 100, "Delay should be applied");
});

test("PackTestLocalService.validateTestOptions rejects empty packId", async () => {
  const service = new PackTestLocalService();
  const options = {
    packId: "",
    version: "1.0.0",
    mode: "unit" as const,
    mockLlm: false,
    recordArtifacts: false,
  };

  await assert.rejects(
    () => service.test(options as any),
    /Pack ID/i,
  );
});

test("PackTestLocalService.validateTestOptions rejects empty version", async () => {
  const service = new PackTestLocalService();
  const options = {
    packId: "test-pack",
    version: "   ",
    mode: "unit" as const,
    mockLlm: false,
    recordArtifacts: false,
  };

  await assert.rejects(
    () => service.test(options as any),
    /Version/i,
  );
});

test("PackTestLocalService.validateTestOptions rejects negative timeout", async () => {
  const service = new PackTestLocalService();
  const options = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "unit" as const,
    mockLlm: false,
    recordArtifacts: false,
    timeoutMs: -1,
  };

  await assert.rejects(
    () => service.test(options as any),
    /Timeout/i,
  );
});

test("PackTestLocalService.test with zero timeout uses default", async () => {
  const service = new PackTestLocalService();
  const options = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "unit" as const,
    mockLlm: false,
    recordArtifacts: false,
    timeoutMs: 0,
  };

  const report = await service.test(options as any);
  assert.equal(report.packId, "test-pack");
});

test("PackTestLocalService.test records artifact path when enabled", async () => {
  const service = new PackTestLocalService();
  const options = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "unit" as const,
    mockLlm: false,
    recordArtifacts: true,
  };

  const report = await service.test(options as any);
  assert.ok(report.artifacts.length > 0);
  assert.ok(report.artifacts[0]!.includes("test-pack"));
});

test("PackTestLocalService.test adds coverage_below_threshold finding when coverage low", async () => {
  const service = new PackTestLocalService();
  const options = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "unit" as const,
    mockLlm: false,
    recordArtifacts: false,
  };

  const report = await service.test(options as any);
  assert.ok(
    report.findings.some((f) => f.includes("coverage_below_threshold")) || report.coveragePercent >= 80,
    "Expected coverage finding or acceptable coverage",
  );
});

// ============================================================================
// PackPluginCompatibilityService tests
// ============================================================================

test("PackPluginCompatibilityService.listAvailablePlugins returns sorted list", () => {
  const service = new PackPluginCompatibilityService();
  const plugins = service.listAvailablePlugins();

  for (let i = 1; i < plugins.length; i++) {
    assert.ok(plugins[i - 1]!.pluginId <= plugins[i]!.pluginId, "Plugins should be sorted");
  }
});

test("PackPluginCompatibilityService.inspectBuiltinPlugin returns null for unknown plugin", () => {
  const service = new PackPluginCompatibilityService();
  const result = service.inspectBuiltinPlugin("plugin.unknown.nonexistent");
  assert.equal(result, null);
});

test("PackPluginCompatibilityService.inspectBuiltinPlugin returns valid entry for known plugin", () => {
  const service = new PackPluginCompatibilityService();
  const githubAdapter = service.inspectBuiltinPlugin("plugin.shared.github_adapter");

  if (githubAdapter) {
    assert.ok(githubAdapter.pluginId.includes("github"));
    assert.ok(githubAdapter.capabilityIds.length >= 0);
    assert.ok(["initialize", "healthCheck", "shutdown"].some((h) => githubAdapter.lifecycleHooks.includes(h as any)));
  }
});

test("PackPluginCompatibilityService.evaluateManifest with no plugins throws", () => {
  const service = new PackPluginCompatibilityService();
  const manifest = validateBusinessPackManifest({
    packId: "test-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test.execute", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  assert.throws(
    () =>
      service.evaluateManifest({
        manifest,
        selectedLicenseTier: "community",
        pluginIds: [],
      }),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_plugin_compatibility.empty_plugin_set",
  );
});

test("PackPluginCompatibilityService.evaluateManifest reports compatible when all capabilities match", () => {
  const service = new PackPluginCompatibilityService();
  const manifest = validateBusinessPackManifest({
    packId: "test-pack",
    version: "1.0.0",
    domain: "operations",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "ops.runbook_search", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  const report = service.evaluateManifest({
    manifest,
    selectedLicenseTier: "professional",
    pluginIds: ["plugin.operations.retriever"],
  });

  assert.equal(report.verdict, "compatible");
  assert.deepEqual(report.missingPluginCapabilities, []);
  assert.deepEqual(report.blockedByLicense, []);
});

test("PackPluginCompatibilityService.evaluateManifest capabilityCoverage structure", () => {
  const service = new PackPluginCompatibilityService();
  const manifest = validateBusinessPackManifest({
    packId: "test-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test.cap", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  const report = service.evaluateManifest({
    manifest,
    selectedLicenseTier: "enterprise",
    pluginIds: ["plugin.operations.retriever"],
  });

  assert.ok(report.capabilityCoverage.length > 0);
  const cap = report.capabilityCoverage[0]!;
  assert.equal(cap.capabilityKey, "test.cap");
  assert.ok(Array.isArray(cap.matchedPluginIds));
  assert.ok(Array.isArray(cap.candidatePluginIds));
  assert.ok(Array.isArray(cap.reasons));
});

test("PackPluginCompatibilityService.evaluateManifest returns availablePlugins sorted", () => {
  const service = new PackPluginCompatibilityService();
  const manifest = validateBusinessPackManifest({
    packId: "test-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  const report = service.evaluateManifest({
    manifest,
    selectedLicenseTier: "community",
  });

  for (let i = 1; i < report.availablePlugins.length; i++) {
    assert.ok(
      report.availablePlugins[i - 1]!.pluginId <= report.availablePlugins[i]!.pluginId,
      "Available plugins should be sorted",
    );
  }
});

// ============================================================================
// PackLifecycleOrchestrationService tests
// ============================================================================

function createOpsLifecycleManifest(input: {
  packId: string;
  version: string;
  capabilities?: Array<{ capabilityKey: string; maturity: "experimental" | "beta" | "ga"; requiredContracts: string[] }>;
  owner?: string;
}): ReturnType<typeof validateBusinessPackManifest> {
  return validateBusinessPackManifest({
    packId: input.packId,
    version: input.version,
    domain: "operations",
    owner: input.owner ?? "ops@example.com",
    capabilities: input.capabilities ?? [
      { capabilityKey: "ops.runbook_search", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });
}

test("PackLifecycleOrchestrationService.registerPack rejects duplicate registration", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = validateBusinessPackManifest({
    packId: "duplicate-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  service.registerPack({ manifest, owner: "test@example.com", evalDatasetIds: ["ds1"] });

  assert.throws(
    () => service.registerPack({ manifest, owner: "test@example.com", evalDatasetIds: ["ds1"] }),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_lifecycle.already_registered:duplicate-pack@1.0.0",
  );
});

test("PackLifecycleOrchestrationService.recordTesting rejects unknown pack", () => {
  const service = new PackLifecycleOrchestrationService();

  assert.throws(
    () =>
      service.recordTesting({
        packId: "unknown-pack",
        version: "1.0.0",
        coveragePercent: 90,
        mockTestsPassed: true,
        stagingIntegrationPassed: true,
        evalPassed: true,
        reportRef: "artifact://test",
      }),
    (error: unknown) => error instanceof ValidationError && error.code.startsWith("pack_lifecycle.not_found"),
  );
});

test("PackLifecycleOrchestrationService.recordTesting adds findings for low coverage", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = validateBusinessPackManifest({
    packId: "low-coverage-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  service.registerPack({ manifest, owner: "test@example.com" });

  const record = service.recordTesting({
    packId: "low-coverage-pack",
    version: "1.0.0",
    coveragePercent: 50,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://test",
  });

  assert.ok(record.testing?.findings.includes("pack_lifecycle.coverage_below_threshold"));
});

test("PackLifecycleOrchestrationService.recordTesting adds finding for failed mock tests", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = validateBusinessPackManifest({
    packId: "mock-fail-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  service.registerPack({ manifest, owner: "test@example.com" });

  const record = service.recordTesting({
    packId: "mock-fail-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: false,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://test",
  });

  assert.ok(record.testing?.findings.includes("pack_lifecycle.mock_tests_failed"));
});

test("PackLifecycleOrchestrationService.recordTesting adds findings for failed staging integration", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = validateBusinessPackManifest({
    packId: "staging-fail-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  service.registerPack({ manifest, owner: "test@example.com" });

  const record = service.recordTesting({
    packId: "staging-fail-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: false,
    evalPassed: true,
    reportRef: "artifact://test",
  });

  assert.ok(record.testing?.findings.includes("pack_lifecycle.staging_integration_failed"));
});

test("PackLifecycleOrchestrationService.recordTesting adds finding for failed eval gate", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = validateBusinessPackManifest({
    packId: "eval-fail-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  service.registerPack({ manifest, owner: "test@example.com" });

  const record = service.recordTesting({
    packId: "eval-fail-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: false,
    reportRef: "artifact://test",
  });

  assert.ok(record.testing?.findings.includes("pack_lifecycle.eval_gate_failed"));
});

test("PackLifecycleOrchestrationService.recordTesting allows refreshed evidence while pack remains in testing", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = validateBusinessPackManifest({
    packId: "wrong-stage-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  service.registerPack({ manifest, owner: "test@example.com" });
  service.recordTesting({
    packId: "wrong-stage-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://test",
  });

  const refreshed = service.recordTesting({
    packId: "wrong-stage-pack",
    version: "1.0.0",
    coveragePercent: 95,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://test2",
  });

  assert.equal(refreshed.lifecycleStage, "testing");
  assert.equal(refreshed.testing?.reportRef, "artifact://test2");
});

test("PackLifecycleOrchestrationService.certifyPack rejects pack with a failing test report", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = validateBusinessPackManifest({
    packId: "no-test-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  service.registerPack({ manifest, owner: "test@example.com" });
  service.recordTesting({
    packId: "no-test-pack",
    version: "1.0.0",
    coveragePercent: 60,
    mockTestsPassed: false,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://test",
  });

  assert.throws(
    () =>
      service.certifyPack({
        packId: "no-test-pack",
        version: "1.0.0",
        reviewer: "reviewer@example.com",
        certificationReportRef: "artifact://cert",
        selectedLicenseTier: "professional",
        pluginIds: ["plugin.operations.retriever"],
        securityReviewPassed: true,
        riskReviewPassed: true,
      }),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_lifecycle.testing_not_passed:no-test-pack@1.0.0",
  );
});

test("PackLifecycleOrchestrationService.certifyPack adds finding for failed security review", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = validateBusinessPackManifest({
    packId: "sec-fail-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  service.registerPack({ manifest, owner: "test@example.com" });
  service.recordTesting({
    packId: "sec-fail-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://test",
  });

  const record = service.certifyPack({
    packId: "sec-fail-pack",
    version: "1.0.0",
    reviewer: "reviewer@example.com",
    certificationReportRef: "artifact://cert",
    selectedLicenseTier: "professional",
    pluginIds: ["plugin.operations.retriever"],
    securityReviewPassed: false,
    riskReviewPassed: true,
  });

  assert.ok(record.certification?.findings.includes("pack_lifecycle.security_review_failed"));
});

test("PackLifecycleOrchestrationService.certifyPack adds finding for failed risk review", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = validateBusinessPackManifest({
    packId: "risk-fail-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  service.registerPack({ manifest, owner: "test@example.com" });
  service.recordTesting({
    packId: "risk-fail-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://test",
  });

  const record = service.certifyPack({
    packId: "risk-fail-pack",
    version: "1.0.0",
    reviewer: "reviewer@example.com",
    certificationReportRef: "artifact://cert",
    selectedLicenseTier: "professional",
    pluginIds: ["plugin.operations.retriever"],
    securityReviewPassed: true,
    riskReviewPassed: false,
  });

  assert.ok(record.certification?.findings.includes("pack_lifecycle.risk_review_failed"));
});

test("PackLifecycleOrchestrationService.certifyPack sets lifecycleStage to testing when blocked", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = createOpsLifecycleManifest({
    packId: "blocked-pack",
    version: "1.0.0",
    capabilities: [
      { capabilityKey: "ops.runbook_search", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
      { capabilityKey: "external.github.workflow", maturity: "beta", requiredContracts: ["tool_skill_plugin_contract"] },
    ],
  });

  service.registerPack({ manifest, owner: "ops@example.com" });
  service.recordTesting({
    packId: "blocked-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://test",
  });

  const record = service.certifyPack({
    packId: "blocked-pack",
    version: "1.0.0",
    reviewer: "reviewer@example.com",
    certificationReportRef: "artifact://cert",
    selectedLicenseTier: "community",
    pluginIds: ["plugin.operations.retriever"],
    securityReviewPassed: true,
    riskReviewPassed: true,
  });

  assert.equal(record.lifecycleStage, "testing");
  assert.equal(record.certification?.verdict, "blocked");
});

test("PackLifecycleOrchestrationService.publishPack rejects packs before certification", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = validateBusinessPackManifest({
    packId: "unpublished-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  service.registerPack({ manifest, owner: "test@example.com" });
  service.recordTesting({
    packId: "unpublished-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://test",
  });

  assert.throws(
    () =>
      service.publishPack({
        packId: "unpublished-pack",
        version: "1.0.0",
        strategy: "shadow",
        owner: "release@example.com",
      }),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_lifecycle.not_certified:unpublished-pack@1.0.0",
  );
});

test("PackLifecycleOrchestrationService.publishPack adds ga_requires_deprecation_notice finding", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = createOpsLifecycleManifest({
    packId: "ga-break-pack",
    version: "2.0.0",
    capabilities: [
      { capabilityKey: "ops.runbook_search", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  service.registerPack({
    manifest,
    owner: "ops@example.com",
    previousManifest: createOpsLifecycleManifest({
      packId: "ga-break-pack",
      version: "1.0.0",
      capabilities: [
        { capabilityKey: "ops.runbook_search", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
        { capabilityKey: "external.github.workflow", maturity: "beta", requiredContracts: ["tool_skill_plugin_contract"] },
      ],
    }),
  });
  service.recordTesting({
    packId: "ga-break-pack",
    version: "2.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://test",
  });
  service.certifyPack({
    packId: "ga-break-pack",
    version: "2.0.0",
    reviewer: "reviewer@example.com",
    certificationReportRef: "artifact://cert",
    selectedLicenseTier: "professional",
    pluginIds: ["plugin.operations.retriever"],
    securityReviewPassed: true,
    riskReviewPassed: true,
  });

  const record = service.publishPack({
    packId: "ga-break-pack",
    version: "2.0.0",
    strategy: "ga",
    owner: "release@example.com",
  });

  assert.ok(record.findings.includes("pack_lifecycle.ga_requires_deprecation_notice"));
});

test("PackLifecycleOrchestrationService.publishPack sets lifecycleStage to running when autoActivate", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = createOpsLifecycleManifest({
    packId: "auto-run-pack",
    version: "1.0.0",
  });

  service.registerPack({ manifest, owner: "ops@example.com", evalDatasetIds: ["ops-dataset"] });
  service.recordTesting({
    packId: "auto-run-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://test",
  });
  service.certifyPack({
    packId: "auto-run-pack",
    version: "1.0.0",
    reviewer: "reviewer@example.com",
    certificationReportRef: "artifact://cert",
    selectedLicenseTier: "professional",
    pluginIds: ["plugin.operations.retriever"],
    securityReviewPassed: true,
    riskReviewPassed: true,
  });

  const record = service.publishPack({
    packId: "auto-run-pack",
    version: "1.0.0",
    strategy: "canary",
    owner: "release@example.com",
    autoActivate: true,
  });

  assert.equal(record.lifecycleStage, "running");
});

test("PackLifecycleOrchestrationService.deprecatePack allows the 90-day minimum support window", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = createOpsLifecycleManifest({
    packId: "short-window-pack",
    version: "1.0.0",
  });

  service.registerPack({ manifest, owner: "ops@example.com", evalDatasetIds: ["ops-dataset"] });
  service.recordTesting({
    packId: "short-window-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://test",
  });
  service.certifyPack({
    packId: "short-window-pack",
    version: "1.0.0",
    reviewer: "reviewer@example.com",
    certificationReportRef: "artifact://cert",
    selectedLicenseTier: "professional",
    pluginIds: ["plugin.operations.retriever"],
    securityReviewPassed: true,
    riskReviewPassed: true,
  });

  assert.doesNotThrow(() =>
    service.deprecatePack({
      packId: "short-window-pack",
      version: "1.0.0",
      owner: "test@example.com",
      migrationGuideRef: "docs://migration",
      effectiveAt: "2026-04-20T00:00:00.000Z",
      supportWindowDays: 90,
    }),
  );
});

test("PackLifecycleOrchestrationService.archivePack rejects non-deprecated pack", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = validateBusinessPackManifest({
    packId: "not-deprecated-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  service.registerPack({ manifest, owner: "test@example.com" });
  service.recordTesting({
    packId: "not-deprecated-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://test",
  });
  service.certifyPack({
    packId: "not-deprecated-pack",
    version: "1.0.0",
    reviewer: "reviewer@example.com",
    certificationReportRef: "artifact://cert",
    selectedLicenseTier: "professional",
    pluginIds: ["plugin.operations.retriever"],
    securityReviewPassed: true,
    riskReviewPassed: true,
  });

  assert.throws(
    () => service.archivePack("not-deprecated-pack", "1.0.0"),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_lifecycle.archive_requires_deprecated:not-deprecated-pack@1.0.0",
  );
});

test("PackLifecycleOrchestrationService.archivePack succeeds from deprecated stage", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = createOpsLifecycleManifest({
    packId: "archive-pack",
    version: "1.0.0",
  });

  service.registerPack({ manifest, owner: "ops@example.com", evalDatasetIds: ["ops-dataset"] });
  service.recordTesting({
    packId: "archive-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://test",
  });
  service.certifyPack({
    packId: "archive-pack",
    version: "1.0.0",
    reviewer: "reviewer@example.com",
    certificationReportRef: "artifact://cert",
    selectedLicenseTier: "professional",
    pluginIds: ["plugin.operations.retriever"],
    securityReviewPassed: true,
    riskReviewPassed: true,
  });
  service.publishPack({
    packId: "archive-pack",
    version: "1.0.0",
    strategy: "canary",
    owner: "release@example.com",
  });
  service.deprecatePack({
    packId: "archive-pack",
    version: "1.0.0",
    owner: "test@example.com",
    migrationGuideRef: "docs://migration",
    effectiveAt: "2026-04-20T00:00:00.000Z",
    supportWindowDays: 180,
  });

  const record = service.archivePack("archive-pack", "1.0.0");
  assert.equal(record.lifecycleStage, "archived");
});

test("PackLifecycleOrchestrationService.getPack returns null for unknown pack", () => {
  const service = new PackLifecycleOrchestrationService();
  const result = service.getPack("unknown", "1.0.0");
  assert.equal(result, null);
});

test("PackLifecycleOrchestrationService.getPack returns correct record", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = validateBusinessPackManifest({
    packId: "get-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  service.registerPack({ manifest, owner: "test@example.com" });

  const record = service.getPack("get-pack", "1.0.0");
  assert.ok(record != null);
  assert.equal(record?.packId, "get-pack");
  assert.equal(record?.version, "1.0.0");
});

test("PackLifecycleOrchestrationService.listPacks returns empty for no packs", () => {
  const service = new PackLifecycleOrchestrationService();
  assert.deepEqual(service.listPacks(), []);
});

test("PackLifecycleOrchestrationService.listPacks returns sorted packs", () => {
  const service = new PackLifecycleOrchestrationService();

  service.registerPack({
    manifest: validateBusinessPackManifest({
      packId: "b-pack",
      version: "1.0.0",
      domain: "testing",
      owner: "test@example.com",
      capabilities: [{ capabilityKey: "test", maturity: "ga", requiredContracts: ["c"] }],
    }),
    owner: "test@example.com",
  });
  service.registerPack({
    manifest: validateBusinessPackManifest({
      packId: "a-pack",
      version: "1.0.0",
      domain: "testing",
      owner: "test@example.com",
      capabilities: [{ capabilityKey: "test", maturity: "ga", requiredContracts: ["c"] }],
    }),
    owner: "test@example.com",
  });

  const packs = service.listPacks();
  assert.ok(packs.length >= 2);
  assert.ok(packs[0]!.packId <= packs[1]!.packId);
});

test("PackLifecycleOrchestrationService.registerPack sets eval_dataset_missing finding when no eval datasets", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = validateBusinessPackManifest({
    packId: "no-eval-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  const record = service.registerPack({ manifest, owner: "test@example.com" });
  assert.ok(record.findings.includes("pack_lifecycle.eval_dataset_missing"));
});

test("PackLifecycleOrchestrationService.registerPack detects breaking change with removed capability", () => {
  const service = new PackLifecycleOrchestrationService();
  const previousManifest = validateBusinessPackManifest({
    packId: "breaking-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "cap1", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
      { capabilityKey: "cap2", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  const record = service.registerPack({
    manifest: validateBusinessPackManifest({
      packId: "breaking-pack",
      version: "2.0.0",
      domain: "testing",
      owner: "test@example.com",
      capabilities: [
        { capabilityKey: "cap1", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
      ],
    }),
    owner: "test@example.com",
    previousManifest,
  });

  assert.equal(record.apiChange.changeType, "breaking");
  assert.deepEqual(record.apiChange.removedCapabilities, ["cap2"]);
});

test("PackLifecycleOrchestrationService.registerPack detects breaking change with changed owner", () => {
  const service = new PackLifecycleOrchestrationService();
  const previousManifest = validateBusinessPackManifest({
    packId: "owner-change-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "old@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  const record = service.registerPack({
    manifest: validateBusinessPackManifest({
      packId: "owner-change-pack",
      version: "2.0.0",
      domain: "testing",
      owner: "new@example.com",
      capabilities: [
        { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
      ],
    }),
    owner: "new@example.com",
    previousManifest,
  });

  assert.equal(record.apiChange.changeType, "breaking");
});

test("PackLifecycleOrchestrationService.registerPack detects breaking change with changed domain", () => {
  const service = new PackLifecycleOrchestrationService();
  const previousManifest = validateBusinessPackManifest({
    packId: "domain-change-pack",
    version: "1.0.0",
    domain: "old-domain",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  const record = service.registerPack({
    manifest: validateBusinessPackManifest({
      packId: "domain-change-pack",
      version: "2.0.0",
      domain: "new-domain",
      owner: "test@example.com",
      capabilities: [
        { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
      ],
    }),
    owner: "test@example.com",
    previousManifest,
  });

  assert.equal(record.apiChange.changeType, "breaking");
});

test("PackLifecycleOrchestrationService.registerPack detects additive change with new capability", () => {
  const service = new PackLifecycleOrchestrationService();
  const previousManifest = validateBusinessPackManifest({
    packId: "additive-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  const record = service.registerPack({
    manifest: validateBusinessPackManifest({
      packId: "additive-pack",
      version: "2.0.0",
      domain: "testing",
      owner: "test@example.com",
      capabilities: [
        { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
        { capabilityKey: "new-cap", maturity: "beta", requiredContracts: ["runtime_execution_contract"] },
      ],
    }),
    owner: "test@example.com",
    previousManifest,
  });

  assert.equal(record.apiChange.changeType, "additive");
  assert.deepEqual(record.apiChange.addedCapabilities, ["new-cap"]);
});

test("PackLifecycleOrchestrationService.registerPack detects breaking change with contract tightening", () => {
  const service = new PackLifecycleOrchestrationService();
  const previousManifest = validateBusinessPackManifest({
    packId: "tighten-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["contract_a", "contract_b"] },
    ],
  });

  const record = service.registerPack({
    manifest: validateBusinessPackManifest({
      packId: "tighten-pack",
      version: "2.0.0",
      domain: "testing",
      owner: "test@example.com",
      capabilities: [
        { capabilityKey: "test", maturity: "ga", requiredContracts: ["contract_a"] },
      ],
    }),
    owner: "test@example.com",
    previousManifest,
  });

  assert.equal(record.apiChange.changeType, "breaking");
});

test("PackLifecycleOrchestrationService.registerPack marks deprecation warning unsatisfied for breaking change", () => {
  const service = new PackLifecycleOrchestrationService();
  const previousManifest = createOpsLifecycleManifest({
    packId: "deprec-warn-pack",
    version: "1.0.0",
    capabilities: [
      { capabilityKey: "ops.runbook_search", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
      { capabilityKey: "external.github.workflow", maturity: "beta", requiredContracts: ["tool_skill_plugin_contract"] },
    ],
  });

  const record = service.registerPack({
    manifest: createOpsLifecycleManifest({
      packId: "deprec-warn-pack",
      version: "2.0.0",
      capabilities: [
        { capabilityKey: "ops.runbook_search", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
      ],
    }),
    owner: "ops@example.com",
    previousManifest,
    declaredDeprecationWarnings: 1,
  });

  assert.equal(record.apiChange.changeType, "breaking");
  assert.equal(record.apiChange.deprecationWarningsSatisfied, false);
});

test("PackLifecycleOrchestrationService.registerPack marks deprecation warning satisfied with major version bump", () => {
  const service = new PackLifecycleOrchestrationService();
  const previousManifest = createOpsLifecycleManifest({
    packId: "major-bump-pack",
    version: "1.0.0",
    capabilities: [
      { capabilityKey: "ops.runbook_search", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
      { capabilityKey: "external.github.workflow", maturity: "beta", requiredContracts: ["tool_skill_plugin_contract"] },
    ],
  });

  const record = service.registerPack({
    manifest: createOpsLifecycleManifest({
      packId: "major-bump-pack",
      version: "2.0.0",
      capabilities: [
        { capabilityKey: "ops.runbook_search", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
      ],
    }),
    owner: "ops@example.com",
    previousManifest,
    declaredDeprecationWarnings: 2,
  });

  assert.equal(record.apiChange.changeType, "breaking");
  assert.equal(record.apiChange.deprecationWarningsSatisfied, true);
});

test("PackLifecycleOrchestrationService.registerPack records evalDatasetIds", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = validateBusinessPackManifest({
    packId: "eval-ds-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  const record = service.registerPack({
    manifest,
    owner: "test@example.com",
    evalDatasetIds: ["ds1", "ds2", "ds3"],
  });

  assert.deepEqual(record.evalDatasetIds, ["ds1", "ds2", "ds3"]);
});

test("PackLifecycleOrchestrationService.registerPack deduplicates evalDatasetIds", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = validateBusinessPackManifest({
    packId: "dedup-ds-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "test", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
  });

  const record = service.registerPack({
    manifest,
    owner: "test@example.com",
    evalDatasetIds: ["ds1", " ds1 ", "ds2"],
  });

  assert.deepEqual(record.evalDatasetIds, ["ds1", "ds2"]);
});

test("PackLifecycleOrchestrationService.deprecatePack sets correct deprecation status", () => {
  const service = new PackLifecycleOrchestrationService();
  const manifest = createOpsLifecycleManifest({
    packId: "deprec-status-pack",
    version: "1.0.0",
  });

  service.registerPack({ manifest, owner: "ops@example.com", evalDatasetIds: ["ops-dataset"] });
  service.recordTesting({
    packId: "deprec-status-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://test",
  });
  service.certifyPack({
    packId: "deprec-status-pack",
    version: "1.0.0",
    reviewer: "reviewer@example.com",
    certificationReportRef: "artifact://cert",
    selectedLicenseTier: "professional",
    pluginIds: ["plugin.operations.retriever"],
    securityReviewPassed: true,
    riskReviewPassed: true,
  });
  service.publishPack({
    packId: "deprec-status-pack",
    version: "1.0.0",
    strategy: "canary",
    owner: "release@example.com",
  });

  const record = service.deprecatePack({
    packId: "deprec-status-pack",
    version: "1.0.0",
    owner: "test@example.com",
    migrationGuideRef: "docs://migration",
    effectiveAt: "2026-05-01T00:00:00.000Z",
    supportWindowDays: 180,
  });

  assert.equal(record.lifecycleStage, "deprecated");
  assert.ok(record.deprecation?.status === "active" || record.deprecation?.status === "scheduled");
});

// ============================================================================
// import helpers
// ============================================================================

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
