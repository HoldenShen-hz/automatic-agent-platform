import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import {
  PackLifecycleOrchestrationService,
  PackPluginCompatibilityService,
  PackScaffoldService,
  PackTestLocalService,
  summarizeCapabilityMatrix,
  validateBusinessPackManifest,
} from "../../../../src/sdk/pack-sdk/index.js";

function createManifest() {
  return {
    packId: " pack-demo ",
    version: " 1.0.0 ",
    domainId: " coding ",
    owner: " owner@example.com ",
    capabilities: [{
      capabilityKey: "workflow.suggest",
      maturity: "ga" as const,
      requiredContracts: ["runtime_execution_contract", "runtime_execution_contract"],
    }],
  };
}

test("validateBusinessPackManifest normalizes current manifest shape", () => {
  const manifest = validateBusinessPackManifest(createManifest());

  assert.equal(manifest.packId, "pack-demo");
  assert.equal(manifest.domainId, "coding");
  assert.equal(manifest.domain, "coding");
  assert.deepEqual(manifest.capabilities[0]?.requiredContracts, ["runtime_execution_contract"]);
});

test("validateBusinessPackManifest rejects empty capability sets", () => {
  assert.throws(
    () =>
      validateBusinessPackManifest({
        ...createManifest(),
        capabilities: [],
      }),
    (error: unknown) => error instanceof ValidationError && error.code === "pack_sdk.empty_capabilities",
  );
});

test("summarizeCapabilityMatrix counts maturity levels", () => {
  const manifest = validateBusinessPackManifest({
    ...createManifest(),
    capabilities: [
      { capabilityKey: "code.generate", maturity: "ga", requiredContracts: ["runtime_execution_contract"] },
      { capabilityKey: "code.review", maturity: "beta", requiredContracts: ["evaluation_contract"] },
      { capabilityKey: "code.eval", maturity: "experimental", requiredContracts: ["evaluation_contract"] },
    ],
  });

  assert.deepEqual(summarizeCapabilityMatrix(manifest), {
    experimental: 1,
    beta: 1,
    ga: 1,
  });
});

test("PackScaffoldService scaffolds a minimal pack", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "pack-sdk-"));
  try {
    const service = new PackScaffoldService();
    const result = service.scaffold({
      packId: "pack-sdk-demo",
      name: "Pack SDK Demo",
      template: "minimal",
      domain: "coding",
      owner: "owner@example.com",
      riskLevel: "low",
      outputRoot,
    });

    assert.ok(result.manifestPath.endsWith("manifest.json"));
    assert.ok(result.files.some((file) => file.endsWith("src/index.ts")));
    assert.equal(service.listTemplates().length, 3);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});

test("PackPluginCompatibilityService reports missing plugin coverage", () => {
  const service = new PackPluginCompatibilityService();
  const report = service.evaluateManifest({
    manifest: validateBusinessPackManifest({
      ...createManifest(),
      capabilities: [{
        capabilityKey: "nonexistent.unmapped.capability",
        maturity: "ga",
        requiredContracts: ["runtime_execution_contract"],
      }],
    }),
    selectedLicenseTier: "community",
  });

  assert.equal(report.verdict, "missing_plugins");
  assert.equal(report.missingPluginCapabilities[0], "nonexistent.unmapped.capability");
});

test("PackLifecycleOrchestrationService tracks testing and certification gates", () => {
  const service = new PackLifecycleOrchestrationService(new PackPluginCompatibilityService());
  const registered = service.registerPack({
    manifest: validateBusinessPackManifest(createManifest()),
    owner: "owner@example.com",
    evalDatasetIds: ["dataset:1"],
  });
  const tested = service.recordTesting({
    packId: registered.packId,
    version: registered.version,
    coveragePercent: 90,
    mockTestsPassed: true,
    stagingIntegrationPassed: true,
    evalPassed: true,
    reportRef: "artifact:test-report",
  });

  assert.equal(tested.lifecycleStage, "testing");

  const certified = service.certifyPack({
    packId: registered.packId,
    version: registered.version,
    reviewer: "reviewer@example.com",
    certificationReportRef: "artifact:certification",
    selectedLicenseTier: "community",
    securityReviewPassed: true,
    riskReviewPassed: true,
  });

  assert.equal(certified.certification?.verdict, "certified");
  assert.equal(certified.lifecycleStage, "certified");
});

test("PackTestLocalService executes deterministic local tests", async () => {
  const service = new PackTestLocalService();
  service.loadFixtures({
    "pack-demo:integration:case-1": {
      coverageWeight: 1,
      passed: true,
    },
  });

  const report = await service.test({
    packId: "pack-demo",
    version: "1.0.0",
    mode: "unit",
    mockLlm: true,
    recordArtifacts: false,
  });

  assert.equal(report.packId, "pack-demo");
  assert.ok(report.casesPassed >= 0);
});
