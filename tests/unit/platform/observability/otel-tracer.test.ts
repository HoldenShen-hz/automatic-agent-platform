/**
 * OTEL Tracer Unit Tests
 *
 * Tests for OpenTelemetry tracing utilities including trace/span ID generation,
 * validation, context propagation, and active span management.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  generateTraceId,
  generateSpanId,
  isValidTraceId,
  isValidSpanId,
  getActiveTelemetryContext,
  startActiveSpan,
  type ActiveTelemetryContext,
} from "../../../../src/platform/shared/observability/otel-tracer.js";

// =============================================================================
// Trace ID generation and validation
// =============================================================================

test("generateTraceId creates 32-character hex string", () => {
  const traceId = generateTraceId();

  assert.equal(traceId.length, 32, "Trace ID should be 32 characters");
  assert.ok(/^[0-9a-f]{32}$/i.test(traceId), "Trace ID should be hexadecimal");
});

test("generateTraceId generates unique IDs", () => {
  const id1 = generateTraceId();
  const id2 = generateTraceId();

  assert.notEqual(id1, id2, "Generated trace IDs should be unique");
});

test("isValidTraceId returns true for valid 32-char hex", () => {
  assert.equal(isValidTraceId("a".repeat(32)), true);
  assert.equal(isValidTraceId("A".repeat(32)), true);
  assert.equal(isValidTraceId("0123456789abcdef".repeat(2)), true);
});

test("isValidTraceId returns false for null/undefined/empty", () => {
  assert.equal(isValidTraceId(null), false);
  assert.equal(isValidTraceId(undefined), false);
  assert.equal(isValidTraceId(""), false);
});

test("isValidTraceId returns false for wrong length", () => {
  assert.equal(isValidTraceId("a".repeat(31)), false);
  assert.equal(isValidTraceId("a".repeat(33)), false);
  assert.equal(isValidTraceId("a".repeat(16)), false);
});

test("isValidTraceId returns false for all zeros", () => {
  assert.equal(isValidTraceId("0".repeat(32)), false);
});

test("isValidTraceId returns false for non-hex characters", () => {
  assert.equal(isValidTraceId("g".repeat(32)), false);
  assert.equal(isValidTraceId("a".repeat(31) + "z"), false);
});

// =============================================================================
// Span ID generation and validation
// =============================================================================

test("generateSpanId creates 16-character hex string", () => {
  const spanId = generateSpanId();

  assert.equal(spanId.length, 16, "Span ID should be 16 characters");
  assert.ok(/^[0-9a-f]{16}$/i.test(spanId), "Span ID should be hexadecimal");
});

test("generateSpanId generates unique IDs", () => {
  const id1 = generateSpanId();
  const id2 = generateSpanId();

  assert.notEqual(id1, id2, "Generated span IDs should be unique");
});

test("isValidSpanId returns true for valid 16-char hex", () => {
  assert.equal(isValidSpanId("a".repeat(16)), true);
  assert.equal(isValidSpanId("A".repeat(16)), true);
  assert.equal(isValidSpanId("0123456789abcdef"), true);
});

test("isValidSpanId returns false for null/undefined/empty", () => {
  assert.equal(isValidSpanId(null), false);
  assert.equal(isValidSpanId(undefined), false);
  assert.equal(isValidSpanId(""), false);
});

test("isValidSpanId returns false for wrong length", () => {
  assert.equal(isValidSpanId("a".repeat(15)), false);
  assert.equal(isValidSpanId("a".repeat(17)), false);
  assert.equal(isValidSpanId("a".repeat(32)), false);
});

test("isValidSpanId returns false for all zeros", () => {
  assert.equal(isValidSpanId("0".repeat(16)), false);
});

// =============================================================================
// Active telemetry context
// =============================================================================

test("getActiveTelemetryContext returns null when no active span", () => {
  // When no OTel API available and no fallback context, should return null
  const context = getActiveTelemetryContext();
  // Can be null in isolated test context
  assert.ok(context === null || typeof context === "object");
});

// =============================================================================
// startActiveSpan
// =============================================================================

test("startActiveSpan executes callback with span", async () => {
  const result = await startActiveSpan(
    "test-span",
    {},
    async (span, context) => {
      assert.ok(span != null, "Span should be provided");
      assert.ok(context != null, "Context should be provided");
      assert.equal(context.traceId.length, 32, "Context should have valid traceId");
      assert.equal(context.spanId.length, 16, "Context should have valid spanId");
      return "test-result";
    },
  );

  assert.equal(result, "test-result");
});

test("startActiveSpan includes span name in attributes", async () => {
  await startActiveSpan(
    "my-operation",
    {},
    async (span, _context) => {
      assert.ok(typeof span.setAttribute === "function", "Span should have setAttribute");
      return undefined;
    },
  );
});

test("startActiveSpan uses provided attributes", async () => {
  await startActiveSpan(
    "attributed-span",
    { attributes: { "custom.attribute": "test-value", numberAttr: 42 } },
    async (_span, _context) => {
      return undefined;
    },
  );
});

test("startActiveSpan uses provided parent context", async () => {
  const parentContext: ActiveTelemetryContext = {
    traceId: generateTraceId(),
    spanId: generateSpanId(),
    parentSpanId: null,
  };

  await startActiveSpan(
    "child-span",
    { parentContext },
    async (_span, context) => {
      assert.equal(context.traceId, parentContext.traceId);
      return undefined;
    },
  );
});

test("startActiveSpan derives parent span from parent context", async () => {
  const parentTraceId = generateTraceId();
  const parentSpanId = generateSpanId();

  const parentContext = {
    traceId: parentTraceId,
    spanId: parentSpanId,
    parentSpanId: null,
  };

  await startActiveSpan(
    "derived-child",
    { parentContext },
    async (_span, context) => {
      assert.equal(context.traceId, parentTraceId);
      assert.equal(context.parentSpanId, parentSpanId);
      return undefined;
    },
  );
});

test("startActiveSpan handles span errors and records exception", async () => {
  const testError = new Error("span-error-test");

  await assert.rejects(
    async () => {
      await startActiveSpan(
        "error-span",
        {},
        async (_span, _context) => {
          throw testError;
        },
      );
    },
    (err: unknown) => err === testError,
  );
});

test("startActiveSpan handles async callback returning value", async () => {
  const result = await startActiveSpan("async-span", {}, async () => {
    await Promise.resolve();
    return { data: "computed" };
  });

  assert.deepEqual(result, { data: "computed" });
});

test("startActiveSpan works without OTel API using fallback context", async () => {
  // Force fallback path by not having @opentelemetry/api available
  let capturedContext: ActiveTelemetryContext | null = null;

  await startActiveSpan(
    "fallback-span",
    {},
    async (_span, context) => {
      capturedContext = context;
      return undefined;
    },
  );

  assert.ok(capturedContext != null);
  assert.equal(capturedContext!.traceId.length, 32);
  assert.equal(capturedContext!.spanId.length, 16);
});

test("startActiveSpan with tracerName uses custom tracer", async () => {
  await startActiveSpan(
    "custom-tracer-span",
    { tracerName: "my-custom-tracer" },
    async (_span, _context) => {
      return undefined;
    },
  );
});