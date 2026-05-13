/**
 * @fileoverview Tests for Pack SDK
 */

import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  PackScaffoldService,
  type ScaffoldConfig,
} from "../../../../src/sdk/pack-sdk/pack-scaffold-service.js";
import {
  PackTestLocalService,
  type TestOptions,
} from "../../../../src/sdk/pack-sdk/pack-test-local-service.js";
import { validateBusinessPackManifest } from "../../../../src/sdk/pack-sdk/pack-manifest.js";

test("PackScaffoldService.listTemplates returns all template types", () => {
  const service = new PackScaffoldService();
  const templates = service.listTemplates();
  assert.equal(templates.length, 3);
  assert.ok(templates.find((t) => t.id === "minimal"));
  assert.ok(templates.find((t) => t.id === "standard"));
  assert.ok(templates.find((t) => t.id === "full"));
});

test("PackScaffoldService.scaffold creates pack structure for minimal template", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);
    const config: ScaffoldConfig = {
      packId: "test-pack",
      name: "Test Pack",
      template: "minimal",
      domain: "testing",
      owner: "test@example.com",
      riskLevel: "low",
    };

    const result = service.scaffold(config);
    assert.ok(result.rootDir.includes("test-pack"));
    assert.ok(result.files.length >= 4);
    assert.ok(result.manifestPath.endsWith("manifest.json"));
    assert.ok(result.entryPointPath.endsWith("src/index.ts"));
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("PackScaffoldService.scaffold creates pack structure for standard template", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);
    const config: ScaffoldConfig = {
      packId: "standard-pack",
      name: "Standard Pack",
      template: "standard",
      domain: "testing",
      owner: "test@example.com",
      riskLevel: "medium",
    };

    const result = service.scaffold(config);
    assert.ok(result.files.length >= 7); // standard has more files
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("PackScaffoldService.scaffold validates pack ID format", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);
    const config: ScaffoldConfig = {
      packId: "Invalid Pack ID!", // Invalid: spaces and uppercase
      name: "Test Pack",
      template: "minimal",
      domain: "testing",
      owner: "test@example.com",
      riskLevel: "low",
    };

    assert.throws(() => service.scaffold(config), /Pack ID/i);
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("PackScaffoldService.scaffold validates empty pack ID", () => {
  const service = new PackScaffoldService();
  assert.throws(
    () => service.scaffold({
      packId: "",
      name: "Test Pack",
      template: "minimal",
      domain: "testing",
      owner: "test@example.com",
      riskLevel: "low",
    }),
    /Pack ID/i,
  );
});

test("PackScaffoldService.scaffold rejects template injection in name", () => {
  const service = new PackScaffoldService();
  assert.throws(
    () => service.scaffold({
      packId: "safe-pack",
      name: "Bad ${process.env.SECRET}",
      template: "minimal",
      domain: "testing",
      owner: "test@example.com",
      riskLevel: "low",
    }),
    (error: unknown) => error instanceof Error && /unsupported template control characters/i.test(error.message),
  );
});

test("PackScaffoldService.scaffold rejects template injection in domain", () => {
  const service = new PackScaffoldService();
  assert.throws(
    () => service.scaffold({
      packId: "safe-pack",
      name: "Safe Pack",
      template: "minimal",
      domain: "ops\nrm -rf /",
      owner: "test@example.com",
      riskLevel: "low",
    }),
    (error: unknown) => error instanceof Error && /cannot contain newlines|template control characters/i.test(error.message),
  );
});

test("PackScaffoldService.scaffold trims sanitized config before rendering files", () => {
  const service = new PackScaffoldService();
  const tmpDir = mkdtempSync(join(tmpdir(), "pack-scaffold-test-"));
  const originalCwd = process.cwd();

  try {
    process.chdir(tmpDir);
    const result = service.scaffold({
      packId: "trimmed-pack",
      name: "  Trimmed Pack  ",
      template: "minimal",
      domain: "trimmed.domain",
      owner: " owner@example.com ",
      riskLevel: "low",
    });

    const manifest = JSON.parse(readFileSync(result.manifestPath, "utf8"));
    assert.equal(manifest.owner, "owner@example.com");
    assert.equal(manifest.domainId, "trimmed.domain");
  } finally {
    process.chdir(originalCwd);
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("PackTestLocalService.test runs unit tests and returns report", async () => {
  const service = new PackTestLocalService();
  const options: TestOptions = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "unit",
    mockLlm: false,
    recordArtifacts: false,
  };

  const report = await service.test(options);
  assert.equal(report.packId, "test-pack");
  assert.equal(report.version, "1.0.0");
  assert.equal(report.mode, "unit");
  assert.ok(typeof report.passed === "boolean");
  assert.ok(typeof report.durationMs === "number");
  assert.ok(typeof report.coveragePercent === "number");
});

test("PackTestLocalService.test runs integration tests with mock LLM", async () => {
  const service = new PackTestLocalService();
  service.configureMockLlm({
    responses: [{ content: "integration ok" }],
  });
  service.loadFixtures({
    "integration:test-pack:1": {
      mode: "integration",
      packId: "test-pack",
      caseId: "integration_case",
      passed: true,
      requiredToolIds: ["tool-1"],
    },
  });
  service.addMockToolResult({
    toolId: "tool-1",
    success: true,
    output: { ok: true },
    durationMs: 5,
  });
  const options: TestOptions = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "integration",
    mockLlm: true,
    recordArtifacts: false,
  };

  const report = await service.test(options);
  assert.equal(report.mode, "integration");
  assert.equal(report.casesFailed, 0);
});

test("PackTestLocalService.test runs simulation tests with eval dataset", async () => {
  const service = new PackTestLocalService();
  service.loadFixtures({
    "simulation:test-pack:1": {
      mode: "simulation",
      packId: "test-pack",
      caseId: "simulation_case",
      passed: true,
      requiresEvalDataset: true,
    },
  });
  const options: TestOptions = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "simulation",
    mockLlm: true,
    evalDatasetId: "dataset-123",
    recordArtifacts: true,
  };

  const report = await service.test(options);
  assert.equal(report.mode, "simulation");
  assert.ok(report.artifacts.length > 0);
  assert.equal(report.casesFailed, 0);
});

test("PackTestLocalService.validateTestOptions rejects invalid mode", async () => {
  const service = new PackTestLocalService();
  const options = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "invalid" as any,
    mockLlm: false,
    recordArtifacts: false,
  };

  await assert.rejects(
    () => service.test(options as any),
    /Mode must be one of/i,
  );
});

test("PackTestLocalService.configureMockLlm sets up mock responses", () => {
  const service = new PackTestLocalService();
  service.configureMockLlm({
    responses: [
      { content: "Mock response 1" },
      { content: "Mock response 2" },
    ],
    delayMs: 100,
  });
  // No error means success
});

test("PackTestLocalService.addMockToolResult registers mock tool", () => {
  const service = new PackTestLocalService();
  service.addMockToolResult({
    toolId: "test-tool",
    success: true,
    output: { result: "ok" },
    durationMs: 10,
  });
  // No error means success
});

test("PackTestLocalService uses fixture failures to drive report output", async () => {
  const service = new PackTestLocalService();
  service.loadFixtures({
    "unit:test-pack:1": {
      mode: "unit",
      packId: "test-pack",
      caseId: "failing_case",
      passed: false,
      coverageWeight: 2,
    },
  });

  const report = await service.test({
    packId: "test-pack",
    version: "1.0.0",
    mode: "unit",
    mockLlm: false,
    recordArtifacts: false,
  });

  assert.equal(report.casesFailed, 1);
  assert.equal(report.passed, false);
});
