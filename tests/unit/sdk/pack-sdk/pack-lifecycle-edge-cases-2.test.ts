import assert from "node:assert/strict";
import test from "node:test";

import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import {
  PackLifecycleOrchestrationService,
  validateBusinessPackManifest,
} from "../../../../src/sdk/pack-sdk/index.js";

function createManifest(overrides: Partial<Parameters<typeof validateBusinessPackManifest>[0]> = {}) {
  return validateBusinessPackManifest({
    packId: "test-pack",
    version: "1.0.0",
    domainId: "testing",
    domain: "testing",
    owner: "test@example.com",
    capabilities: [
      { capabilityKey: "query.execute", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
    ],
    ...overrides,
  });
}

test("PackLifecycleOrchestrationService rejects duplicate registration", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest(),
    owner: "test@example.com",
  });

  assert.throws(
    () =>
      service.registerPack({
        manifest: createManifest(),
        owner: "test@example.com",
      }),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_lifecycle.already_registered:test-pack@1.0.0",
  );
});

test("PackLifecycleOrchestrationService.getPack returns null for non-existent pack", () => {
  const service = new PackLifecycleOrchestrationService();
  const result = service.getPack("non-existent", "1.0.0");
  assert.equal(result, null);
});

test("PackLifecycleOrchestrationService.getPack returns record for existing pack", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest(),
    owner: "test@example.com",
  });

  const result = service.getPack("test-pack", "1.0.0");
  assert.ok(result !== null);
  assert.equal(result?.packId, "test-pack");
});

test("PackLifecycleOrchestrationService.listPacks returns all registered packs sorted", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest({ packId: "zebra-pack", version: "1.0.0" }),
    owner: "test@example.com",
  });
  service.registerPack({
    manifest: createManifest({ packId: "alpha-pack", version: "2.0.0" }),
    owner: "test@example.com",
  });

  const packs = service.listPacks();
  assert.equal(packs.length, 2);
  assert.equal(packs[0]?.packId, "alpha-pack");
  assert.equal(packs[1]?.packId, "zebra-pack");
});

test("PackLifecycleOrchestrationService.recordTesting generates findings for low coverage", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest(),
    owner: "test@example.com",
  });

  const result = service.recordTesting({
    packId: "test-pack",
    version: "1.0.0",
    coveragePercent: 60,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "ref",
  });

  assert.equal(result.testing?.verdict, "failed");
  assert.ok(result.testing?.findings.includes("pack_lifecycle.coverage_below_threshold"));
});

test("PackLifecycleOrchestrationService.recordTesting generates findings for failed mock tests", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest(),
    owner: "test@example.com",
  });

  const result = service.recordTesting({
    packId: "test-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: false,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "ref",
  });

  assert.equal(result.testing?.verdict, "failed");
  assert.ok(result.testing?.findings.includes("pack_lifecycle.mock_tests_failed"));
});

test("PackLifecycleOrchestrationService.recordTesting generates findings for failed staging integration", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest(),
    owner: "test@example.com",
  });

  const result = service.recordTesting({
    packId: "test-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: false,
    evalPassed: true,
    reportRef: "ref",
  });

  assert.equal(result.testing?.verdict, "failed");
  assert.ok(result.testing?.findings.includes("pack_lifecycle.staging_integration_failed"));
});

test("PackLifecycleOrchestrationService.recordTesting generates findings for failed eval gate", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest(),
    owner: "test@example.com",
  });

  const result = service.recordTesting({
    packId: "test-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: false,
    reportRef: "ref",
  });

  assert.equal(result.testing?.verdict, "failed");
  assert.ok(result.testing?.findings.includes("pack_lifecycle.eval_gate_failed"));
});

test("PackLifecycleOrchestrationService.certifyPack generates findings for failed security review", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest(),
    owner: "test@example.com",
  });
  service.recordTesting({
    packId: "test-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "ref",
  });

  const result = service.certifyPack({
    packId: "test-pack",
    version: "1.0.0",
    reviewer: "reviewer@example.com",
    certificationReportRef: "ref",
    selectedLicenseTier: "enterprise",
    securityReviewPassed: false,
    riskReviewPassed: true,
  });

  assert.equal(result.certification?.verdict, "blocked");
  assert.ok(result.findings.includes("pack_lifecycle.security_review_failed"));
});

test("PackLifecycleOrchestrationService.certifyPack generates findings for failed risk review", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest(),
    owner: "test@example.com",
  });
  service.recordTesting({
    packId: "test-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "ref",
  });

  const result = service.certifyPack({
    packId: "test-pack",
    version: "1.0.0",
    reviewer: "reviewer@example.com",
    certificationReportRef: "ref",
    selectedLicenseTier: "enterprise",
    securityReviewPassed: true,
    riskReviewPassed: false,
  });

  assert.equal(result.certification?.verdict, "blocked");
  assert.ok(result.findings.includes("pack_lifecycle.risk_review_failed"));
});

test("PackLifecycleOrchestrationService.publishPack requires certification before publish", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest(),
    owner: "test@example.com",
  });
  service.recordTesting({
    packId: "test-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "ref",
  });
  // Skip certification, go straight to publish - should fail
  assert.throws(
    () =>
      service.publishPack({
        packId: "test-pack",
        version: "1.0.0",
        strategy: "canary",
        owner: "release@example.com",
      }),
    (error: unknown) =>
      error instanceof ValidationError && error.code.startsWith("pack_lifecycle."),
  );
});

test("PackLifecycleOrchestrationService.archivePack only works from deprecated stage", () => {
  const service = new PackLifecycleOrchestrationService();
  service.registerPack({
    manifest: createManifest(),
    owner: "test@example.com",
  });
  service.recordTesting({
    packId: "test-pack",
    version: "1.0.0",
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "ref",
  });
  service.certifyPack({
    packId: "test-pack",
    version: "1.0.0",
    reviewer: "reviewer@example.com",
    certificationReportRef: "ref",
    selectedLicenseTier: "community",
    pluginIds: ["plugin.operations.retriever"],
    securityReviewPassed: true,
    riskReviewPassed: true,
  });

  assert.throws(
    () => service.archivePack("test-pack", "1.0.0"),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_lifecycle.archive_requires_deprecated:test-pack@1.0.0",
  );
});

test("PackLifecycleOrchestrationService.getMutableRecord throws for non-existent pack", () => {
  const service = new PackLifecycleOrchestrationService();

  assert.throws(
    () =>
      (service as any).getMutableRecord("non-existent", "1.0.0"),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "pack_lifecycle.not_found:non-existent@1.0.0",
  );
});

test("PackLifecycleOrchestrationService handles pack with no eval datasets", () => {
  const service = new PackLifecycleOrchestrationService();

  const result = service.registerPack({
    manifest: createManifest(),
    owner: "test@example.com",
    evalDatasetIds: [],
  });

  assert.ok(result.findings.includes("pack_lifecycle.eval_dataset_missing"));
});

test("PackLifecycleOrchestrationService handles pack with eval datasets", () => {
  const service = new PackLifecycleOrchestrationService();

  const result = service.registerPack({
    manifest: createManifest(),
    owner: "test@example.com",
    evalDatasetIds: ["dataset1", "dataset2"],
  });

  assert.ok(!result.findings.includes("pack_lifecycle.eval_dataset_missing"));
});

test("PackLifecycleOrchestrationService handles empty evalDatasetIds", () => {
  const service = new PackLifecycleOrchestrationService();

  const result = service.registerPack({
    manifest: createManifest(),
    owner: "test@example.com",
    evalDatasetIds: undefined,
  });

  assert.ok(result.findings.includes("pack_lifecycle.eval_dataset_missing"));
});
