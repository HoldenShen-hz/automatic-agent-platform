/**
 * Infrastructure: Cache Types Tests
 *
 * Tests for cache type definitions, utility functions, and constants.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

// Import from cache-types
import type {
  CacheScope,
  CacheLayer,
  CacheMissReason,
  CacheMeta,
  CacheEntry,
  CacheLookupResult,
  CachePolicy,
  CacheComputeOptions,
  CacheRequest,
  CacheMetrics,
  CacheStats,
} from "../../../src/platform/shared/cache/cache-types.js";

import {
  CACHEABLE_TOOLS,
  UNCACHEABLE_TOOLS,
  isCacheableTool,
  isUncacheableTool,
} from "../../../src/platform/shared/cache/cache-types.js";

describe("CacheScope", () => {
  it("has memory scope", () => {
    const scope: CacheScope = "memory";
    assert.equal(scope, "memory");
  });

  it("has session scope", () => {
    const scope: CacheScope = "session";
    assert.equal(scope, "session");
  });

  it("has persistent scope", () => {
    const scope: CacheScope = "persistent";
    assert.equal(scope, "persistent");
  });
});

describe("CacheLayer", () => {
  it("has L1 layer", () => {
    const layer: CacheLayer = "L1";
    assert.equal(layer, "L1");
  });

  it("has L2 layer", () => {
    const layer: CacheLayer = "L2";
    assert.equal(layer, "L2");
  });

  it("has L3 layer", () => {
    const layer: CacheLayer = "L3";
    assert.equal(layer, "L3");
  });
});

describe("CacheMissReason", () => {
  const reasons: CacheMissReason[] = [
    "not_found",
    "expired",
    "invalidated",
    "version_mismatch",
    "payload_too_large",
    "disabled",
    "not_cacheable",
  ];

  it("has all expected reasons", () => {
    for (const reason of reasons) {
      assert.ok(reason);
    }
  });
});

describe("CacheMeta", () => {
  it("can be created with required fields", () => {
    const meta: CacheMeta = {
      scope: "memory",
      ttlMs: 5000,
      tags: ["tag1"],
      version: "v1",
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      hitCount: 0,
      sizeBytes: 1024,
    };

    assert.equal(meta.scope, "memory");
    assert.equal(meta.ttlMs, 5000);
    assert.ok(Array.isArray(meta.tags));
  });

  it("can have optional fields", () => {
    const now = Date.now();
    const meta: CacheMeta = {
      scope: "session",
      ttlMs: 1000,
      tags: [],
      version: "v1",
      createdAt: now,
      expiresAt: now + 1000,
      lastAccessedAt: now,
      hitCount: 5,
      sizeBytes: 256,
      contentType: "application/json",
    };

    assert.equal(meta.expiresAt, now + 1000);
    assert.equal(meta.contentType, "application/json");
  });
});

describe("CacheEntry", () => {
  it("can hold generic value", () => {
    const entry: CacheEntry<string> = {
      namespace: "tool.read",
      key: "abc123",
      value: "file content",
      meta: {
        scope: "memory",
        tags: [],
        version: "v1",
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        hitCount: 0,
        sizeBytes: 100,
      },
    };

    assert.equal(entry.value, "file content");
  });

  it("can hold object value", () => {
    const entry: CacheEntry<{ path: string; content: string }> = {
      namespace: "tool.read",
      key: "key123",
      value: { path: "/test.ts", content: "code" },
      meta: {
        scope: "session",
        tags: ["file:/test.ts"],
        version: "v1",
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        hitCount: 0,
        sizeBytes: 200,
      },
    };

    assert.equal(entry.value.path, "/test.ts");
  });
});

describe("CacheLookupResult", () => {
  it("represents a cache hit", () => {
    const result: CacheLookupResult<string> = {
      hit: true,
      value: "cached value",
      layer: "L1",
    };

    assert.equal(result.hit, true);
    assert.equal(result.value, "cached value");
    assert.equal(result.layer, "L1");
  });

  it("represents a cache miss", () => {
    const result: CacheLookupResult<unknown> = {
      hit: false,
      value: null,
      reason: "not_found",
    };

    assert.equal(result.hit, false);
    assert.equal(result.value, null);
    assert.equal(result.reason, "not_found");
  });

  it("can include metadata", () => {
    const result: CacheLookupResult<number> = {
      hit: true,
      value: 42,
      layer: "L2",
      meta: {
        scope: "memory",
        tags: [],
        version: "v1",
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        hitCount: 1,
        sizeBytes: 8,
      },
    };

    assert.ok(result.meta);
    assert.equal(result.meta.hitCount, 1);
  });

  it("can indicate backfill failure", () => {
    const result: CacheLookupResult<string> = {
      hit: false,
      value: null,
      reason: "expired",
      backfillFailed: true,
    };

    assert.equal(result.backfillFailed, true);
  });
});

describe("CachePolicy", () => {
  it("has required fields", () => {
    const policy: CachePolicy = {
      enabled: true,
      scope: "session",
      ttlMs: 5000,
      version: "v1",
      maxPayloadBytes: 1024,
    };

    assert.equal(policy.enabled, true);
    assert.equal(policy.scope, "session");
  });

  it("can have optional staleWhileRevalidate", () => {
    const policy: CachePolicy = {
      enabled: true,
      scope: "persistent",
      ttlMs: 60000,
      version: "v1",
      maxPayloadBytes: 2048,
      staleWhileRevalidate: true,
    };

    assert.equal(policy.staleWhileRevalidate, true);
  });
});

describe("CacheComputeOptions", () => {
  it("can specify tags", () => {
    const options: CacheComputeOptions = {
      tags: ["file:/workspace/test.ts", "tool:read"],
    };

    assert.ok(Array.isArray(options.tags));
    assert.equal(options.tags.length, 2);
  });

  it("can specify content type", () => {
    const options: CacheComputeOptions = {
      contentType: "application/json",
    };

    assert.equal(options.contentType, "application/json");
  });

  it("can force bypass", () => {
    const options: CacheComputeOptions = {
      forceBypass: true,
    };

    assert.equal(options.forceBypass, true);
  });
});

describe("CacheRequest", () => {
  it("has required fields", () => {
    const request: CacheRequest<string> = {
      namespace: "tool.read",
      keyInput: "/workspace/test.ts",
    };

    assert.equal(request.namespace, "tool.read");
  });

  it("can have optional session ID", () => {
    const request: CacheRequest<object> = {
      namespace: "planner.plan",
      keyInput: { goal: "fix bug" },
      sessionId: "session-123",
    };

    assert.equal(request.sessionId, "session-123");
  });

  it("can have policy override", () => {
    const request: CacheRequest<unknown> = {
      namespace: "tool.read",
      keyInput: {},
      policyOverride: {
        ttlMs: 10000,
        scope: "persistent",
      },
    };

    assert.ok(request.policyOverride);
    assert.equal(request.policyOverride.ttlMs, 10000);
  });
});

describe("CACHEABLE_TOOLS", () => {
  it("contains expected tools", () => {
    const expected = [
      "read",
      "glob",
      "grep",
      "repo_map",
      "diagnostics",
      "web_fetch",
      "memory_summary",
      "memory_retrieval",
      "planner_plan",
    ];

    for (const tool of expected) {
      assert.ok(CACHEABLE_TOOLS.includes(tool as typeof CACHEABLE_TOOLS[number]), `${tool} should be in CACHEABLE_TOOLS`);
    }
  });

  it("has exactly 9 tools", () => {
    assert.equal(CACHEABLE_TOOLS.length, 9);
  });
});

describe("UNCACHEABLE_TOOLS", () => {
  it("contains write and modify tools", () => {
    assert.ok(UNCACHEABLE_TOOLS.includes("bash"));
    assert.ok(UNCACHEABLE_TOOLS.includes("write"));
    assert.ok(UNCACHEABLE_TOOLS.includes("edit"));
  });

  it("contains git tools", () => {
    assert.ok(UNCACHEABLE_TOOLS.includes("git_commit"));
    assert.ok(UNCACHEABLE_TOOLS.includes("git_push"));
  });

  it("contains apply_patch", () => {
    assert.ok(UNCACHEABLE_TOOLS.includes("apply_patch"));
  });
});

describe("isCacheableTool", () => {
  it("returns true for cacheable tools", () => {
    assert.equal(isCacheableTool("read"), true);
    assert.equal(isCacheableTool("glob"), true);
    assert.equal(isCacheableTool("grep"), true);
  });

  it("returns false for uncacheable tools", () => {
    assert.equal(isCacheableTool("bash"), false);
    assert.equal(isCacheableTool("write"), false);
    assert.equal(isCacheableTool("edit"), false);
  });

  it("returns false for unknown tools", () => {
    assert.equal(isCacheableTool("unknown_tool"), false);
  });
});

describe("isUncacheableTool", () => {
  it("returns true for uncacheable tools", () => {
    assert.equal(isUncacheableTool("write"), true);
    assert.equal(isUncacheableTool("bash"), true);
    assert.equal(isUncacheableTool("edit"), true);
  });

  it("returns false for cacheable tools", () => {
    assert.equal(isUncacheableTool("read"), false);
    assert.equal(isUncacheableTool("glob"), false);
  });

  it("returns false for unknown tools", () => {
    assert.equal(isUncacheableTool("unknown_tool"), false);
  });
});