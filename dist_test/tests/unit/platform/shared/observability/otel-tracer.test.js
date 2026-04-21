import assert from "node:assert/strict";
import test from "node:test";
import { StructuredLogger } from "../../../../../src/platform/shared/observability/structured-logger.js";
import { getActiveTelemetryContext, startActiveSpan } from "../../../../../src/platform/shared/observability/otel-tracer.js";
test("startActiveSpan exposes active telemetry context to structured logs", async () => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    let traceId = null;
    await startActiveSpan("observability.test", {}, async (_span, context) => {
        traceId = context.traceId;
        logger.info("inside span");
    });
    const entry = logger.recent(1)[0];
    assert.ok(entry);
    assert.equal(entry?.traceId, traceId);
    assert.equal(typeof entry?.spanId, "string");
});
test("nested spans preserve trace id and parent span id", async () => {
    let parentSpanId = null;
    let childSpanId = null;
    await startActiveSpan("observability.parent", {}, async (_parentSpan, parentContext) => {
        parentSpanId = parentContext.spanId;
        await startActiveSpan("observability.child", {}, async (_childSpan, childContext) => {
            childSpanId = childContext.spanId;
            assert.equal(childContext.traceId, parentContext.traceId);
            assert.equal(childContext.parentSpanId, parentContext.spanId);
            assert.equal(getActiveTelemetryContext()?.spanId, childContext.spanId);
        });
        assert.equal(getActiveTelemetryContext()?.spanId, parentContext.spanId);
    });
    assert.notEqual(childSpanId, parentSpanId);
});
//# sourceMappingURL=otel-tracer.test.js.map