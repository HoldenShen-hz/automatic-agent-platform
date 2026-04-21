import test from "node:test";
import assert from "node:assert/strict";

import {
  CacheOrchestrationService,
  resetCache,
} from "../../../../../src/platform/shared/cache/index.js";

test("CacheOrchestrationService caches prompt partitions and reports reuse", async () => {
  resetCache();
  const service = new CacheOrchestrationService();

  const input = {
    model: "gpt-test",
    profileId: "standard",
    messages: [
      { role: "system", content: "stable rules" },
      { role: "user", content: "hello" },
    ],
  } as const;

  const first = await service.recordPromptPartition(input);
  const second = await service.recordPromptPartition(input);

  assert.equal(first.staticPrefixFromCache, false);
  assert.equal(first.dynamicPromptFromCache, false);
  assert.equal(second.staticPrefixFromCache, true);
  assert.equal(second.dynamicPromptFromCache, true);
});

test("CacheOrchestrationService caches planner and memory lookups", async () => {
  resetCache();
  const service = new CacheOrchestrationService();
  let plannerCalls = 0;
  let memoryCalls = 0;

  const plannerA = await service.getOrComputePlannerPlan(
    { workflowId: "wf_a", request: "do thing" },
    async () => {
      plannerCalls += 1;
      return { ok: true };
    },
    ["workflow:wf_a"],
  );
  const plannerB = await service.getOrComputePlannerPlan(
    { request: "do thing", workflowId: "wf_a" },
    async () => {
      plannerCalls += 1;
      return { ok: true };
    },
    ["workflow:wf_a"],
  );
  const memoryA = await service.getOrComputeMemoryRetrieval(
    { queryText: "repo map", sessionId: "sess-1" },
    async () => {
      memoryCalls += 1;
      return { items: [1, 2, 3] };
    },
  );
  const memoryB = await service.getOrComputeMemoryRetrieval(
    { sessionId: "sess-1", queryText: "repo map" },
    async () => {
      memoryCalls += 1;
      return { items: [1, 2, 3] };
    },
  );

  assert.equal(plannerA.fromCache, false);
  assert.equal(plannerB.fromCache, true);
  assert.equal(memoryA.fromCache, false);
  assert.equal(memoryB.fromCache, true);
  assert.equal(plannerCalls, 1);
  assert.equal(memoryCalls, 1);
});

test("CacheOrchestrationService returns miss on first partition record", async () => {
  resetCache();
  const service = new CacheOrchestrationService();

  const input = {
    model: "gpt-fresh",
    profileId: "standard",
    messages: [{ role: "user", content: "brand new" }],
  } as const;

  const result = await service.recordPromptPartition(input);
  assert.equal(result.staticPrefixFromCache, false);
  assert.equal(result.dynamicPromptFromCache, false);
  assert.ok(result.partition.staticDigest.length > 0);
});

test("CacheOrchestrationService.getMetricsSummary returns hit/miss counts", async () => {
  resetCache();
  const service = new CacheOrchestrationService();

  // Trigger some cache activity
  await service.recordPromptPartition({
    model: "gpt-metrics",
    profileId: "standard",
    messages: [{ role: "user", content: "metrics test" }],
  });

  // Second call should hit cache
  await service.recordPromptPartition({
    model: "gpt-metrics",
    profileId: "standard",
    messages: [{ role: "user", content: "metrics test" }],
  });

  const summary = service.getMetricsSummary();
  assert.equal(typeof summary.hits, "number");
  assert.equal(typeof summary.misses, "number");
  assert.ok(summary.hits >= 1 || summary.misses >= 1);
});

test("CacheOrchestrationService.getMetricsSummary returns zeroed sets/invalidations/evictions", async () => {
  resetCache();
  const service = new CacheOrchestrationService();

  const summary = service.getMetricsSummary();
  assert.equal(summary.sets, 0);
  assert.equal(summary.invalidations, 0);
  assert.equal(summary.evictions, 0);
});

test("CacheOrchestrationService handles different models separately", async () => {
  resetCache();
  const service = new CacheOrchestrationService();

  const inputGpt = {
    model: "gpt-5",
    profileId: "standard",
    messages: [{ role: "user", content: "hello" }],
  };

  const inputClaude = {
    model: "claude-4",
    profileId: "standard",
    messages: [{ role: "user", content: "hello" }],
  };

  const resultGpt1 = await service.recordPromptPartition(inputGpt);
  const resultClaude1 = await service.recordPromptPartition(inputClaude);
  const resultGpt2 = await service.recordPromptPartition(inputGpt);

  // First call for each model should be cache miss
  assert.equal(resultGpt1.staticPrefixFromCache, false);
  assert.equal(resultClaude1.staticPrefixFromCache, false);
  // Second call for same model should hit cache
  assert.equal(resultGpt2.staticPrefixFromCache, true);
});
