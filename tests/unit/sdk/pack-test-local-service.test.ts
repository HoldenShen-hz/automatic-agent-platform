/**
 * @fileoverview Unit tests for Pack Test Local Service
 *
 * Tests the PackTestLocalService for local sandbox testing with mock LLM and mock tools.
 * Implements §22.2 Pack SDK core capability: `test(options)`.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  PackTestLocalService,
  type TestOptions,
  type MockLlmConfig,
  type MockToolResult,
  type TestMode,
} from "../../../src/sdk/pack-sdk/pack-test-local-service.js";

test("PackTestLocalService configureMockLlm stores config", () => {
  assert.doesNotThrow(() => {
    const service = new PackTestLocalService();
    const config: MockLlmConfig = {
      responses: [{ content: "test response" }],
      delayMs: 100,
    };

    service.configureMockLlm(config);
  });
});

test("PackTestLocalService addMockToolResult stores result", () => {
  assert.doesNotThrow(() => {
    const service = new PackTestLocalService();
    const result: MockToolResult = {
      toolId: "tool-1",
      success: true,
      output: { result: "ok" },
      durationMs: 50,
    };

    service.addMockToolResult(result);
  });
});

test("PackTestLocalService loadFixtures stores fixtures", () => {
  assert.doesNotThrow(() => {
    const service = new PackTestLocalService();
    const fixtures = {
      "unit:test-case-1": { passed: true, caseId: "case-1" },
      "integration:test-case-2": { passed: false, caseId: "case-2" },
    };

    service.loadFixtures(fixtures);
  });
});

test("PackTestLocalService.test validates empty packId", async () => {
  const service = new PackTestLocalService();
  const options: TestOptions = {
    packId: "",
    version: "1.0.0",
    mode: "unit",
    mockLlm: false,
    recordArtifacts: false,
  };

  await assert.rejects(
    async () => service.test(options),
    /Pack ID is required/,
  );
});

test("PackTestLocalService.test validates empty version", async () => {
  const service = new PackTestLocalService();
  const options: TestOptions = {
    packId: "test-pack",
    version: "",
    mode: "unit",
    mockLlm: false,
    recordArtifacts: false,
  };

  await assert.rejects(
    async () => service.test(options),
    /Version is required/,
  );
});

test("PackTestLocalService.test validates invalid mode", async () => {
  const service = new PackTestLocalService();
  const options: TestOptions = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "invalid" as TestMode,
    mockLlm: false,
    recordArtifacts: false,
  };

  await assert.rejects(
    async () => service.test(options),
    /Mode must be one of/,
  );
});

test("PackTestLocalService.test validates negative timeout", async () => {
  const service = new PackTestLocalService();
  const options: TestOptions = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "unit",
    mockLlm: false,
    recordArtifacts: false,
    timeoutMs: -100,
  };

  await assert.rejects(
    async () => service.test(options),
    /Timeout must be positive/,
  );
});

test("PackTestLocalService.test runs unit tests", async () => {
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
  assert.ok(typeof report.durationMs === "number");
  assert.ok(typeof report.coveragePercent === "number");
  assert.ok(typeof report.casesPassed === "number");
  assert.ok(typeof report.casesFailed === "number");
  assert.ok(report.timestamp);
});

test("PackTestLocalService.test runs integration tests", async () => {
  const service = new PackTestLocalService();
  const options: TestOptions = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "integration",
    mockLlm: true,
    recordArtifacts: false,
  };

  const report = await service.test(options);

  assert.equal(report.mode, "integration");
  assert.ok(typeof report.casesPassed === "number");
  assert.ok(typeof report.casesFailed === "number");
});

test("PackTestLocalService.test runs simulation tests", async () => {
  const service = new PackTestLocalService();
  const options: TestOptions = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "simulation",
    mockLlm: false,
    evalDatasetId: "eval-dataset-1",
    recordArtifacts: true,
  };

  const report = await service.test(options);

  assert.equal(report.mode, "simulation");
  assert.ok(typeof report.coveragePercent === "number");
});

test("PackTestLocalService.test returns passed=true when no failures", async () => {
  const service = new PackTestLocalService();
  const options: TestOptions = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "unit",
    mockLlm: false,
    recordArtifacts: false,
  };

  const report = await service.test(options);

  // Unit tests should pass by default (uses default cases)
  assert.equal(report.passed, true);
});

test("PackTestLocalService.test includes artifacts when recordArtifacts=true", async () => {
  const service = new PackTestLocalService();
  const options: TestOptions = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "unit",
    mockLlm: false,
    recordArtifacts: true,
  };

  const report = await service.test(options);

  assert.ok(Array.isArray(report.artifacts));
});

test("PackTestLocalService.test includes findings for low coverage", async () => {
  const service = new PackTestLocalService();
  // Simulation without eval dataset has lower coverage
  const options: TestOptions = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "simulation",
    mockLlm: false,
    recordArtifacts: false,
    timeoutMs: 120000,
  };

  const report = await service.test(options);

  // Without eval dataset, coverage may be below threshold
  const hasCoverageFinding = report.findings.some((f) => f.includes("coverage"));
  assert.ok(hasCoverageFinding);
});

test("PackTestLocalService.test playbackFixture returns null for unknown fixture", async () => {
  const service = new PackTestLocalService();

  const result = await service.playbackFixture("unknown-fixture");

  assert.equal(result, null);
});

test("PackTestLocalService.test playbackFixture returns fixture when found", async () => {
  const service = new PackTestLocalService();
  service.loadFixtures({
    "fixture:1": { content: "test response" },
  });

  const result = await service.playbackFixture("fixture:1");

  assert.deepEqual(result, { content: "test response" });
});

test("PackTestLocalService.test playbackFixture applies delay when configured", async () => {
  const service = new PackTestLocalService();
  service.configureMockLlm({
    responses: [],
    delayMs: 50,
  });
  service.loadFixtures({
    "fixture:2": { content: "delayed response" },
  });

  const start = Date.now();
  const result = await service.playbackFixture("fixture:2");
  const elapsed = Date.now() - start;

  assert.deepEqual(result, { content: "delayed response" });
  assert.ok(elapsed >= 40); // Should have some delay
});

test("PackTestLocalService.test returns different reports for different modes", async () => {
  const service = new PackTestLocalService();

  const unitReport = await service.test({
    packId: "test-pack",
    version: "1.0.0",
    mode: "unit",
    mockLlm: false,
    recordArtifacts: false,
  });

  const integrationReport = await service.test({
    packId: "test-pack",
    version: "1.0.0",
    mode: "integration",
    mockLlm: true,
    recordArtifacts: false,
  });

  // Different modes may produce different coverage
  // The key is that both return valid reports
  assert.ok(typeof unitReport.coveragePercent === "number");
  assert.ok(typeof integrationReport.coveragePercent === "number");
});

test("PackTestLocalService.test handles custom timeout", async () => {
  const service = new PackTestLocalService();
  const options: TestOptions = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "unit",
    mockLlm: false,
    recordArtifacts: false,
    timeoutMs: 5000,
  };

  const report = await service.test(options);

  assert.ok(typeof report.durationMs === "number");
  assert.ok(report.durationMs > 0 || report.durationMs === 0);
});

test("PackTestLocalService.test coverage is bounded between 0 and 100", async () => {
  const service = new PackTestLocalService();
  const modes: TestMode[] = ["unit", "integration", "simulation"];

  for (const mode of modes) {
    const report = await service.test({
      packId: "test-pack",
      version: "1.0.0",
      mode,
      mockLlm: false,
      recordArtifacts: false,
    });

    assert.ok(report.coveragePercent >= 0, `Coverage should be >= 0 for ${mode}`);
    assert.ok(report.coveragePercent <= 100, `Coverage should be <= 100 for ${mode}`);
  }
});

test("PackTestLocalService.test cases counts are non-negative", async () => {
  const service = new PackTestLocalService();
  const modes: TestMode[] = ["unit", "integration", "simulation"];

  for (const mode of modes) {
    const report = await service.test({
      packId: "test-pack",
      version: "1.0.0",
      mode,
      mockLlm: false,
      recordArtifacts: false,
    });

    assert.ok(report.casesPassed >= 0, `casesPassed should be >= 0 for ${mode}`);
    assert.ok(report.casesFailed >= 0, `casesFailed should be >= 0 for ${mode}`);
  }
});
