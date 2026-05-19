import test from "node:test";
import assert from "node:assert/strict";
import { FeedbackCollector } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-collector.js";
test("FeedbackCollector deduplicates signals and emits learning signals", () => {
    const collector = new FeedbackCollector();
    const feedback = collector.collect({
        taskId: "task_1",
        signals: [
            {
                signalId: "sig_1",
                source: "execution",
                taskId: "task_1",
                category: "failure",
                severity: "error",
                payload: {
                    summary: "type mismatch",
                    reasonCode: "schema.invalid",
                },
                stepOutputRefs: ["artifact:a"],
                timestamp: 1,
            },
            {
                signalId: "sig_2",
                source: "execution",
                taskId: "task_1",
                category: "failure",
                severity: "error",
                payload: {
                    summary: "type mismatch",
                    reasonCode: "schema.invalid",
                },
                stepOutputRefs: ["artifact:a"],
                timestamp: 2,
            },
        ],
    });
    assert.equal(feedback.signals.length, 1);
    const learningSignals = collector.toLearningSignals(feedback);
    assert.equal(learningSignals.length, 1);
    assert.equal(learningSignals[0]?.learningType, "failure_pattern");
    assert.deepEqual(learningSignals[0]?.sourceSignalIds, ["sig_1", "sig_2"]);
});
test("FeedbackCollector collapses recovery sequences into a recovery playbook learning signal", () => {
    const collector = new FeedbackCollector();
    const feedback = collector.collect({
        taskId: "task_2",
        signals: [
            {
                signalId: "sig_fail",
                source: "validation",
                taskId: "task_2",
                category: "failure",
                severity: "error",
                payload: {
                    summary: "schema validation failed",
                    reasonCode: "schema.fail",
                },
                stepOutputRefs: ["step_validate"],
                timestamp: 1,
            },
            {
                signalId: "sig_fix",
                source: "execution",
                taskId: "task_2",
                category: "correction",
                severity: "warning",
                payload: {
                    summary: "repair attempt applied",
                    reasonCode: "repair.attempt",
                },
                stepOutputRefs: ["step_validate"],
                timestamp: 2,
            },
            {
                signalId: "sig_pass",
                source: "validation",
                taskId: "task_2",
                category: "success",
                severity: "info",
                payload: {
                    summary: "schema validation passed",
                    reasonCode: "schema.pass",
                },
                stepOutputRefs: ["step_validate"],
                timestamp: 3,
            },
        ],
    });
    const learningSignals = collector.toLearningSignals(feedback);
    assert.equal(learningSignals.length, 1);
    assert.equal(learningSignals[0]?.learningType, "recovery_playbook");
    assert.deepEqual(learningSignals[0]?.sourceSignalIds, ["sig_fail", "sig_fix", "sig_pass"]);
    assert.equal(learningSignals[0]?.evidence.pattern, "recovery_path");
});
test("FeedbackCollector handles empty signals", () => {
    const collector = new FeedbackCollector();
    const feedback = collector.collect({
        taskId: "task_empty",
        signals: [],
    });
    assert.equal(feedback.signals.length, 0);
    const learningSignals = collector.toLearningSignals(feedback);
    assert.equal(learningSignals.length, 0);
});
test("FeedbackCollector outcome is repairable when correction signal present", () => {
    const collector = new FeedbackCollector();
    const feedback = collector.collect({
        taskId: "task_correction",
        signals: [
            {
                signalId: "sig_1",
                source: "execution",
                taskId: "task_correction",
                category: "correction",
                severity: "warning",
                payload: { summary: "user corrected" },
                stepOutputRefs: [],
                timestamp: 1,
            },
        ],
    });
    assert.equal(feedback.outcome, "repairable");
});
test("FeedbackCollector outcome is partial when partial signal present", () => {
    const collector = new FeedbackCollector();
    const feedback = collector.collect({
        taskId: "task_partial",
        signals: [
            {
                signalId: "sig_1",
                source: "execution",
                taskId: "task_partial",
                category: "partial",
                severity: "warning",
                payload: { summary: "partial success" },
                stepOutputRefs: [],
                timestamp: 1,
            },
        ],
    });
    assert.equal(feedback.outcome, "partial");
});
test("FeedbackCollector outcome is completed for success signals only", () => {
    const collector = new FeedbackCollector();
    const feedback = collector.collect({
        taskId: "task_success",
        signals: [
            {
                signalId: "sig_1",
                source: "validation",
                taskId: "task_success",
                category: "success",
                severity: "info",
                payload: {},
                stepOutputRefs: [],
                timestamp: 1,
            },
        ],
    });
    assert.equal(feedback.outcome, "completed");
});
test("FeedbackCollector outcome is failed when timeout signal present", () => {
    const collector = new FeedbackCollector();
    const feedback = collector.collect({
        taskId: "task_timeout",
        signals: [
            {
                signalId: "sig_1",
                source: "execution",
                taskId: "task_timeout",
                category: "timeout",
                severity: "error",
                payload: {},
                stepOutputRefs: [],
                timestamp: 1,
            },
        ],
    });
    assert.equal(feedback.outcome, "failed");
});
test("FeedbackCollector preserves executionId and planId", () => {
    const collector = new FeedbackCollector();
    const feedback = collector.collect({
        taskId: "task_ids",
        executionId: "exec_123",
        planId: "plan_456",
        signals: [
            {
                signalId: "sig_1",
                source: "execution",
                taskId: "task_ids",
                category: "success",
                severity: "info",
                payload: {},
                stepOutputRefs: [],
                timestamp: 1,
            },
        ],
    });
    assert.equal(feedback.executionId, "exec_123");
    assert.equal(feedback.planId, "plan_456");
});
test("FeedbackCollector handles null executionId and planId", () => {
    const collector = new FeedbackCollector();
    const feedback = collector.collect({
        taskId: "task_null_ids",
        executionId: null,
        planId: null,
        signals: [
            {
                signalId: "sig_1",
                source: "execution",
                taskId: "task_null_ids",
                category: "success",
                severity: "info",
                payload: {},
                stepOutputRefs: [],
                timestamp: 1,
            },
        ],
    });
    assert.equal(feedback.executionId, null);
    assert.equal(feedback.planId, null);
});
//# sourceMappingURL=feedback-collector.test.js.map