import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import { PackLifecycleOrchestrationService } from "../../../../src/sdk/pack-sdk/pack-lifecycle-orchestration-service.js";
import { validateBusinessPackManifest as rawValidateBusinessPackManifest } from "../../../../src/sdk/pack-sdk/pack-manifest.js";

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
    packId: "test-pack",
    version: "1.0.0",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "workflow.suggest", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
    ...overrides,
  });
}

test("PackLifecycleOrchestrationService.getPack returns null for non-existent pack", () => {
  const service = new PackLifecycleOrchestrationService();
  const result = service.getPack("non-existent", "1.0.0");
  assert.equal(result, null);
});

test("PackLifecycleOrchestrationService.listPacks returns empty array initially", () => {
  const service = new PackLifecycleOrchestrationService();
  const result = service.listPacks();
  assert.deepEqual(result, []);
});

test("PackLifecycleOrchestrationService.listPacks returns registered packs", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest({ packId: "pack-a", version: "1.0.0" }),
    owner: "owner@example.com",
  });
  service.registerPack({
    manifest: createManifest({ packId: "pack-b", version: "1.0.0" }),
    owner: "owner@example.com",
  });

  const result = service.listPacks();
  assert.equal(result.length, 2);
});

test("PackLifecycleOrchestrationService.registerPack throws for duplicate pack version", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest(),
    owner: "owner@example.com",
  });

  assert.throws(
    () =>
      service.registerPack({
        manifest: createManifest(),
        owner: "owner@example.com",
      }),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_lifecycle.already_registered:test-pack@1.0.0",
  );
});

test("PackLifecycleOrchestrationService.recordTesting throws for non-existent pack", () => {
  const service = new PackLifecycleOrchestrationService();

  assert.throws(
    () =>
      service.recordTesting({
        packId: "non-existent",
        version: "1.0.0",
        coveragePercent: 90,
        mockTestsPassed: true,
        stagingIntegrationPassed: true,
        evalPassed: true,
        reportRef: "artifact://test",
      }),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_lifecycle.not_found:non-existent@1.0.0",
  );
});

test("PackLifecycleOrchestrationService.recordTesting throws for invalid lifecycle stage", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest(),
    owner: "owner@example.com",
  });
  service.recordTesting({
    packId: "test-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://test",
  });
  service.certifyPack({
    packId: "test-pack",
    version: "1.0.0",
    reviewer: "reviewer@example.com",
    certificationReportRef: "artifact://cert",
    selectedLicenseTier: "community",
    pluginIds: ["plugin.core.basic-planner"],
    securityReviewPassed: true,
    riskReviewPassed: true,
  });

  assert.throws(
    () =>
      service.recordTesting({
        packId: "test-pack",
        version: "1.0.0",
        coveragePercent: 90,
        mockTestsPassed: true,
        stagingIntegrationPassed: true,
        evalPassed: true,
        reportRef: "artifact://test",
      }),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_lifecycle.invalid_transition:test-pack@1.0.0",
  );
});

test("PackLifecycleOrchestrationService.certifyPack throws for non-existent pack", () => {
  const service = new PackLifecycleOrchestrationService();

  assert.throws(
    () =>
      service.certifyPack({
        packId: "non-existent",
        version: "1.0.0",
        reviewer: "reviewer@example.com",
        certificationReportRef: "artifact://cert",
        selectedLicenseTier: "community",
        securityReviewPassed: true,
        riskReviewPassed: true,
      }),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_lifecycle.not_found:non-existent@1.0.0",
  );
});

test("PackLifecycleOrchestrationService.certifyPack throws when testing not passed", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest(),
    owner: "owner@example.com",
  });

  assert.throws(
    () =>
      service.certifyPack({
        packId: "test-pack",
        version: "1.0.0",
        reviewer: "reviewer@example.com",
        certificationReportRef: "artifact://cert",
        selectedLicenseTier: "community",
        securityReviewPassed: true,
        riskReviewPassed: true,
      }),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_lifecycle.testing_not_passed:test-pack@1.0.0",
  );
});

test("PackLifecycleOrchestrationService.publishPack throws for non-existent pack", () => {
  const service = new PackLifecycleOrchestrationService();

  assert.throws(
    () =>
      service.publishPack({
        packId: "non-existent",
        version: "1.0.0",
        strategy: "ga",
        owner: "owner@example.com",
      }),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_lifecycle.not_found:non-existent@1.0.0",
  );
});

test("PackLifecycleOrchestrationService.publishPack throws when not certified", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest(),
    owner: "owner@example.com",
  });
  service.recordTesting({
    packId: "test-pack",
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
        packId: "test-pack",
        version: "1.0.0",
        strategy: "ga",
        owner: "owner@example.com",
      }),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_lifecycle.not_certified:test-pack@1.0.0",
  );
});

test("PackLifecycleOrchestrationService.deprecatePack throws for non-existent pack", () => {
  const service = new PackLifecycleOrchestrationService();

  assert.throws(
    () =>
      service.deprecatePack({
        packId: "non-existent",
        version: "1.0.0",
        owner: "owner@example.com",
        migrationGuideRef: "docs://migration",
        effectiveAt: "2026-05-01T00:00:00.000Z",
        supportWindowDays: 180,
      }),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_lifecycle.not_found:non-existent@1.0.0",
  );
});

test("PackLifecycleOrchestrationService.archivePack throws for non-existent pack", () => {
  const service = new PackLifecycleOrchestrationService();

  assert.throws(
    () => service.archivePack("non-existent", "1.0.0"),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_lifecycle.not_found:non-existent@1.0.0",
  );
});

test("PackLifecycleOrchestrationService.archivePack throws when not deprecated", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest(),
    owner: "owner@example.com",
  });

  assert.throws(
    () => service.archivePack("test-pack", "1.0.0"),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_lifecycle.archive_requires_deprecated:test-pack@1.0.0",
  );
});

test("PackLifecycleOrchestrationService handles register with missing eval dataset finding", () => {
  const service = new PackLifecycleOrchestrationService();
  const record = service.registerPack({
    manifest: createManifest(),
    owner: "owner@example.com",
    evalDatasetIds: [],
  });

  assert.ok(record.findings.includes("pack_lifecycle.eval_dataset_missing"));
});

test("PackLifecycleOrchestrationService handles initial version registration", () => {
  const service = new PackLifecycleOrchestrationService();
  const record = service.registerPack({
    manifest: createManifest(),
    owner: "owner@example.com",
    evalDatasetIds: ["dataset-1"],
  });

  assert.equal(record.apiChange.changeType, "initial");
  assert.equal(record.apiChange.previousVersion, null);
  assert.ok(record.lifecycleStage, "development");
});

test("PackLifecycleOrchestrationService handles breaking change detection", () => {
  const service = new PackLifecycleOrchestrationService();
  const previous = createManifest({ capabilities: [
    { capabilityKey: "test.capability", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    { capabilityKey: "removed.cap", maturity: "ga", requiredContracts: [] },
  ]});

  const record = service.registerPack({
    manifest: createManifest({ version: "2.0.0" }),
    owner: "owner@example.com",
    evalDatasetIds: ["dataset-1"],
    previousManifest: previous,
    declaredDeprecationWarnings: 2,
  });

  assert.equal(record.apiChange.changeType, "breaking");
  assert.ok(record.apiChange.removedCapabilities.includes("removed.cap"));
});

test("PackLifecycleOrchestrationService handles deprecation with active status", () => {
  const service = new PackLifecycleOrchestrationService();
  setupPublishedPack(service);

  const deprecated = service.deprecatePack({
    packId: "test-pack",
    version: "1.0.0",
    owner: "owner@example.com",
    migrationGuideRef: "docs://migration",
    effectiveAt: "2024-01-01T00:00:00.000Z", // past date
    supportWindowDays: 180,
  });

  assert.equal(deprecated.lifecycleStage, "deprecated");
  assert.equal(deprecated.deprecation?.status, "active");
});

test("PackLifecycleOrchestrationService handles deprecation with scheduled status", () => {
  const service = new PackLifecycleOrchestrationService();
  setupPublishedPack(service);

  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 1);
  const deprecated = service.deprecatePack({
    packId: "test-pack",
    version: "1.0.0",
    owner: "owner@example.com",
    migrationGuideRef: "docs://migration",
    effectiveAt: futureDate.toISOString(),
    supportWindowDays: 180,
  });

  assert.equal(deprecated.lifecycleStage, "deprecated");
  assert.equal(deprecated.deprecation?.status, "scheduled");
});

test("PackLifecycleOrchestrationService publishes with autoActivate false", () => {
  const service = new PackLifecycleOrchestrationService();
  setupCertifiedPack(service);

  const published = service.publishPack({
    packId: "test-pack",
    version: "1.0.0",
    strategy: "canary",
    owner: "release@example.com",
    autoActivate: false,
  });

  assert.equal(published.rollout?.status, "ready");
  assert.equal(published.lifecycleStage, "published");
});

test("PackLifecycleOrchestrationService publishes with shadow strategy", () => {
  const service = new PackLifecycleOrchestrationService();
  setupCertifiedPack(service);

  const published = service.publishPack({
    packId: "test-pack",
    version: "1.0.0",
    strategy: "shadow",
    owner: "release@example.com",
    autoActivate: true,
  });

  assert.equal(published.rollout?.strategy, "shadow");
});

test("PackLifecycleOrchestrationService handles GA with deprecation notice", () => {
  const service = new PackLifecycleOrchestrationService();
  setupCertifiedPackWithDeprecation(service);

  const published = service.publishPack({
    packId: "test-pack",
    version: "1.0.0",
    strategy: "ga",
    owner: "release@example.com",
    autoActivate: true,
  });

  assert.equal(published.rollout?.status, "active");
  assert.equal(published.lifecycleStage, "running");
});

test("PackLifecycleOrchestrationService blocks GA without deprecation for breaking change", () => {
  const service = new PackLifecycleOrchestrationService();
  setupCertifiedPack(service, {
    previousManifest: createManifest({
      version: "0.9.0",
      capabilities: [
        { capabilityKey: "workflow.suggest", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
        { capabilityKey: "removed.cap", maturity: "ga", requiredContracts: [] },
      ],
    }),
    declaredDeprecationWarnings: 2,
  });

  const published = service.publishPack({
    packId: "test-pack",
    version: "1.0.0",
    strategy: "ga",
    owner: "release@example.com",
    autoActivate: true,
  });

  assert.equal(published.rollout?.status, "blocked");
  assert.ok(published.findings.includes("pack_lifecycle.ga_requires_deprecation_notice"));
});

// Helper functions
function setupPublishedPack(service: PackLifecycleOrchestrationService) {
  service.registerPack({
    manifest: createManifest(),
    owner: "owner@example.com",
    evalDatasetIds: ["dataset-1"],
  });
  service.recordTesting({
    packId: "test-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://test",
  });
  service.certifyPack({
    packId: "test-pack",
    version: "1.0.0",
    reviewer: "reviewer@example.com",
    certificationReportRef: "artifact://cert",
    selectedLicenseTier: "community",
    pluginIds: ["plugin.core.basic-planner"],
    securityReviewPassed: true,
    riskReviewPassed: true,
  });
  service.publishPack({
    packId: "test-pack",
    version: "1.0.0",
    strategy: "canary",
    owner: "release@example.com",
    autoActivate: true,
  });
}

function setupCertifiedPack(
  service: PackLifecycleOrchestrationService,
  options: {
    previousManifest?: ReturnType<typeof validateBusinessPackManifest>;
    declaredDeprecationWarnings?: number;
  } = {},
) {
  service.registerPack({
    manifest: createManifest(),
    owner: "owner@example.com",
    evalDatasetIds: ["dataset-1"],
    previousManifest: options.previousManifest,
    declaredDeprecationWarnings: options.declaredDeprecationWarnings,
  });
  service.recordTesting({
    packId: "test-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact://test",
  });
  service.certifyPack({
    packId: "test-pack",
    version: "1.0.0",
    reviewer: "reviewer@example.com",
    certificationReportRef: "artifact://cert",
    selectedLicenseTier: "community",
    pluginIds: ["plugin.core.basic-planner"],
    securityReviewPassed: true,
    riskReviewPassed: true,
  });
}

function setupCertifiedPackWithDeprecation(service: PackLifecycleOrchestrationService) {
  setupCertifiedPack(service);
  service.deprecatePack({
    packId: "test-pack",
    version: "1.0.0",
    owner: "owner@example.com",
    migrationGuideRef: "docs://migration",
    effectiveAt: "2026-05-01T00:00:00.000Z",
    supportWindowDays: 180,
  });
}
