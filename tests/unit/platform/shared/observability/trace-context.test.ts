import assert from "node:assert/strict";
import test from "node:test";

import {
  createRootTraceContext,
  createChildTraceContext,
  toAuditContextTraceContext,
  injectTraceContext,
  extractTraceContext,
} from "../../../../../src/platform/shared/observability/trace-context.js";

test("createRootTraceContext generates new trace and span IDs", () => {
  const ctx = createRootTraceContext();

  assert.match(ctx.traceId, /^[0-9a-f]{32}$/i);
  assert.match(ctx.spanId ?? "", /^[0-9a-f]{16}$/i);
  assert.equal(ctx.parentSpanId, null);
});

test("createRootTraceContext uses provided traceId", () => {
  const ctx = createRootTraceContext({ traceId: "custom_trace_123" });

  assert.equal(ctx.traceId, "custom_trace_123");
  assert.match(ctx.spanId ?? "", /^[0-9a-f]{16}$/i);
});

test("createRootTraceContext uses provided spanId", () => {
  const ctx = createRootTraceContext({ spanId: "custom_span_456" });

  assert.match(ctx.traceId, /^[0-9a-f]{32}$/i);
  assert.equal(ctx.spanId, "custom_span_456");
});

test("createRootTraceContext sets correlationId to traceId by default", () => {
  const ctx = createRootTraceContext();

  assert.equal(ctx.correlationId, ctx.traceId);
});

test("createRootTraceContext uses provided correlationId", () => {
  const ctx = createRootTraceContext({ correlationId: "custom_corr_789" });

  assert.equal(ctx.correlationId, "custom_corr_789");
});

test("createChildTraceContext inherits traceId from parent", () => {
  const parent = createRootTraceContext();
  const child = createChildTraceContext(parent);

  assert.equal(child.traceId, parent.traceId);
  assert.notEqual(child.spanId, parent.spanId);
});

test("createChildTraceContext sets parentSpanId to parent spanId", () => {
  const parent = createRootTraceContext({ spanId: "parent_span" });
  const child = createChildTraceContext(parent);

  assert.equal(child.parentSpanId, "parent_span");
});

test("createChildTraceContext inherits correlationId from parent by default", () => {
  const parent = createRootTraceContext({ correlationId: "parent_corr" });
  const child = createChildTraceContext(parent);

  assert.equal(child.correlationId, "parent_corr");
});

test("createChildTraceContext uses provided spanId", () => {
  const parent = createRootTraceContext();
  const child = createChildTraceContext(parent, { spanId: "child_span" });

  assert.equal(child.spanId, "child_span");
  assert.equal(child.parentSpanId, parent.spanId);
});

test("createChildTraceContext uses provided correlationId", () => {
  const parent = createRootTraceContext();
  const child = createChildTraceContext(parent, { correlationId: "new_corr" });

  assert.equal(child.correlationId, "new_corr");
});

test("createChildTraceContext handles null parent spanId", () => {
  const parent = { traceId: "trace_123", spanId: null, correlationId: "corr_123" };
  const child = createChildTraceContext(parent);

  assert.equal(child.parentSpanId, null);
});

test("toAuditContextTraceContext converts audit context to trace context", () => {
  const auditCtx = {
    traceId: "audit_trace",
    spanId: "audit_span",
    parentSpanId: "audit_parent",
    correlationId: "audit_corr",
    reasonCode: "test",
    actorType: "agent" as const,
    occurredAt: "2026-04-14T00:00:00.000Z",
  };

  const ctx = toAuditContextTraceContext(auditCtx);

  assert.equal(ctx.traceId, "audit_trace");
  assert.equal(ctx.spanId, "audit_span");
  assert.equal(ctx.parentSpanId, "audit_parent");
  assert.equal(ctx.correlationId, "audit_corr");
});

test("toAuditContextTraceContext handles missing optional fields", () => {
  const auditCtx = {
    traceId: "audit_trace",
    reasonCode: "test",
    actorType: "agent" as const,
    occurredAt: "2026-04-14T00:00:00.000Z",
  };

  const ctx = toAuditContextTraceContext(auditCtx);

  assert.equal(ctx.traceId, "audit_trace");
  assert.equal(ctx.spanId, null);
  assert.equal(ctx.parentSpanId, null);
  assert.equal(ctx.correlationId, "audit_trace"); // Falls back to traceId
});

test("injectTraceContext adds trace context to payload", () => {
  const payload = { key: "value" };
  const traceCtx = createRootTraceContext();

  const result = injectTraceContext(payload, traceCtx);

  assert.equal(result.key, "value");
  assert.deepEqual(result.traceContext, traceCtx);
});

test("injectTraceContext returns original payload if traceCtx is null", () => {
  const payload = { key: "value" };

  const result = injectTraceContext(payload, null);

  assert.deepEqual(result, payload);
});

test("injectTraceContext returns original payload if traceContext already exists", () => {
  const payload = { key: "value", traceContext: { existing: "context" } };
  const traceCtx = createRootTraceContext();

  const result = injectTraceContext(payload, traceCtx);

  assert.deepEqual(result, payload);
});

test("extractTraceContext extracts traceContext from value", () => {
  const traceCtx = createRootTraceContext();
  const value = { data: "test", traceContext: traceCtx };

  const result = extractTraceContext(value);

  assert.deepEqual(result, traceCtx);
});

test("extractTraceContext returns null when no traceContext and no fallback", () => {
  const value = { data: "test" };

  const result = extractTraceContext(value);

  assert.equal(result, null);
});

test("extractTraceContext uses fallback traceId", () => {
  const value = { data: "test" };
  const fallback = { traceId: "fallback_trace" };

  const result = extractTraceContext(value, fallback);

  assert.equal(result?.traceId, "fallback_trace");
  assert.equal(result?.correlationId, "fallback_trace");
});

test("extractTraceContext uses fallback correlationId", () => {
  const value = { data: "test" };
  const fallback = { traceId: "fallback_trace", correlationId: "fallback_corr" };

  const result = extractTraceContext(value, fallback);

  assert.equal(result?.correlationId, "fallback_corr");
});

test("extractTraceContext normalizes partial trace context", () => {
  const value = { data: "test", traceContext: { traceId: "partial_trace" } };

  const result = extractTraceContext(value);

  assert.equal(result?.traceId, "partial_trace");
  assert.equal(result?.spanId, null);
  assert.equal(result?.parentSpanId, null);
  assert.equal(result?.correlationId, "partial_trace");
});

test("extractTraceContext handles non-record values", () => {
  const result1 = extractTraceContext(null);
  const result2 = extractTraceContext(undefined);
  const result3 = extractTraceContext("string");
  const result4 = extractTraceContext(123);

  assert.equal(result1, null);
  assert.equal(result2, null);
  assert.equal(result3, null);
  assert.equal(result4, null);
});

test("createRootTraceContext produces unique IDs each call", () => {
  const ctx1 = createRootTraceContext();
  const ctx2 = createRootTraceContext();

  assert.notEqual(ctx1.traceId, ctx2.traceId);
  assert.notEqual(ctx1.spanId, ctx2.spanId);
});

test("createChildTraceContext produces unique spanIds", () => {
  const parent = createRootTraceContext();
  const child1 = createChildTraceContext(parent);
  const child2 = createChildTraceContext(parent);

  assert.notEqual(child1.spanId, child2.spanId);
});
