import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import {
  PackLifecycleOrchestrationService,
  validateBusinessPackManifest as rawValidateBusinessPackManifest,
} from "../../../../src/sdk/pack-sdk/index.js";

const TEST_PACK_SIGNING = {
  keyId: "test-pack-key",
  signature: "test-pack-signature",
  algorithm: "ed25519",
} as const;

function validateBusinessPackManifest(
  manifest: Parameters<typeof rawValidateBusinessPackManifest>[0],
  options?: Parameters<typeof rawValidateBusinessPackManifest>[1],
) {
  return rawValidateBusinessPackManifest(
    {
      ...manifest,
      signing: manifest.signing === undefined ? TEST_PACK_SIGNING : manifest.signing,
    },
    options,
  );
}

function createManifest(overrides: Partial<ReturnType<typeof validateBusinessPackManifest>> = {}) {
  return validateBusinessPackManifest({
    packId: "ops-pack",
    version: "1.0.0",
    domain: "operations",
    owner: "ops@example.com",
    capabilities: [
      { capabilityKey: "ops.runbook_search", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
      { capabilityKey: "external.github.workflow", maturity: "beta", requiredContracts: ["tool_skill_plugin_contract"] },
    ],
    ...overrides,
  });
}

test("PackLifecycleOrchestrationService registers additive upgrades and completes lifecycle transitions", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest(),
    owner: "ops@example.com",
    evalDatasetIds: ["dataset_ops_pack_v1"],
  });

  const candidate = service.registerPack({
    manifest: createManifest({
      version: "1.1.0",
      capabilities: [
        { capabilityKey: "ops.runbook_search", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
        { capabilityKey: "external.github.workflow", maturity: "beta", requiredContracts: ["tool_skill_plugin_contract"] },
        { capabilityKey: "domain.observe", maturity: "experimental", requiredContracts: ["runtime_execution_contract"] },
      ],
    }),
    owner: "ops@example.com",
    evalDatasetIds: ["dataset_ops_pack_v1_1"],
    previousManifest: createManifest(),
  });

  assert.equal(candidate.apiChange.changeType, "additive");
  assert.deepEqual(candidate.apiChange.addedCapabilities, ["domain.observe"]);

  const tested = service.recordTesting({
    packId: "ops-pack",
    version: "1.1.0",
    coveragePercent: 92,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://tests/ops-pack-1.1.0",
  });
  assert.equal(tested.testing?.verdict, "passed");
  assert.equal(tested.lifecycleStage, "testing");

  const certified = service.certifyPack({
    packId: "ops-pack",
    version: "1.1.0",
    reviewer: "reviewer@example.com",
    certificationReportRef: "artifact://certs/ops-pack-1.1.0",
    selectedLicenseTier: "professional",
    pluginIds: ["plugin.operations.retriever", "plugin.shared.github_adapter"],
    securityReviewPassed: true,
    riskReviewPassed: true,
  });
  assert.equal(certified.certification?.verdict, "certified");
  assert.equal(certified.lifecycleStage, "certified");

  const published = service.publishPack({
    packId: "ops-pack",
    version: "1.1.0",
    strategy: "canary",
    owner: "release@example.com",
    rolloutScope: ["tenant_canary", "marketplace_public"],
    autoActivate: true,
  });
  assert.equal(published.rollout?.status, "active");
  assert.equal(published.lifecycleStage, "running");

  const deprecated = service.deprecatePack({
    packId: "ops-pack",
    version: "1.1.0",
    owner: "ops@example.com",
    migrationGuideRef: "docs://migration/ops-pack-1.1",
    effectiveAt: "2026-04-20T00:00:00.000Z",
    supportWindowDays: 180,
  });
  assert.equal(deprecated.lifecycleStage, "deprecated");

  const archived = service.archivePack("ops-pack", "1.1.0");
  assert.equal(archived.lifecycleStage, "archived");
});

test("PackLifecycleOrchestrationService flags breaking changes without required deprecation warnings", () => {
  const service = new PackLifecycleOrchestrationService();
  const previous = createManifest();

  const candidate = service.registerPack({
    manifest: createManifest({
      version: "2.0.0",
      capabilities: [
        { capabilityKey: "ops.runbook_search", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
      ],
    }),
    owner: "ops@example.com",
    evalDatasetIds: ["dataset_ops_pack_v2"],
    previousManifest: previous,
    declaredDeprecationWarnings: 1,
  });

  assert.equal(candidate.apiChange.changeType, "breaking");
  assert.equal(candidate.apiChange.deprecationWarningsSatisfied, false);
  assert.ok(candidate.findings.includes("pack_lifecycle.deprecation_warning_missing"));
});

test("PackLifecycleOrchestrationService blocks certification when compatibility fails", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest(),
    owner: "ops@example.com",
    evalDatasetIds: ["dataset_ops_pack_v1"],
  });
  service.recordTesting({
    packId: "ops-pack",
    version: "1.0.0",
    coveragePercent: 88,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://tests/ops-pack-v1",
  });

  const certified = service.certifyPack({
    packId: "ops-pack",
    version: "1.0.0",
    reviewer: "reviewer@example.com",
    certificationReportRef: "artifact://certs/ops-pack-v1",
    selectedLicenseTier: "community",
    pluginIds: ["plugin.operations.retriever"],
    securityReviewPassed: true,
    riskReviewPassed: true,
  });

  assert.equal(certified.certification?.verdict, "blocked");
  assert.equal(certified.lifecycleStage, "testing");
  assert.ok(
    certified.findings.includes("pack_lifecycle.license_blocked")
      || certified.findings.includes("pack_lifecycle.missing_plugin:external.github.workflow"),
  );
});

test("PackLifecycleOrchestrationService rejects publish before certification", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest(),
    owner: "ops@example.com",
    evalDatasetIds: ["dataset_ops_pack_v1"],
  });

  assert.throws(
    () =>
      service.publishPack({
        packId: "ops-pack",
        version: "1.0.0",
        strategy: "shadow",
        owner: "release@example.com",
      }),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_lifecycle.not_certified:ops-pack@1.0.0",
  );
});

test("PackLifecycleOrchestrationService enforces minimum deprecation support window", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest(),
    owner: "ops@example.com",
    evalDatasetIds: ["dataset_ops_pack_v1"],
  });
  service.recordTesting({
    packId: "ops-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://tests/ops-pack-v1",
  });
  service.certifyPack({
    packId: "ops-pack",
    version: "1.0.0",
    reviewer: "reviewer@example.com",
    certificationReportRef: "artifact://certs/ops-pack-v1",
    selectedLicenseTier: "professional",
    pluginIds: ["plugin.operations.retriever", "plugin.shared.github_adapter"],
    securityReviewPassed: true,
    riskReviewPassed: true,
  });

  assert.throws(
    () =>
      service.deprecatePack({
        packId: "ops-pack",
        version: "1.0.0",
        owner: "ops@example.com",
        migrationGuideRef: "docs://migration/ops-pack-v1",
        effectiveAt: "2026-04-21T00:00:00.000Z",
        supportWindowDays: 90,
      }),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_lifecycle.support_window_too_short:ops-pack@1.0.0",
  );
});
