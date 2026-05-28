import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryPromptAbTestRepository,
  InMemoryPromptBundleRepository,
  InMemoryPromptVersionRepository,
} from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/prompt-bundle-repository.js";

test("InMemoryPromptBundleRepository creates and finds bundle", async () => {
  const repo = new InMemoryPromptBundleRepository();

  const bundle = await repo.create({
    name: "sales-outreach",
    version: "v1",
    domain: "sales",
    taskType: "email",
    packId: "pack-sales",
    systemPromptContent: "You are a sales assistant.",
    userPromptContent: "Draft an outreach email.",
    fewShotExamples: [{ input: "A", output: "B" }],
    constraints: { maxTokens: 800, responseFormat: "markdown" },
    metadata: { owner: "team-sales", tags: ["prod"] },
  });

  assert.match(bundle.bundleId, /^prompt_bundle_/);
  assert.equal(bundle.name, "sales-outreach");
  assert.equal(bundle.packId, "pack-sales");
  assert.equal(bundle.systemPromptContent, "You are a sales assistant.");

  const found = await repo.findByNameVersion("sales-outreach", "v1");
  assert.deepEqual(found, bundle);
});

test("InMemoryPromptBundleRepository updates, filters and deprecates bundle", async () => {
  const repo = new InMemoryPromptBundleRepository();
  const bundle = await repo.create({
    name: "ops-triage",
    version: "v2",
    domain: "operations",
    taskType: "incident",
    systemPromptContent: "Triage incidents.",
    constraints: { temperature: 0.2 },
  });

  const updated = await repo.update(bundle.bundleId, {
    userPromptContent: "Classify severity and summarize impact.",
    constraints: { temperature: 0.1, responseFormat: "json" },
  });

  assert.equal(updated.userPromptContent, "Classify severity and summarize impact.");
  assert.match(updated.constraintsJson, /"responseFormat":"json"/);

  const active = await repo.findByDomainTask("operations", "incident");
  assert.equal(active.length, 1);

  await repo.deprecate(bundle.bundleId);
  const afterDeprecation = await repo.findByDomainTask("operations", "incident");
  assert.equal(afterDeprecation.length, 0);
});

test("InMemoryPromptVersionRepository manages current version and deprecation", async () => {
  const repo = new InMemoryPromptVersionRepository();

  const current = await repo.create({
    bundleId: "bundle-1",
    version: "v1",
    isCurrent: true,
    trafficWeight: 80,
  });
  const candidate = await repo.create({
    bundleId: "bundle-1",
    version: "v2",
    trafficWeight: 20,
    trafficAllocation: { weight: 20, startTime: "2026-04-01T00:00:00Z" },
  });

  assert.match(current.versionId, /^prompt_version_/);
  assert.match(candidate.versionId, /^prompt_version_/);
  assert.equal((await repo.findByBundleId("bundle-1")).length, 2);
  assert.equal((await repo.findCurrentByBundleId("bundle-1"))?.version, "v1");

  await repo.setCurrent("bundle-1", "v2");
  assert.equal((await repo.findCurrentByBundleId("bundle-1"))?.version, "v2");

  await repo.deprecate("bundle-1", "v1");
  const versions = await repo.findByBundleId("bundle-1");
  assert.ok(versions.find((version) => version.version === "v1")?.deprecatedAt);
});

test("InMemoryPromptAbTestRepository records lifecycle and results", async () => {
  const repo = new InMemoryPromptAbTestRepository();

  const abTest = await repo.create({
    bundleId: "bundle-1",
    testName: "headline-variant",
    controlVersion: "v1",
    treatmentVersion: "v2",
    trafficSplitPercent: 30,
    metrics: { ctr: "higher_is_better" },
  });

  assert.match(abTest.testId, /^prompt_ab_test_/);
  assert.equal(abTest.status, "draft");

  await repo.updateStatus(abTest.testId, "running");
  await repo.updateResults(abTest.testId, { winner: "v2" });

  const found = await repo.findById(abTest.testId);
  assert.equal(found?.status, "running");
  assert.match(found?.resultsJson ?? "", /"winner":"v2"/);

  const running = await repo.findByStatus("running");
  assert.equal(running.length, 1);

  await repo.delete(abTest.testId);
  assert.equal(await repo.findById(abTest.testId), null);
});

test("InMemoryPromptBundleRepository rejects invalid JSON-like metadata payloads", async () => {
  const repo = new InMemoryPromptBundleRepository();

  await assert.rejects(
    () => repo.create({
      name: "ops-triage-invalid",
      version: "v1",
      domain: "operations",
      taskType: "incident",
      systemPromptContent: "Triage incidents.",
      constraints: { customConstraints: { cyclic: undefined } },
    }),
    /prompt_bundle\.invalid_constraints/,
  );
});

test("InMemoryPromptVersionRepository rejects invalid traffic allocation payloads", async () => {
  const repo = new InMemoryPromptVersionRepository();

  await assert.rejects(
    () => repo.create({
      bundleId: "bundle-invalid",
      version: "v3",
      trafficAllocation: { weight: -1 },
    }),
    /prompt_bundle\.invalid_traffic_allocation/,
  );
});
