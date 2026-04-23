import assert from "node:assert/strict";
import test from "node:test";

// Main shared barrel test - tests re-exports from src/platform/shared/index.ts

// ============================================================================
// Cache Module Re-exports
// ============================================================================
import type {
  CacheScope,
  CacheLayer,
  CacheMissReason,
  CacheMeta,
  CacheEntry,
  CacheLookupResult,
  CachePolicy,
  CacheComputeOptions,
} from "../../../src/platform/shared/index.js";

test("CacheScope type accepts valid values from shared barrel", () => {
  const scopes: CacheScope[] = ["memory", "session", "persistent"];
  assert.equal(scopes.length, 3);
});

test("CacheLayer type accepts valid values from shared barrel", () => {
  const layers: CacheLayer[] = ["L1", "L2", "L3"];
  assert.equal(layers.length, 3);
});

test("CacheMissReason type accepts valid values from shared barrel", () => {
  const reasons: CacheMissReason[] = [
    "not_found",
    "expired",
    "invalidated",
    "version_mismatch",
    "payload_too_large",
    "disabled",
    "not_cacheable",
  ];
  assert.equal(reasons.length, 7);
});

test("CacheMeta structure is correct from shared barrel", () => {
  const meta: CacheMeta = {
    scope: "memory",
    ttlMs: 60000,
    tags: ["tag1", "tag2"],
    version: "1.0.0",
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    hitCount: 0,
    sizeBytes: 1024,
  };
  assert.equal(meta.scope, "memory");
  assert.equal(meta.ttlMs, 60000);
  assert.equal(meta.tags.length, 2);
});

test("CacheEntry structure is correct from shared barrel", () => {
  const entry: CacheEntry<string> = {
    namespace: "test",
    key: "key1",
    value: "test-value",
    meta: {
      scope: "session",
      tags: [],
      version: "1.0",
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      hitCount: 0,
      sizeBytes: 256,
    },
  };
  assert.equal(entry.namespace, "test");
  assert.equal(entry.key, "key1");
  assert.equal(entry.value, "test-value");
});

test("CacheLookupResult structure is correct from shared barrel", () => {
  const result: CacheLookupResult<string> = {
    hit: true,
    value: "cached-value",
    layer: "L1",
  };
  assert.equal(result.hit, true);
  assert.equal(result.value, "cached-value");
  assert.equal(result.layer, "L1");
});

test("CacheLookupResult miss structure is correct from shared barrel", () => {
  const result: CacheLookupResult<string> = {
    hit: false,
    value: null,
    reason: "not_found",
  };
  assert.equal(result.hit, false);
  assert.equal(result.value, null);
  assert.equal(result.reason, "not_found");
});

test("CachePolicy structure is correct from shared barrel", () => {
  const policy: CachePolicy = {
    enabled: true,
    scope: "memory",
    ttlMs: 300000,
    version: "1.0.0",
    maxPayloadBytes: 1048576,
    tags: ["workflow", "task"],
    staleWhileRevalidate: true,
  };
  assert.equal(policy.enabled, true);
  assert.equal(policy.scope, "memory");
  assert.equal(policy.ttlMs, 300000);
  assert.equal(policy.maxPayloadBytes, 1048576);
  assert.equal(policy.staleWhileRevalidate, true);
});

test("CacheComputeOptions structure is correct from shared barrel", () => {
  const options: CacheComputeOptions = {
    tags: ["compute"],
    contentType: "application/json",
    forceBypass: false,
  };
  assert.equal(options.forceBypass, false);
  assert.equal(options.contentType, "application/json");
});

// ============================================================================
// Lifecycle Module Re-exports
// ============================================================================
import { ServiceRegistry } from "../../../src/platform/shared/index.js";

test("ServiceRegistry is exported from shared barrel", () => {
  assert.equal(typeof ServiceRegistry, "function");
});

test("ServiceRegistry getInstance returns singleton", () => {
  const instance1 = ServiceRegistry.getInstance();
  const instance2 = ServiceRegistry.getInstance();
  assert.ok(instance1 === instance2);
});

test("ServiceRegistry can register and retrieve a service", () => {
  const registry = ServiceRegistry.getInstance();
  let initialized = false;

  registry.register("test-service", {
    init: () => {
      initialized = true;
      return { value: 42 };
    },
  });

  assert.equal(initialized, false);
  const service = registry.get<{ value: number }>("test-service");
  assert.equal(initialized, true);
  assert.equal(service.value, 42);
});

test("ServiceRegistry throws for unregistered service", () => {
  const registry = ServiceRegistry.getInstance();
  assert.throws(
    () => registry.get("nonexistent-service"),
    /ServiceRegistry: no service registered/
  );
});

test("ServiceRegistry reset clears all services", () => {
  const registry = ServiceRegistry.getInstance();
  registry.register("reset-test-service", {
    init: () => ({ value: 1 }),
  });
  registry.get("reset-test-service");
  assert.equal(registry.isInitialized("reset-test-service"), true);
  registry.reset();
  assert.throws(
    () => registry.get("reset-test-service"),
    /ServiceRegistry: no service registered/
  );
});

// ============================================================================
// Utils Module Re-exports
// ============================================================================
import { BoundedCache } from "../../../src/platform/shared/index.js";

test("BoundedCache is exported from shared barrel", () => {
  assert.equal(typeof BoundedCache, "function");
});

test("BoundedCache basic operations work", () => {
  const cache = new BoundedCache<string, number>(3);
  assert.equal(cache.size, 0);

  cache.set("a", 1);
  assert.equal(cache.size, 1);
  assert.equal(cache.get("a"), 1);

  cache.set("b", 2);
  assert.equal(cache.has("a"), true);
  assert.equal(cache.has("b"), true);

  cache.delete("a");
  assert.equal(cache.has("a"), false);
  assert.equal(cache.size, 1);
});

test("BoundedCache evicts oldest entry when at capacity", () => {
  const cache = new BoundedCache<string, number>(3);

  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);

  assert.equal(cache.get("a"), 1);
  assert.equal(cache.get("b"), 2);
  assert.equal(cache.get("c"), 3);

  // Adding a 4th entry should evict "a" (oldest)
  cache.set("d", 4);

  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("d"), 4);
});

test("BoundedCache clear removes all entries", () => {
  const cache = new BoundedCache<string, number>(3);
  cache.set("a", 1);
  cache.set("b", 2);
  assert.equal(cache.size, 2);

  cache.clear();
  assert.equal(cache.size, 0);
});

// ============================================================================
// Scaling Module Re-exports
// ============================================================================
import type { ResourceQuota } from "../../../src/platform/shared/index.js";

test("ResourceQuota type is exported from shared barrel", () => {
  const quota: ResourceQuota = {
    orgNodeId: "org-123",
    guaranteed: {
      maxConcurrentWorkflows: 10,
      maxConcurrentWorkers: 5,
      llmTokensPerMinute: 1000,
      llmRequestsPerMinute: 100,
    },
    burstable: {
      maxConcurrentWorkflows: 20,
      maxConcurrentWorkers: 10,
      llmTokensPerMinute: 2000,
      llmRequestsPerMinute: 200,
    },
    maxLimit: {
      maxConcurrentWorkflows: 50,
      maxConcurrentWorkers: 25,
      llmTokensPerMinute: 5000,
      llmRequestsPerMinute: 500,
    },
  };
  assert.equal(quota.orgNodeId, "org-123");
  assert.equal(quota.guaranteed.maxConcurrentWorkflows, 10);
  assert.equal(quota.burstable.maxConcurrentWorkers, 10);
  assert.equal(quota.maxLimit.llmTokensPerMinute, 5000);
});

// ============================================================================
// Outbox Module Re-exports
// ============================================================================
import { OUTBOX_TABLE_DDL } from "../../../src/platform/shared/index.js";

test("OUTBOX_TABLE_DDL is exported from shared barrel", () => {
  assert.equal(typeof OUTBOX_TABLE_DDL, "string");
  assert.ok(OUTBOX_TABLE_DDL.length > 0);
});

import { OutboxStatus } from "../../../src/platform/shared/index.js";
import type { OutboxRecord } from "../../../src/platform/shared/index.js";

test("OutboxStatus enum has correct values from shared barrel", () => {
  assert.equal(OutboxStatus.PENDING, "pending");
  assert.equal(OutboxStatus.PUBLISHED, "published");
  assert.equal(OutboxStatus.FAILED, "failed");
});

test("OutboxRecord structure is correct from shared barrel", () => {
  const record: OutboxRecord = {
    id: "outbox-1",
    aggregateType: "Task",
    aggregateId: "task-123",
    eventType: "TaskCompleted",
    payloadJson: '{"event":"test"}',
    traceId: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    publishedAt: null,
    retryCount: 0,
    lastError: null,
    lastAttemptAt: null,
  };
  assert.equal(record.id, "outbox-1");
  assert.equal(record.aggregateType, "Task");
  assert.equal(record.retryCount, 0);
});

// ============================================================================
// Observability Module Re-exports
// ============================================================================
import { createRootTraceContext, createChildTraceContext } from "../../../src/platform/shared/index.js";

test("createRootTraceContext creates valid trace from shared barrel", () => {
  const trace = createRootTraceContext();
  assert.match(trace.traceId, /^[0-9a-f]{32}$/i);
  assert.match(trace.spanId ?? "", /^[0-9a-f]{16}$/i);
  assert.equal(trace.parentSpanId, null);
  assert.equal(trace.correlationId, trace.traceId);
});

test("createChildTraceContext inherits from parent from shared barrel", () => {
  const parent: ReturnType<typeof createRootTraceContext> = {
    traceId: "trace_parent",
    spanId: "span_parent",
    parentSpanId: null,
    correlationId: "trace_parent",
  };
  const child = createChildTraceContext(parent);
  assert.equal(child.traceId, "trace_parent");
  assert.match(child.spanId ?? "", /^[0-9a-f]{16}$/i);
  assert.equal(child.parentSpanId, "span_parent");
  assert.equal(child.correlationId, "trace_parent");
});

// ============================================================================
// Stability Module Re-exports
// ============================================================================
import { REQUIRED_GOLDEN_TASK_CLASSES, SINGLE_TASK_GOLDEN_TASKS } from "../../../src/platform/shared/index.js";

test("REQUIRED_GOLDEN_TASK_CLASSES is an array from shared barrel", () => {
  assert.ok(Array.isArray(REQUIRED_GOLDEN_TASK_CLASSES));
  assert.equal(REQUIRED_GOLDEN_TASK_CLASSES.length, 7);
  assert.equal(REQUIRED_GOLDEN_TASK_CLASSES[0], "coding");
});

test("SINGLE_TASK_GOLDEN_TASKS is a non-empty array from shared barrel", () => {
  assert.ok(Array.isArray(SINGLE_TASK_GOLDEN_TASKS));
  assert.ok(SINGLE_TASK_GOLDEN_TASKS.length > 0);
});

// ============================================================================
// Context Module Re-exports
// ============================================================================
import {
  provideContext,
  getContextOrNull,
  withContextPatch,
  hasTenantContext,
  hasWorkspaceContext,
} from "../../../src/platform/shared/index.js";

test("provideContext executes function within context", () => {
  const snapshot = {
    traceId: "test-trace",
    taskId: "test-task",
  };

  const result = provideContext(snapshot, () => {
    const ctx = getContextOrNull();
    return ctx?.traceId;
  });

  assert.equal(result, "test-trace");
});

test("getContextOrNull returns null outside context", () => {
  const result = getContextOrNull();
  assert.equal(result, null);
});

test("withContextPatch creates patched context", () => {
  const snapshot = {
    traceId: "test-trace",
    taskId: "test-task",
    tenantId: "original-tenant",
  };

  const result = provideContext(snapshot, () => {
    return withContextPatch({ tenantId: "patched-tenant" }, () => {
      const ctx = getContextOrNull();
      return ctx?.tenantId;
    });
  });

  assert.equal(result, "patched-tenant");
});

test("hasTenantContext returns false outside context", () => {
  const result = hasTenantContext();
  assert.equal(result, false);
});

test("hasWorkspaceContext returns false outside context", () => {
  const result = hasWorkspaceContext();
  assert.equal(result, false);
});
