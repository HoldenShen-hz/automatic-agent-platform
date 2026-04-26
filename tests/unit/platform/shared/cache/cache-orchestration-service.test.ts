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

test("CacheOrchestrationService with custom cache facade uses it", () => {
  resetCache();
  // This test verifies the constructor works with custom options
  const customCache = {
    getOrCompute: async <T>(
      _namespace: string,
      _normalizedInput: unknown,
      compute: () => Promise<T>,
      _options?: { tags?: string[] }
    ): Promise<{ fromCache: boolean; value: T }> => {
      return { fromCache: false, value: await compute() };
    },
    invalidateByTag: async () => 0,
    invalidateNamespace: async () => 0,
    getMetricsSnapshot: () => ({ totalHits: 0, totalMisses: 0, hitRate: 0, byNamespace: {} }),
  };

  const service = new CacheOrchestrationService({ cache: customCache as any });
  assert.ok(service instanceof CacheOrchestrationService);
});

test("CacheOrchestrationService getOrComputeToolResult uses tool namespace", async () => {
  resetCache();
  const service = new CacheOrchestrationService();

  let receivedNamespace = "";
  const testCache = {
    getOrCompute: async <T>(
      namespace: string,
      _normalizedInput: unknown,
      _compute: () => Promise<T>,
      _options?: { tags?: string[] }
    ): Promise<{ fromCache: boolean; value: T }> => {
      receivedNamespace = namespace;
      return { fromCache: false, value: {} as T };
    },
    invalidateByTag: async () => 0,
    invalidateNamespace: async () => 0,
    getMetricsSnapshot: () => ({ totalHits: 0, totalMisses: 0, hitRate: 0, byNamespace: {} }),
  };

  // Create service with test cache
  const testService = new (class extends CacheOrchestrationService {
    constructor() {
      super({ cache: testCache as any });
    }
  })();

  await testService.getOrComputeToolResult("read", { path: "/file.ts" }, async () => ({}));
  assert.equal(receivedNamespace, "tool.read");
});

test("CacheOrchestrationService getOrComputeToolResult passes tags", async () => {
  resetCache();
  let receivedTags: readonly string[] = [];

  const testCache = {
    getOrCompute: async <T>(
      _namespace: string,
      _normalizedInput: unknown,
      _compute: () => Promise<T>,
      options?: { tags?: string[] }
    ): Promise<{ fromCache: boolean; value: T }> => {
      receivedTags = options?.tags ?? [];
      return { fromCache: false, value: {} as T };
    },
    invalidateByTag: async () => 0,
    invalidateNamespace: async () => 0,
    getMetricsSnapshot: () => ({ totalHits: 0, totalMisses: 0, hitRate: 0, byNamespace: {} }),
  };

  const testService = new (class extends CacheOrchestrationService {
    constructor() {
      super({ cache: testCache as any });
    }
  })();

  await testService.getOrComputeToolResult("read", { path: "/file.ts" }, async () => ({}), ["custom:tag"]);

  assert.ok(receivedTags.includes("custom:tag"));
});

test("CacheOrchestrationService getOrComputePlannerPlan uses planner namespace", async () => {
  resetCache();
  let receivedNamespace = "";

  const testCache = {
    getOrCompute: async <T>(
      namespace: string,
      _normalizedInput: unknown,
      _compute: () => Promise<T>,
      _options?: { tags?: string[] }
    ): Promise<{ fromCache: boolean; value: T }> => {
      receivedNamespace = namespace;
      return { fromCache: false, value: {} as T };
    },
    invalidateByTag: async () => 0,
    invalidateNamespace: async () => 0,
    getMetricsSnapshot: () => ({ totalHits: 0, totalMisses: 0, hitRate: 0, byNamespace: {} }),
  };

  const testService = new (class extends CacheOrchestrationService {
    constructor() {
      super({ cache: testCache as any });
    }
  })();

  await testService.getOrComputePlannerPlan({ workflowId: "wf1" }, async () => ({}));
  assert.equal(receivedNamespace, "planner.plan");
});

test("CacheOrchestrationService getOrComputeMemoryRetrieval uses memory namespace", async () => {
  resetCache();
  let receivedNamespace = "";

  const testCache = {
    getOrCompute: async <T>(
      namespace: string,
      _normalizedInput: unknown,
      _compute: () => Promise<T>,
      _options?: { tags?: string[] }
    ): Promise<{ fromCache: boolean; value: T }> => {
      receivedNamespace = namespace;
      return { fromCache: false, value: {} as T };
    },
    invalidateByTag: async () => 0,
    invalidateNamespace: async () => 0,
    getMetricsSnapshot: () => ({ totalHits: 0, totalMisses: 0, hitRate: 0, byNamespace: {} }),
  };

  const testService = new (class extends CacheOrchestrationService {
    constructor() {
      super({ cache: testCache as any });
    }
  })();

  await testService.getOrComputeMemoryRetrieval({ query: "test" }, async () => ({}));
  assert.equal(receivedNamespace, "memory.retrieval");
});

test("CacheOrchestrationService recordPromptPartition returns partition result", async () => {
  resetCache();
  const service = new CacheOrchestrationService();

  const input = {
    model: "gpt-4",
    profileId: "standard",
    messages: [
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "Hello" },
    ],
  };

  const result = await service.recordPromptPartition(input);

  assert.ok(result.partition);
  assert.ok(result.partition.staticDigest.length > 0);
  assert.ok(result.partition.dynamicDigest.length > 0);
  assert.equal(result.partition.model, "gpt-4");
  assert.equal(result.partition.profileId, "standard");
});

test("CacheOrchestrationService getMetricsSummary returns zeros for sets invalidations evictions", () => {
  resetCache();
  const service = new CacheOrchestrationService();

  const summary = service.getMetricsSummary();

  assert.equal(summary.sets, 0);
  assert.equal(summary.invalidations, 0);
  assert.equal(summary.evictions, 0);
});

test("CacheOrchestrationService getMetricsSummary reflects actual cache hits and misses", async () => {
  resetCache();
  const service = new CacheOrchestrationService();

  // Trigger a miss
  await service.recordPromptPartition({
    model: "gpt-cache-test",
    profileId: "standard",
    messages: [{ role: "user", content: "test message" }],
  });

  // Trigger a hit by calling again with same input
  await service.recordPromptPartition({
    model: "gpt-cache-test",
    profileId: "standard",
    messages: [{ role: "user", content: "test message" }],
  });

  const summary = service.getMetricsSummary();
  assert.ok(summary.hits >= 1);
  assert.ok(summary.misses >= 1);
});

test("CacheOrchestrationService getOrComputeMemoryRetrieval passes custom tags", async () => {
  resetCache();
  let receivedTags: readonly string[] = [];

  const testCache = {
    getOrCompute: async <T>(
      _namespace: string,
      _normalizedInput: unknown,
      _compute: () => Promise<T>,
      options?: { tags?: string[] }
    ): Promise<{ fromCache: boolean; value: T }> => {
      receivedTags = options?.tags ?? [];
      return { fromCache: false, value: {} as T };
    },
    invalidateByTag: async () => 0,
    invalidateNamespace: async () => 0,
    getMetricsSnapshot: () => ({ totalHits: 0, totalMisses: 0, hitRate: 0, byNamespace: {} }),
  };

  const testService = new (class extends CacheOrchestrationService {
    constructor() {
      super({ cache: testCache as any });
    }
  })();

  await testService.getOrComputeMemoryRetrieval({ query: "test" }, async () => ({}), ["memory:session-123"]);
  assert.ok(receivedTags.includes("memory:session-123"));
});

test("CacheOrchestrationService getOrComputePlannerPlan passes custom tags", async () => {
  resetCache();
  let receivedTags: readonly string[] = [];

  const testCache = {
    getOrCompute: async <T>(
      _namespace: string,
      _normalizedInput: unknown,
      _compute: () => Promise<T>,
      options?: { tags?: string[] }
    ): Promise<{ fromCache: boolean; value: T }> => {
      receivedTags = options?.tags ?? [];
      return { fromCache: false, value: {} as T };
    },
    invalidateByTag: async () => 0,
    invalidateNamespace: async () => 0,
    getMetricsSnapshot: () => ({ totalHits: 0, totalMisses: 0, hitRate: 0, byNamespace: {} }),
  };

  const testService = new (class extends CacheOrchestrationService {
    constructor() {
      super({ cache: testCache as any });
    }
  })();

  await testService.getOrComputePlannerPlan({ workflowId: "wf1" }, async () => ({}), ["planner:workflow-wf1"]);
  assert.ok(receivedTags.includes("planner:workflow-wf1"));
});
