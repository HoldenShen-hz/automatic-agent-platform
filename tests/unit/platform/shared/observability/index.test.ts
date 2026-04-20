import assert from "node:assert/strict";
import test from "node:test";

// Barrel test for observability module
import {
  createRootTraceContext,
  createChildTraceContext,
  injectTraceContext,
  extractTraceContext,
  parseSystemSituation,
  type DiagnosticWarningCategory,
  type DiagnosticWarningSeverity,
  type DiagnosticWarningEscalation,
} from "../../../../../src/platform/shared/observability/index.js";

test("createRootTraceContext creates valid trace", () => {
  const trace = createRootTraceContext();
  assert.match(trace.traceId, /^[0-9a-f]{32}$/i);
  assert.match(trace.spanId ?? "", /^[0-9a-f]{16}$/i);
  assert.equal(trace.parentSpanId, null);
  assert.equal(trace.correlationId, trace.traceId);
});

test("createRootTraceContext with custom ids", () => {
  const trace = createRootTraceContext({
    traceId: "trace_custom",
    spanId: "span_custom",
    correlationId: "corr_123",
  });
  assert.equal(trace.traceId, "trace_custom");
  assert.equal(trace.spanId, "span_custom");
  assert.equal(trace.correlationId, "corr_123");
});

test("createChildTraceContext inherits from parent", () => {
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

test("createChildTraceContext with custom spanId", () => {
  const parent = createRootTraceContext();
  const child = createChildTraceContext(parent, { spanId: "span_child" });
  assert.equal(child.spanId, "span_child");
  assert.equal(child.parentSpanId, parent.spanId);
});

test("injectTraceContext adds trace to payload", () => {
  const trace = createRootTraceContext();
  const payload = { data: "test" };
  const result = injectTraceContext(payload, trace);
  assert.equal(result.data, "test");
  assert.deepEqual(result.traceContext, trace);
});

test("injectTraceContext with null context returns unchanged", () => {
  const payload = { data: "test" };
  const result = injectTraceContext(payload, null);
  assert.equal(result, payload);
});

test("injectTraceContext does not duplicate trace", () => {
  const trace = createRootTraceContext();
  const payloadWithTrace = { data: "test", traceContext: trace };
  const result = injectTraceContext(payloadWithTrace, trace);
  assert.equal(result, payloadWithTrace);
});

test("extractTraceContext extracts from valid record", () => {
  const trace = createRootTraceContext();
  const value = { data: "test", traceContext: trace };
  const result = extractTraceContext(value);
  assert.deepEqual(result, trace);
});

test("extractTraceContext returns null for invalid value", () => {
  const result = extractTraceContext("not an object");
  assert.equal(result, null);
});

test("extractTraceContext uses fallback values", () => {
  const result = extractTraceContext(
    { data: "test" },
    { traceId: "fallback_trace", correlationId: "fallback_corr" }
  );
  assert.ok(result !== null);
  assert.equal(result!.traceId, "fallback_trace");
});

test("DiagnosticWarningCategory type accepts valid values", () => {
  const categories: DiagnosticWarningCategory[] = [
    "health",
    "runtime",
    "approval",
    "takeover",
    "provider",
    "dispatch",
    "remote_authority",
    "other",
  ];
  assert.equal(categories.length, 8);
});

test("DiagnosticWarningSeverity type accepts valid values", () => {
  const severities: DiagnosticWarningSeverity[] = ["info", "warning", "critical"];
  assert.equal(severities.length, 3);
});

test("DiagnosticWarningEscalation type accepts valid values", () => {
  const escalations: DiagnosticWarningEscalation[] = ["none", "task", "operator"];
  assert.equal(escalations.length, 3);
});

test("parseSystemSituation is exported from observability barrel", () => {
  const situation = parseSystemSituation({
    healthStatus: "ok",
    providerHealth: { status: "healthy", successRate: 1, recentCalls: 1 },
    resourceUtilization: { memoryRssMb: 10, activeProcesses: 1 },
    queueBacklog: { size: 0, degraded: false },
    eventBusBacklog: { tier1PendingAcks: 0 },
    findings: [],
    observedAt: 1,
  });
  assert.equal(situation.healthStatus, "ok");
});
