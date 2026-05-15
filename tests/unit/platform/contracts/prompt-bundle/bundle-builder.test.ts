import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryPromptBundleRepository,
  InMemoryPromptVersionRepository,
  InMemoryPromptAbTestRepository,
} from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/prompt-bundle-repository.js";
import type {
  PromptBundleRepository,
  PromptVersionRepository,
  PromptAbTestRepository,
  PromptBundleRecord,
  PromptVersionRecord,
  PromptAbTestRecord,
  CreateBundleInput,
  UpdateBundleInput,
  CreateVersionInput,
  CreateTestInput,
} from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/prompt-bundle-repository.js";

// =============================================================================
// InMemoryPromptBundleRepository Tests
// =============================================================================

test("InMemoryPromptBundleRepository.create returns record with generated bundleId", async () => {
  const repo = new InMemoryPromptBundleRepository();

  const input: CreateBundleInput = {
    name: "Test Bundle",
    version: "1.0.0",
    domain: "assistant",
    taskType: "chat",
    systemPromptContent: "You are a helpful assistant.",
    constraints: { maxTokens: 2048 },
    metadata: { owner: "test-team" },
  };

  const record = await repo.create(input);

  assert.ok(record.bundleId.startsWith("prompt_bundle_"));
  assert.equal(record.name, "Test Bundle");
  assert.equal(record.version, "1.0.0");
  assert.equal(record.domain, "assistant");
  assert.equal(record.taskType, "chat");
  assert.equal(record.systemPromptContent, "You are a helpful assistant.");
  assert.equal(record.deprecated, false);
  assert.ok(record.createdAt.length > 0);
  assert.ok(record.updatedAt.length > 0);
});

test("InMemoryPromptBundleRepository.create with optional fields", async () => {
  const repo = new InMemoryPromptBundleRepository();

  const input: CreateBundleInput = {
    name: "Full Bundle",
    version: "2.0.0",
    domain: "translation",
    taskType: "translate",
    packId: "pack-123",
    systemPromptContent: "You are a translator.",
    userPromptContent: "Translate: {{text}}",
    fewShotExamples: [
      { input: "hello", output: "bonjour" },
    ],
    constraints: { maxTokens: 4096, temperature: 0.7 },
    metadata: { owner: "translation-team", tags: ["v2", "stable"] },
  };

  const record = await repo.create(input);

  assert.equal(record.packId, "pack-123");
  assert.equal(record.userPromptContent, "Translate: {{text}}");
  assert.ok(record.fewShotExamplesJson);
  const examples = JSON.parse(record.fewShotExamplesJson!);
  assert.equal(examples.length, 1);
  assert.equal(examples[0].input, "hello");
});

test("InMemoryPromptBundleRepository.findById returns null when not found", async () => {
  const repo = new InMemoryPromptBundleRepository();
  const result = await repo.findById("non-existent-id");
  assert.equal(result, null);
});

test("InMemoryPromptBundleRepository.findById returns record after create", async () => {
  const repo = new InMemoryPromptBundleRepository();

  const input: CreateBundleInput = {
    name: "Find Test",
    version: "1.0.0",
    domain: "test",
    taskType: "simple",
    systemPromptContent: "Test",
    constraints: {},
  };

  const created = await repo.create(input);
  const found = await repo.findById(created.bundleId);

  assert.ok(found !== null);
  assert.equal(found!.bundleId, created.bundleId);
  assert.equal(found!.name, "Find Test");
});

test("InMemoryPromptBundleRepository.findByNameVersion returns null when not found", async () => {
  const repo = new InMemoryPromptBundleRepository();
  const result = await repo.findByNameVersion("NonExistent", "1.0.0");
  assert.equal(result, null);
});

test("InMemoryPromptBundleRepository.findByNameVersion returns exact match", async () => {
  const repo = new InMemoryPromptBundleRepository();

  await repo.create({
    name: "Bundle A",
    version: "1.0.0",
    domain: "test",
    taskType: "simple",
    systemPromptContent: "A",
    constraints: {},
  });

  await repo.create({
    name: "Bundle A",
    version: "2.0.0",
    domain: "test",
    taskType: "simple",
    systemPromptContent: "A v2",
    constraints: {},
  });

  const result = await repo.findByNameVersion("Bundle A", "1.0.0");
  assert.ok(result !== null);
  assert.equal(result!.version, "1.0.0");

  const result2 = await repo.findByNameVersion("Bundle A", "2.0.0");
  assert.ok(result2 !== null);
  assert.equal(result2!.version, "2.0.0");
});

test("InMemoryPromptBundleRepository.findByDomainTask returns matching records", async () => {
  const repo = new InMemoryPromptBundleRepository();

  await repo.create({
    name: "Bundle 1",
    version: "1.0.0",
    domain: "assistant",
    taskType: "chat",
    systemPromptContent: "Chat bot",
    constraints: {},
  });

  await repo.create({
    name: "Bundle 2",
    version: "1.0.0",
    domain: "translation",
    taskType: "translate",
    systemPromptContent: "Translator",
    constraints: {},
  });

  await repo.create({
    name: "Bundle 3",
    version: "1.0.0",
    domain: "assistant",
    taskType: "chat",
    systemPromptContent: "Another chat",
    constraints: {},
  });

  const results = await repo.findByDomainTask("assistant", "chat");
  assert.equal(results.length, 2);
  assert.ok(results.every((r: PromptBundleRecord) => r.domain === "assistant" && r.taskType === "chat"));
});

test("InMemoryPromptBundleRepository.findByDomainTask excludes deprecated bundles", async () => {
  const repo = new InMemoryPromptBundleRepository();

  const bundle = await repo.create({
    name: "Deprecated Bundle",
    version: "1.0.0",
    domain: "assistant",
    taskType: "chat",
    systemPromptContent: "Will be deprecated",
    constraints: {},
  });

  await repo.deprecate(bundle.bundleId);

  const results = await repo.findByDomainTask("assistant", "chat");
  assert.equal(results.length, 0);
});

test("InMemoryPromptBundleRepository.update modifies existing record", async () => {
  const repo = new InMemoryPromptBundleRepository();

  const created = await repo.create({
    name: "Update Test",
    version: "1.0.0",
    domain: "test",
    taskType: "simple",
    systemPromptContent: "Original content",
    constraints: {},
  });

  const updated = await repo.update(created.bundleId, {
    systemPromptContent: "Updated content",
    metadata: { owner: "new-owner" },
  });

  assert.equal(updated.systemPromptContent, "Updated content");
  assert.ok(updated.metadataJson.includes("new-owner"));
  assert.ok(new Date(updated.updatedAt) >= new Date(created.createdAt));
});

test("InMemoryPromptBundleRepository.update throws when bundle not found", async () => {
  const repo = new InMemoryPromptBundleRepository();

  await assert.rejects(
    async () => {
      await repo.update("non-existent-id", { systemPromptContent: "Test" });
    },
    (err: unknown) => {
      return err instanceof Error && err.message.includes("not found");
    },
  );
});

test("InMemoryPromptBundleRepository.deprecate marks bundle as deprecated", async () => {
  const repo = new InMemoryPromptBundleRepository();

  const created = await repo.create({
    name: "Deprecate Test",
    version: "1.0.0",
    domain: "test",
    taskType: "simple",
    systemPromptContent: "To be deprecated",
    constraints: {},
  });

  assert.equal(created.deprecated, false);

  await repo.deprecate(created.bundleId);

  const found = await repo.findById(created.bundleId);
  assert.ok(found !== null);
  assert.equal(found!.deprecated, true);
});

test("InMemoryPromptBundleRepository.delete removes bundle", async () => {
  const repo = new InMemoryPromptBundleRepository();

  const created = await repo.create({
    name: "Delete Test",
    version: "1.0.0",
    domain: "test",
    taskType: "simple",
    systemPromptContent: "To be deleted",
    constraints: {},
  });

  await repo.delete(created.bundleId);

  const found = await repo.findById(created.bundleId);
  assert.equal(found, null);
});

test("InMemoryPromptBundleRepository.listAll returns paginated results", async () => {
  const repo = new InMemoryPromptBundleRepository();

  for (let i = 0; i < 5; i++) {
    await repo.create({
      name: `Bundle ${i}`,
      version: "1.0.0",
      domain: "test",
      taskType: "simple",
      systemPromptContent: `Content ${i}`,
      constraints: {},
    });
  }

  const page1 = await repo.listAll(2, 0);
  assert.equal(page1.length, 2);

  const page2 = await repo.listAll(2, 2);
  assert.equal(page2.length, 2);

  const page3 = await repo.listAll(2, 4);
  assert.equal(page3.length, 1);

  const all = await repo.listAll(10, 0);
  assert.equal(all.length, 5);
});

test("InMemoryPromptBundleRepository implements PromptBundleRepository interface", () => {
  const repo: PromptBundleRepository = new InMemoryPromptBundleRepository();
  assert.ok(typeof repo.create === "function");
  assert.ok(typeof repo.findById === "function");
  assert.ok(typeof repo.findByNameVersion === "function");
  assert.ok(typeof repo.findByDomainTask === "function");
  assert.ok(typeof repo.update === "function");
  assert.ok(typeof repo.deprecate === "function");
  assert.ok(typeof repo.delete === "function");
  assert.ok(typeof repo.listAll === "function");
});

// =============================================================================
// InMemoryPromptVersionRepository Tests
// =============================================================================

test("InMemoryPromptVersionRepository.create generates versionId and stores record", async () => {
  const repo = new InMemoryPromptVersionRepository();

  const bundleRecord = await new InMemoryPromptBundleRepository().create({
    name: "Version Test",
    version: "1.0.0",
    domain: "test",
    taskType: "simple",
    systemPromptContent: "Test",
    constraints: {},
  });

  const version = await repo.create({
    bundleId: bundleRecord.bundleId,
    version: "1.0.0",
    isCurrent: true,
    trafficWeight: 100,
  });

  assert.ok(version.versionId.startsWith("prompt_version_"));
  assert.equal(version.bundleId, bundleRecord.bundleId);
  assert.equal(version.version, "1.0.0");
  assert.equal(version.isCurrent, true);
  assert.equal(version.trafficWeight, 100);
});

test("InMemoryPromptVersionRepository.findByBundleId returns all versions", async () => {
  const repo = new InMemoryPromptVersionRepository();
  const bundleRepo = new InMemoryPromptBundleRepository();

  const bundle = await bundleRepo.create({
    name: "Multi Version",
    version: "1.0.0",
    domain: "test",
    taskType: "simple",
    systemPromptContent: "Test",
    constraints: {},
  });

  await repo.create({ bundleId: bundle.bundleId, version: "1.0.0", trafficWeight: 50 });
  await repo.create({ bundleId: bundle.bundleId, version: "2.0.0", trafficWeight: 50 });

  const versions = await repo.findByBundleId(bundle.bundleId);
  assert.equal(versions.length, 2);
});

test("InMemoryPromptVersionRepository.findCurrentByBundleId returns current version", async () => {
  const repo = new InMemoryPromptVersionRepository();
  const bundleRepo = new InMemoryPromptBundleRepository();

  const bundle = await bundleRepo.create({
    name: "Current Test",
    version: "1.0.0",
    domain: "test",
    taskType: "simple",
    systemPromptContent: "Test",
    constraints: {},
  });

  await repo.create({ bundleId: bundle.bundleId, version: "1.0.0", isCurrent: false });
  await repo.create({ bundleId: bundle.bundleId, version: "2.0.0", isCurrent: true });

  const current = await repo.findCurrentByBundleId(bundle.bundleId);
  assert.ok(current !== null);
  assert.equal(current!.version, "2.0.0");
});

test("InMemoryPromptVersionRepository.findCurrentByBundleId returns null when no current", async () => {
  const repo = new InMemoryPromptVersionRepository();
  const bundleRepo = new InMemoryPromptBundleRepository();

  const bundle = await bundleRepo.create({
    name: "No Current Test",
    version: "1.0.0",
    domain: "test",
    taskType: "simple",
    systemPromptContent: "Test",
    constraints: {},
  });

  await repo.create({ bundleId: bundle.bundleId, version: "1.0.0", isCurrent: false });

  const current = await repo.findCurrentByBundleId(bundle.bundleId);
  assert.equal(current, null);
});

test("InMemoryPromptVersionRepository.setCurrent updates isCurrent flags", async () => {
  const repo = new InMemoryPromptVersionRepository();
  const bundleRepo = new InMemoryPromptBundleRepository();

  const bundle = await bundleRepo.create({
    name: "Set Current Test",
    version: "1.0.0",
    domain: "test",
    taskType: "simple",
    systemPromptContent: "Test",
    constraints: {},
  });

  await repo.create({ bundleId: bundle.bundleId, version: "1.0.0", isCurrent: true });
  await repo.create({ bundleId: bundle.bundleId, version: "2.0.0", isCurrent: false });

  await repo.setCurrent(bundle.bundleId, "2.0.0");

  const versions = await repo.findByBundleId(bundle.bundleId);
  const v1 = versions.find((v: PromptVersionRecord) => v.version === "1.0.0");
  const v2 = versions.find((v: PromptVersionRecord) => v.version === "2.0.0");

  assert.ok(v1 !== undefined);
  assert.ok(v2 !== undefined);
  assert.equal(v1!.isCurrent, false);
  assert.equal(v2!.isCurrent, true);
});

test("InMemoryPromptVersionRepository.deprecate sets deprecatedAt timestamp", async () => {
  const repo = new InMemoryPromptVersionRepository();
  const bundleRepo = new InMemoryPromptBundleRepository();

  const bundle = await bundleRepo.create({
    name: "Deprecate Version Test",
    version: "1.0.0",
    domain: "test",
    taskType: "simple",
    systemPromptContent: "Test",
    constraints: {},
  });

  await repo.create({ bundleId: bundle.bundleId, version: "1.0.0" });

  await repo.deprecate(bundle.bundleId, "1.0.0");

  const versions = await repo.findByBundleId(bundle.bundleId);
  assert.ok(versions[0]!.deprecatedAt !== null);
});

test("InMemoryPromptVersionRepository implements PromptVersionRepository interface", () => {
  const repo: PromptVersionRepository = new InMemoryPromptVersionRepository();
  assert.ok(typeof repo.create === "function");
  assert.ok(typeof repo.findByBundleId === "function");
  assert.ok(typeof repo.findCurrentByBundleId === "function");
  assert.ok(typeof repo.setCurrent === "function");
  assert.ok(typeof repo.deprecate === "function");
});

// =============================================================================
// InMemoryPromptAbTestRepository Tests
// =============================================================================

test("InMemoryPromptAbTestRepository.create returns record with generated testId", async () => {
  const repo = new InMemoryPromptAbTestRepository();
  const bundleRepo = new InMemoryPromptBundleRepository();

  const bundle = await bundleRepo.create({
    name: "A/B Test Bundle",
    version: "1.0.0",
    domain: "test",
    taskType: "simple",
    systemPromptContent: "Test",
    constraints: {},
  });

  const test = await repo.create({
    bundleId: bundle.bundleId,
    testName: "Control vs Treatment",
    controlVersion: "1.0.0",
    treatmentVersion: "2.0.0",
    trafficSplitPercent: 50,
    metrics: { conversionRate: 0.05 },
  });

  assert.ok(test.testId.startsWith("prompt_ab_test_"));
  assert.equal(test.bundleId, bundle.bundleId);
  assert.equal(test.testName, "Control vs Treatment");
  assert.equal(test.controlVersion, "1.0.0");
  assert.equal(test.treatmentVersion, "2.0.0");
  assert.equal(test.trafficSplitPercent, 50);
  assert.equal(test.status, "draft");
});

test("InMemoryPromptAbTestRepository.findById returns null when not found", async () => {
  const repo = new InMemoryPromptAbTestRepository();
  const result = await repo.findById("non-existent-id");
  assert.equal(result, null);
});

test("InMemoryPromptAbTestRepository.findById returns record after create", async () => {
  const repo = new InMemoryPromptAbTestRepository();
  const bundleRepo = new InMemoryPromptBundleRepository();

  const bundle = await bundleRepo.create({
    name: "Find Test",
    version: "1.0.0",
    domain: "test",
    taskType: "simple",
    systemPromptContent: "Test",
    constraints: {},
  });

  const created = await repo.create({
    bundleId: bundle.bundleId,
    testName: "Find Test",
    controlVersion: "1.0.0",
    treatmentVersion: "2.0.0",
    metrics: {},
  });

  const found = await repo.findById(created.testId);
  assert.ok(found !== null);
  assert.equal(found!.testName, "Find Test");
});

test("InMemoryPromptAbTestRepository.findByBundleId returns all tests for bundle", async () => {
  const repo = new InMemoryPromptAbTestRepository();
  const bundleRepo = new InMemoryPromptBundleRepository();

  const bundle = await bundleRepo.create({
    name: "Multi Test Bundle",
    version: "1.0.0",
    domain: "test",
    taskType: "simple",
    systemPromptContent: "Test",
    constraints: {},
  });

  await repo.create({
    bundleId: bundle.bundleId,
    testName: "Test A",
    controlVersion: "1.0.0",
    treatmentVersion: "2.0.0",
    metrics: {},
  });

  await repo.create({
    bundleId: bundle.bundleId,
    testName: "Test B",
    controlVersion: "1.0.0",
    treatmentVersion: "3.0.0",
    metrics: {},
  });

  const tests = await repo.findByBundleId(bundle.bundleId);
  assert.equal(tests.length, 2);
});

test("InMemoryPromptAbTestRepository.findByStatus returns filtered results", async () => {
  const repo = new InMemoryPromptAbTestRepository();
  const bundleRepo = new InMemoryPromptBundleRepository();

  const bundle = await bundleRepo.create({
    name: "Status Filter Test",
    version: "1.0.0",
    domain: "test",
    taskType: "simple",
    systemPromptContent: "Test",
    constraints: {},
  });

  await repo.create({
    bundleId: bundle.bundleId,
    testName: "Draft Test",
    controlVersion: "1.0.0",
    treatmentVersion: "2.0.0",
    metrics: {},
  });

  const running = await repo.create({
    bundleId: bundle.bundleId,
    testName: "Running Test",
    controlVersion: "1.0.0",
    treatmentVersion: "2.0.0",
    metrics: {},
  });

  await repo.updateStatus(running.testId, "running");

  const draftTests = await repo.findByStatus("draft");
  const runningTests = await repo.findByStatus("running");

  assert.ok(draftTests.some((t: PromptAbTestRecord) => t.testName === "Draft Test"));
  assert.ok(runningTests.some((t: PromptAbTestRecord) => t.testName === "Running Test"));
});

test("InMemoryPromptAbTestRepository.updateResults stores results JSON", async () => {
  const repo = new InMemoryPromptAbTestRepository();
  const bundleRepo = new InMemoryPromptBundleRepository();

  const bundle = await bundleRepo.create({
    name: "Results Test",
    version: "1.0.0",
    domain: "test",
    taskType: "simple",
    systemPromptContent: "Test",
    constraints: {},
  });

  const test = await repo.create({
    bundleId: bundle.bundleId,
    testName: "Results Test",
    controlVersion: "1.0.0",
    treatmentVersion: "2.0.0",
    metrics: {},
  });

  const results = {
    controlConversionRate: 0.03,
    treatmentConversionRate: 0.07,
    lift: 1.33,
    confidence: 0.95,
  };

  await repo.updateResults(test.testId, results);

  const updated = await repo.findById(test.testId);
  assert.ok(updated !== null);
  const parsedResults = JSON.parse(updated.resultsJson!);
  assert.equal(parsedResults.lift, 1.33);
});

test("InMemoryPromptAbTestRepository.updateStatus changes status", async () => {
  const repo = new InMemoryPromptAbTestRepository();
  const bundleRepo = new InMemoryPromptBundleRepository();

  const bundle = await bundleRepo.create({
    name: "Status Update Test",
    version: "1.0.0",
    domain: "test",
    taskType: "simple",
    systemPromptContent: "Test",
    constraints: {},
  });

  const test = await repo.create({
    bundleId: bundle.bundleId,
    testName: "Status Update Test",
    controlVersion: "1.0.0",
    treatmentVersion: "2.0.0",
    metrics: {},
  });

  assert.equal(test.status, "draft");

  await repo.updateStatus(test.testId, "running");

  const updated = await repo.findById(test.testId);
  assert.ok(updated !== null);
  assert.equal(updated.status, "running");
});

test("InMemoryPromptAbTestRepository.delete removes test", async () => {
  const repo = new InMemoryPromptAbTestRepository();
  const bundleRepo = new InMemoryPromptBundleRepository();

  const bundle = await bundleRepo.create({
    name: "Delete Test",
    version: "1.0.0",
    domain: "test",
    taskType: "simple",
    systemPromptContent: "Test",
    constraints: {},
  });

  const test = await repo.create({
    bundleId: bundle.bundleId,
    testName: "Delete Test",
    controlVersion: "1.0.0",
    treatmentVersion: "2.0.0",
    metrics: {},
  });

  await repo.delete(test.testId);

  const found = await repo.findById(test.testId);
  assert.equal(found, null);
});

test("InMemoryPromptAbTestRepository implements PromptAbTestRepository interface", () => {
  const repo: PromptAbTestRepository = new InMemoryPromptAbTestRepository();
  assert.ok(typeof repo.create === "function");
  assert.ok(typeof repo.findById === "function");
  assert.ok(typeof repo.findByBundleId === "function");
  assert.ok(typeof repo.findByStatus === "function");
  assert.ok(typeof repo.updateResults === "function");
  assert.ok(typeof repo.updateStatus === "function");
  assert.ok(typeof repo.delete === "function");
});

// =============================================================================
// Repository Integration Scenarios
// =============================================================================

test("Create bundle with version and A/B test in sequence", async () => {
  const bundleRepo = new InMemoryPromptBundleRepository();
  const versionRepo = new InMemoryPromptVersionRepository();
  const abTestRepo = new InMemoryPromptAbTestRepository();

  // Create bundle
  const bundle = await bundleRepo.create({
    name: "Integration Test Bundle",
    version: "1.0.0",
    domain: "assistant",
    taskType: "chat",
    systemPromptContent: "You are a helpful assistant.",
    constraints: { maxTokens: 2048 },
    metadata: { owner: "integration-test" },
  });

  // Create version
  const version = await versionRepo.create({
    bundleId: bundle.bundleId,
    version: "1.0.0",
    isCurrent: true,
    trafficWeight: 100,
    trafficAllocation: { weight: 100 },
  });

  // Create A/B test
  const test = await abTestRepo.create({
    bundleId: bundle.bundleId,
    testName: "v1.0 vs v1.1 Experiment",
    controlVersion: "1.0.0",
    treatmentVersion: "1.1.0",
    trafficSplitPercent: 20,
    metrics: { conversionRate: 0.0 },
  });

  // Verify all records exist
  const foundBundle = await bundleRepo.findById(bundle.bundleId);
  assert.ok(foundBundle !== null);
  assert.equal(foundBundle.name, "Integration Test Bundle");

  const foundVersion = await versionRepo.findCurrentByBundleId(bundle.bundleId);
  assert.ok(foundVersion !== null);
  assert.equal(foundVersion.version, "1.0.0");
  assert.equal(foundVersion.isCurrent, true);

  const foundTests = await abTestRepo.findByBundleId(bundle.bundleId);
  assert.equal(foundTests.length, 1);
  assert.equal(foundTests[0]!.testName, "v1.0 vs v1.1 Experiment");
});
