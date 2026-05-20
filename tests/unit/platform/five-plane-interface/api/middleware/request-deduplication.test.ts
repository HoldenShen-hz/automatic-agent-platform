import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  DeduplicationMiddleware,
  createDeduplicationMiddleware,
  getGlobalDeduplicationMiddleware,
  resetGlobalDeduplicationMiddleware,
  DEFAULT_DEDUPLICATION_CONFIG,
} from "../../../../../../src/platform/five-plane-interface/api/middleware/request-deduplication.js";

test("DeduplicationMiddleware.check allows first request", () => {
  const middleware = new DeduplicationMiddleware({
    windowMs: 60_000,
    maxFingerprints: 100,
    includeBody: false,
  });

  const fingerprint = middleware.generateFingerprint({ method: "POST", path: "/api/tasks" });
  const result = middleware.check("global", fingerprint);

  assert.equal(result.allowed, true);
  assert.equal(result.isDuplicate, false);
});

test("DeduplicationMiddleware.check blocks duplicate request", () => {
  const middleware = new DeduplicationMiddleware({
    windowMs: 60_000,
    maxFingerprints: 100,
    includeBody: false,
  });

  const fingerprint1 = middleware.generateFingerprint({ method: "POST", path: "/api/tasks" });
  middleware.check("global", fingerprint1);

  const fingerprint2 = middleware.generateFingerprint({ method: "POST", path: "/api/tasks" });
  const result = middleware.check("global", fingerprint2);

  assert.equal(result.allowed, false);
  assert.equal(result.isDuplicate, true);
  assert.ok(result.originalRequestId !== null);
});

test("DeduplicationMiddleware.check includes body hash when enabled", () => {
  const middleware = new DeduplicationMiddleware({
    windowMs: 60_000,
    maxFingerprints: 100,
    includeBody: true,
  });

  const fp1 = middleware.generateFingerprint({ method: "POST", path: "/api/tasks", body: '{"a":1}' });
  middleware.check("global", fp1);

  // Same path but different body should be allowed
  const fp2 = middleware.generateFingerprint({ method: "POST", path: "/api/tasks", body: '{"b":2}' });
  const result = middleware.check("global", fp2);
  assert.equal(result.allowed, true);

  // Same body should be duplicate
  const fp3 = middleware.generateFingerprint({ method: "POST", path: "/api/tasks", body: '{"a":1}' });
  const result2 = middleware.check("global", fp3);
  assert.equal(result2.isDuplicate, true);
});

test("DeduplicationMiddleware.check ignores body when includeBody is false", () => {
  const middleware = new DeduplicationMiddleware({
    windowMs: 60_000,
    maxFingerprints: 100,
    includeBody: false,
  });

  const fp1 = middleware.generateFingerprint({ method: "POST", path: "/api/tasks", body: '{"a":1}' });
  middleware.check("global", fp1);

  const fp2 = middleware.generateFingerprint({ method: "POST", path: "/api/tasks", body: '{"b":2}' });
  const result = middleware.check("global", fp2);

  assert.equal(result.isDuplicate, true); // Same path, so duplicate
});

test("DeduplicationMiddleware.generateKey returns global by default", () => {
  const middleware = new DeduplicationMiddleware({
    windowMs: 60_000,
    maxFingerprints: 100,
  });

  const key = middleware.generateKey({ method: "POST", path: "/v1/tasks" });
  assert.equal(key, "global:POST:/v1/tasks");
});

test("DeduplicationMiddleware.generateKey returns tenant key when perTenant enabled", () => {
  const middleware = new DeduplicationMiddleware({
    windowMs: 60_000,
    maxFingerprints: 100,
    perTenant: true,
  });

  const key = middleware.generateKey({ tenantId: "tenant-abc", method: "POST", path: "/v1/tasks" });
  assert.equal(key, "tenant:tenant-abc:POST:/v1/tasks");
});

test("DeduplicationMiddleware.generateKey isolates method and path buckets", () => {
  const middleware = new DeduplicationMiddleware({
    windowMs: 60_000,
    maxFingerprints: 100,
    perTenant: true,
  });

  assert.notEqual(
    middleware.generateKey({ tenantId: "tenant-abc", method: "POST", path: "/v1/tasks" }),
    middleware.generateKey({ tenantId: "tenant-abc", method: "PATCH", path: "/v1/tasks/task-1" }),
  );
});

test("DeduplicationMiddleware.clear removes all entries", () => {
  const middleware = new DeduplicationMiddleware({
    windowMs: 60_000,
    maxFingerprints: 100,
  });

  const fp1 = middleware.generateFingerprint({ method: "POST", path: "/api/tasks" });
  middleware.check("global", fp1);

  middleware.clear();

  const fp2 = middleware.generateFingerprint({ method: "POST", path: "/api/tasks" });
  const result = middleware.check("global", fp2);
  assert.equal(result.allowed, true);
});

test("DeduplicationMiddleware.reset clears specific key", () => {
  const middleware = new DeduplicationMiddleware({
    windowMs: 60_000,
    maxFingerprints: 100,
  });

  const fp1 = middleware.generateFingerprint({ method: "POST", path: "/api/tasks" });
  middleware.check("key1", fp1);

  middleware.reset("key1");

  const fp2 = middleware.generateFingerprint({ method: "POST", path: "/api/tasks" });
  const result = middleware.check("key1", fp2);
  assert.equal(result.allowed, true);
});

test("DeduplicationMiddleware.generateFingerprint normalizes method to uppercase", () => {
  const middleware = new DeduplicationMiddleware({
    windowMs: 60_000,
    maxFingerprints: 100,
  });

  const fp = middleware.generateFingerprint({ method: "post", path: "/api/tasks" });
  assert.equal(fp.method, "POST");
});

test("DeduplicationMiddleware.prunes old entries when maxFingerprints exceeded", () => {
  const middleware = new DeduplicationMiddleware({
    windowMs: 60_000,
    maxFingerprints: 3,
  });

  for (let i = 0; i < 5; i++) {
    const fp = middleware.generateFingerprint({ method: "POST", path: `/api/tasks/${i}` });
    middleware.check("global", fp);
  }

  // First two should be pruned and not be duplicates
  const fp = middleware.generateFingerprint({ method: "POST", path: "/api/tasks/0" });
  const result = middleware.check("global", fp);
  assert.equal(result.isDuplicate, false);
});

test("createDeduplicationMiddleware creates instance with defaults", () => {
  const middleware = createDeduplicationMiddleware();
  assert.ok(middleware instanceof DeduplicationMiddleware);
});

test("getGlobalDeduplicationMiddleware returns singleton", () => {
  resetGlobalDeduplicationMiddleware();
  const instance1 = getGlobalDeduplicationMiddleware();
  const instance2 = getGlobalDeduplicationMiddleware();
  assert.equal(instance1, instance2);
});

test("resetGlobalDeduplicationMiddleware clears singleton", () => {
  resetGlobalDeduplicationMiddleware();
  const instance1 = getGlobalDeduplicationMiddleware();
  resetGlobalDeduplicationMiddleware();
  const instance2 = getGlobalDeduplicationMiddleware();
  assert.notEqual(instance1, instance2);
});

test("DEFAULT_DEDUPLICATION_CONFIG has correct values", () => {
  assert.equal(DEFAULT_DEDUPLICATION_CONFIG.windowMs, 60_000);
  assert.equal(DEFAULT_DEDUPLICATION_CONFIG.maxFingerprints, 10_000);
  assert.equal(DEFAULT_DEDUPLICATION_CONFIG.includeBody, true);
  assert.equal(DEFAULT_DEDUPLICATION_CONFIG.perTenant, true);
});

test("DeduplicationMiddleware.check returns retryAfterMs for duplicate", () => {
  const middleware = new DeduplicationMiddleware({
    windowMs: 60_000,
    maxFingerprints: 100,
  });

  const fp1 = middleware.generateFingerprint({ method: "POST", path: "/api/tasks" });
  middleware.check("global", fp1);

  const fp2 = middleware.generateFingerprint({ method: "POST", path: "/api/tasks" });
  const result = middleware.check("global", fp2);

  assert.equal(result.isDuplicate, true);
  assert.ok(result.retryAfterMs !== null);
});
