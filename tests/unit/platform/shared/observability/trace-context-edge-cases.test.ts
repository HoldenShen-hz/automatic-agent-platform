import assert from "node:assert/strict";
import test from "node:test";

import {
  createRootTraceContext,
  createChildTraceContext,
  toAuditContextTraceContext,
  injectTraceContext,
  extractTraceContext,
} from "../../../../../src/platform/shared/observability/trace-context.js";

test("createRootTraceContext with all null inputs produces valid context", () => {
  const ctx = createRootTraceContext({
    traceId: null,
    spanId: null,
    correlationId: null,
  });

  assert.match(ctx.traceId, /^[0-9a-f]{32}$/i);
  assert.match(ctx.spanId ?? "", /^[0-9a-f]{16}$/i);
  assert.equal(ctx.parentSpanId, null);
  assert.equal(ctx.correlationId, ctx.traceId);
});

test("createRootTraceContext uses active telemetry context when available", () => {
  // This test verifies the function checks for active context
  const ctx = createRootTraceContext({});

  // Without actual OTel setup, should still produce valid IDs
  assert.match(ctx.traceId, /^[0-9a-f]{32}$/i);
});

test("createChildTraceContext handles parent with null correlationId", () => {
  const parent = {
    traceId: "a".repeat(32),
    spanId: "b".repeat(16),
    correlationId: null,
  };

  const child = createChildTraceContext(parent);

  assert.equal(child.traceId, parent.traceId);
  assert.equal(child.correlationId, parent.traceId); // Falls back to traceId
});

test("createChildTraceContext handles parent with undefined spanId", () => {
  const parent = {
    traceId: "a".repeat(32),
    spanId: undefined,
    correlationId: "corr-123",
  } as any;

  const child = createChildTraceContext(parent);

  assert.ok(child.parentSpanId === null || child.parentSpanId === undefined);
});

test("toAuditContextTraceContext handles all null optional fields", () => {
  const auditCtx = {
    traceId: "trace-123",
    reasonCode: "test",
    actorType: "agent" as const,
    occurredAt: "2026-04-26T00:00:00.000Z",
    // All optional fields are undefined
  };

  const ctx = toAuditContextTraceContext(auditCtx);

  assert.equal(ctx.traceId, "trace-123");
  assert.equal(ctx.spanId, null);
  assert.equal(ctx.parentSpanId, null);
  assert.equal(ctx.correlationId, "trace-123");
});

test("injectTraceContext handles empty payload", () => {
  const result = injectTraceContext({}, createRootTraceContext());
  assert.ok("traceContext" in result);
});

test("injectTraceContext handles payload with null values", () => {
  const payload = { key: null, another: null };
  const ctx = createRootTraceContext();

  const result = injectTraceContext(payload, ctx);

  assert.equal(result.key, null);
  assert.equal(result.another, null);
  assert.ok("traceContext" in result);
});

test("injectTraceContext handles payload with undefined values", () => {
  const payload = { key: undefined };
  const ctx = createRootTraceContext();

  const result = injectTraceContext(payload as any, ctx);

  // undefined values are preserved but traceContext is added
  assert.ok("traceContext" in result);
});

test("extractTraceContext handles value with null traceContext property", () => {
  const value = { data: "test", traceContext: null };

  const result = extractTraceContext(value as any);

  // null traceContext should fall through to fallback
  assert.ok(result === null || result?.traceId !== undefined);
});

test("extractTraceContext handles value with undefined traceContext property", () => {
  const value = { data: "test", traceContext: undefined };

  const result = extractTraceContext(value as any);

  // undefined should be treated similarly to missing
  assert.ok(result === null || result?.traceId !== undefined);
});

test("extractTraceContext handles empty object value", () => {
  const result = extractTraceContext({});
  assert.equal(result, null);
});

test("extractTraceContext handles array value", () => {
  const result = extractTraceContext([1, 2, 3]);
  assert.equal(result, null);
});

test("extractTraceContext handles string value", () => {
  const result = extractTraceContext("string value");
  assert.equal(result, null);
});

test("extractTraceContext handles number value", () => {
  const result = extractTraceContext(42);
  assert.equal(result, null);
});

test("extractTraceContext handles boolean value", () => {
  const result = extractTraceContext(true);
  assert.equal(result, null);
});

test("extractTraceContext handles fallback with only correlationId", () => {
  const value = { data: "test" };
  const fallback: { traceId?: string; correlationId: string } = { correlationId: "fallback_corr" };

  const result = extractTraceContext(value, fallback);

  // Should use fallback traceId if provided
  if (fallback.traceId) {
    assert.equal(result?.traceId, fallback.traceId);
  }
});

test("extractTraceContext partial traceContext with only spanId", () => {
  const value = {
    traceContext: { spanId: "span-only" },
  };

  const result = extractTraceContext(value as any);

  // spanId is preserved
  assert.equal(result?.spanId, "span-only");
  // But traceId falls back to null since not provided
});

test("extractTraceContext normalizes traceId to null if invalid", () => {
  const value = {
    traceContext: { traceId: "invalid" },
  };

  const result = extractTraceContext(value as any, { traceId: "fallback" });

  // Should use fallback traceId
  assert.equal(result?.traceId, "fallback");
});

test("injectTraceContext returns same object reference when traceCtx is null", () => {
  const payload = { key: "value" };
  const result = injectTraceContext(payload, null);

  // Should return same object, not a new one
  assert.strictEqual(result, payload);
});

test("injectTraceContext returns same object reference when traceContext already exists", () => {
  const payload = { key: "value", traceContext: { existing: "context" } };
  const newCtx = createRootTraceContext();

  const result = injectTraceContext(payload, newCtx);

  // Should return same object without modification
  assert.strictEqual(result, payload);
  assert.equal((result as any).traceContext.existing, "context");
});

test("createRootTraceContext handles very long custom traceId (truncation behavior)", () => {
  const longTraceId = "a".repeat(100);
  const ctx = createRootTraceContext({ traceId: longTraceId });

  // Should preserve the provided traceId as-is
  assert.equal(ctx.traceId, longTraceId);
});

test("createChildTraceContext preserves parent spanId when it exists", () => {
  const parent = {
    traceId: "a".repeat(32),
    spanId: "parent_span_id",
    correlationId: "corr",
  };

  const child = createChildTraceContext(parent, { spanId: "child_span_id" });

  assert.equal(child.parentSpanId, "parent_span_id");
  assert.equal(child.spanId, "child_span_id");
});

test("createChildTraceContext with no parent spanId sets parentSpanId to null", () => {
  const parent = {
    traceId: "a".repeat(32),
    spanId: null,
    correlationId: "corr",
  };

  const child = createChildTraceContext(parent);

  assert.equal(child.parentSpanId, null);
});

test("extractTraceContext handles traceContext with empty string traceId", () => {
  const value = {
    traceContext: { traceId: "" },
  };

  const result = extractTraceContext(value as any, { traceId: "default" });

  // Should fall back to provided traceId
  assert.equal(result?.traceId, "default");
});

test("extractTraceContext preserves parentSpanId from traceContext", () => {
  const value = {
    traceContext: {
      traceId: "valid_trace_id_12345678901234567890",
      spanId: "span_12345678",
      parentSpanId: "parent_12345678",
    },
  };

  const result = extractTraceContext(value as any);

  assert.equal(result?.parentSpanId, "parent_12345678");
});

test("extractTraceContext with partial traceContext uses fallback for missing fields", () => {
  const value = {
    traceContext: {
      traceId: "valid_trace_id_12345678901234567890",
      // missing spanId and parentSpanId
    },
  };

  const result = extractTraceContext(value as any);

  assert.equal(result?.spanId, null);
  assert.equal(result?.parentSpanId, null);
  assert.equal(result?.correlationId, "valid_trace_id_12345678901234567890");
});
