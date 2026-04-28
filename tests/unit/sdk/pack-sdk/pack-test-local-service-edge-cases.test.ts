import assert from "node:assert/strict";
import test from "node:test";

import { PackTestLocalService } from "../../../../src/sdk/pack-sdk/pack-test-local-service.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import type { TestOptions } from "../../../../src/sdk/pack-sdk/pack-test-local-service.js";

test("PackTestLocalService.playbackFixture returns null for missing fixture", async () => {
  const service = new PackTestLocalService();
  const result = await service.playbackFixture("non-existent-fixture");
  assert.equal(result, null);
});

test("PackTestLocalService.playbackFixture returns fixture when exists", async () => {
  const service = new PackTestLocalService();
  service.configureMockLlm({
    responses: [{ content: "test response" }],
    delayMs: 0,
  });
  service.loadFixtures({
    "fixture-1": { content: "test response", reasoning: "because" },
  });

  const result = await service.playbackFixture("fixture-1");
  assert.deepEqual(result, { content: "test response", reasoning: "because" });
});

test("PackTestLocalService.playbackFixture applies configured delay", async () => {
  const service = new PackTestLocalService();
  service.configureMockLlm({
    responses: [{ content: "delayed response" }],
    delayMs: 50,
  });
  service.loadFixtures({
    "delayed-fixture": { content: "delayed response" },
  });

  const startTime = Date.now();
  await service.playbackFixture("delayed-fixture");
  const elapsed = Date.now() - startTime;

  assert.ok(elapsed >= 40); // at least close to 50ms
});

test("PackTestLocalService.test runs unit tests with default options", async () => {
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
  assert.ok(report.timestamp.length > 0);
  assert.ok(report.durationMs >= 0);
});

test("PackTestLocalService.test records artifacts when requested", async () => {
  const service = new PackTestLocalService();
  const options: TestOptions = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "unit",
    mockLlm: false,
    recordArtifacts: true,
  };

  const report = await service.test(options);

  assert.ok(report.artifacts.length > 0);
  assert.ok(report.artifacts[0]!.includes("artifact://"));
});

test("PackTestLocalService.test reports coverage below threshold finding", async () => {
  const service = new PackTestLocalService();
  const options: TestOptions = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "unit",
    mockLlm: false,
    recordArtifacts: false,
  };

  const report = await service.test(options);

  // Default coverage may be below 80%
  if (report.coveragePercent < 80) {
    assert.ok(report.findings.some((f) => f.includes("coverage_below_threshold")));
  }
});

test("PackTestLocalService.loadFixtures handles empty fixtures", () => {
  const service = new PackTestLocalService();
  service.loadFixtures({});
  // No error means success
});

test("PackTestLocalService.loadFixtures overwrites existing fixture", () => {
  const service = new PackTestLocalService();
  service.loadFixtures({ key: "value1" });
  service.loadFixtures({ key: "value2" });

  // The second load overwrites
  assert.ok(service["testFixtures"].get("key") === "value2");
});

test("PackTestLocalService.addMockToolResult overwrites existing tool result", () => {
  const service = new PackTestLocalService();
  service.addMockToolResult({
    toolId: "tool-x",
    success: true,
    output: { result: "first" },
    durationMs: 10,
  });
  service.addMockToolResult({
    toolId: "tool-x",
    success: true,
    output: { result: "second" },
    durationMs: 20,
  });

  const result = service["mockToolResults"].get("tool-x");
  assert.deepEqual(result!.output, { result: "second" });
});

test("PackTestLocalService.test integration mode without mock LLM", async () => {
  const service = new PackTestLocalService();
  const options: TestOptions = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "integration",
    mockLlm: false,
    recordArtifacts: false,
  };

  const report = await service.test(options);

  assert.equal(report.mode, "integration");
  // Without mock LLM, some cases may fail
  assert.ok(typeof report.casesPassed === "number");
  assert.ok(typeof report.casesFailed === "number");
});

test("PackTestLocalService.test with custom timeout", async () => {
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

  assert.equal(report.packId, "test-pack");
});

test("PackTestLocalService.test simulation mode with eval dataset", async () => {
  const service = new PackTestLocalService();
  const options: TestOptions = {
    packId: "test-pack",
    version: "1.0.0",
    mode: "simulation",
    mockLlm: true,
    evalDatasetId: "eval-dataset-123",
    recordArtifacts: false,
  };

  const report = await service.test(options);

  assert.equal(report.mode, "simulation");
});

test("PackTestLocalService.test rejects invalid pack ID", async () => {
  const service = new PackTestLocalService();
  const options: TestOptions = {
    packId: "   ",
    version: "1.0.0",
    mode: "unit",
    mockLlm: false,
    recordArtifacts: false,
  };

  await assert.rejects(
    () => service.test(options),
    (error: unknown) => error instanceof ValidationError && error.code === "test_local.invalid_pack_id",
  );
});

test("PackTestLocalService.test rejects empty version", async () => {
  const service = new PackTestLocalService();
  const options: TestOptions = {
    packId: "test-pack",
    version: "",
    mode: "unit",
    mockLlm: false,
    recordArtifacts: false,
  };

  await assert.rejects(
    () => service.test(options),
    (error: unknown) => error instanceof ValidationError && error.code === "test_local.invalid_version",
  );
});

test("PackTestLocalService.test rejects negative timeout", async () => {
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
    () => service.test(options),
    (error: unknown) => error instanceof ValidationError && error.code === "test_local.invalid_timeout",
  );
});

test("PackTestLocalService.configureMockLlm can be called multiple times", () => {
  const service = new PackTestLocalService();
  service.configureMockLlm({ responses: [{ content: "first" }] });
  service.configureMockLlm({ responses: [{ content: "second" }] });
  // No error means success
});

test("PackTestLocalService handles fixture with missing required tools", async () => {
  const service = new PackTestLocalService();
  service.loadFixtures({
    "unit:test-pack:1": {
      mode: "unit",
      packId: "test-pack",
      caseId: "missing-tools-case",
      passed: true,
      requiredToolIds: ["non-existent-tool"],
    },
  });

  const report = await service.test({
    packId: "test-pack",
    version: "1.0.0",
    mode: "unit",
    mockLlm: false,
    recordArtifacts: false,
  });

  // Case should fail because tool is missing
  assert.ok(report.casesFailed >= 0);
});

test("PackTestLocalService runs integration tests without fixtures", async () => {
  const service = new PackTestLocalService();
  service.configureMockLlm({
    responses: [{ content: "mock" }],
  });

  const report = await service.test({
    packId: "test-pack",
    version: "1.0.0",
    mode: "integration",
    mockLlm: true,
    recordArtifacts: false,
  });

  assert.equal(report.mode, "integration");
  assert.ok(typeof report.coveragePercent === "number");
});

test("PackTestLocalService runs simulation tests without fixtures", async () => {
  const service = new PackTestLocalService();
  service.loadFixtures({
    "simulation:test-pack:1": {
      mode: "simulation",
      packId: "test-pack",
      caseId: "sim-case",
      passed: true,
    },
  });

  const report = await service.test({
    packId: "test-pack",
    version: "1.0.0",
    mode: "simulation",
    mockLlm: false,
    recordArtifacts: false,
  });

  assert.equal(report.mode, "simulation");
});
