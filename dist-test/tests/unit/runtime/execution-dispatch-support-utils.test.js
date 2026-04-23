import test from "node:test";
import assert from "node:assert/strict";
import { isElevatedPriority, resolveDispatchBackpressureReason } from "../../../src/platform/execution/dispatcher/execution-dispatch-support.js";
test("isElevatedPriority returns true for high and urgent", () => {
    assert.equal(isElevatedPriority("high"), true);
    assert.equal(isElevatedPriority("urgent"), true);
    assert.equal(isElevatedPriority("normal"), false);
    assert.equal(isElevatedPriority("low"), false);
});
test("resolveDispatchBackpressureReason returns null when snapshot is null", () => {
    const result = resolveDispatchBackpressureReason({ priority: "high" }, null);
    assert.equal(result, null);
});
test("resolveDispatchBackpressureReason returns read_only_mode for read_only_operations_only degradation", () => {
    const result = resolveDispatchBackpressureReason({ priority: "normal" }, { degradationMode: "read_only_operations_only", queueGovernance: { starvationDetected: false } });
    assert.equal(result, "backpressure.read_only_mode");
});
test("resolveDispatchBackpressureReason returns null for elevated priority during pause_non_critical", () => {
    const result = resolveDispatchBackpressureReason({ priority: "high" }, { degradationMode: "pause_non_critical", queueGovernance: { starvationDetected: false } });
    assert.equal(result, null);
});
test("resolveDispatchBackpressureReason returns backpressure.pause_non_critical for non-elevated during pause_non_critical", () => {
    const result = resolveDispatchBackpressureReason({ priority: "normal" }, { degradationMode: "pause_non_critical", queueGovernance: { starvationDetected: false } });
    assert.equal(result, "backpressure.pause_non_critical");
});
test("resolveDispatchBackpressureReason returns starvation_protection for low priority with starvation", () => {
    const result = resolveDispatchBackpressureReason({ priority: "low" }, { degradationMode: "queue_only", queueGovernance: { starvationDetected: true } });
    assert.equal(result, "backpressure.starvation_protection");
});
test("resolveDispatchBackpressureReason returns backpressure.queue_only for non-elevated during queue_only", () => {
    const result = resolveDispatchBackpressureReason({ priority: "normal" }, { degradationMode: "queue_only", queueGovernance: { starvationDetected: false } });
    assert.equal(result, "backpressure.queue_only");
});
test("resolveDispatchBackpressureReason returns null when no conditions match", () => {
    const result = resolveDispatchBackpressureReason({ priority: "high" }, { degradationMode: "queue_only", queueGovernance: { starvationDetected: false } });
    assert.equal(result, null);
});
//# sourceMappingURL=execution-dispatch-support-utils.test.js.map