import assert from "node:assert/strict";
import test from "node:test";
import { summarizeTaskMetrics } from "../../../../src/interaction/dashboard/metric-aggregator/index.js";
test("summarizeTaskMetrics counts all statuses correctly", () => {
    const statuses = ["done", "in_progress", "failed", "done", "in_progress", "done", "failed"];
    const summary = summarizeTaskMetrics(statuses);
    assert.equal(summary.total, 7);
    assert.equal(summary.done, 3);
    assert.equal(summary.inProgress, 2);
    assert.equal(summary.failed, 2);
});
test("summarizeTaskMetrics handles empty array", () => {
    const summary = summarizeTaskMetrics([]);
    assert.equal(summary.total, 0);
    assert.equal(summary.done, 0);
    assert.equal(summary.inProgress, 0);
    assert.equal(summary.failed, 0);
});
test("summarizeTaskMetrics handles all done tasks", () => {
    const statuses = ["done", "done", "done"];
    const summary = summarizeTaskMetrics(statuses);
    assert.equal(summary.total, 3);
    assert.equal(summary.done, 3);
    assert.equal(summary.inProgress, 0);
    assert.equal(summary.failed, 0);
});
test("summarizeTaskMetrics handles all in_progress tasks", () => {
    const statuses = ["in_progress", "in_progress"];
    const summary = summarizeTaskMetrics(statuses);
    assert.equal(summary.total, 2);
    assert.equal(summary.done, 0);
    assert.equal(summary.inProgress, 2);
    assert.equal(summary.failed, 0);
});
test("summarizeTaskMetrics handles all failed tasks", () => {
    const statuses = ["failed", "failed", "failed", "failed"];
    const summary = summarizeTaskMetrics(statuses);
    assert.equal(summary.total, 4);
    assert.equal(summary.done, 0);
    assert.equal(summary.inProgress, 0);
    assert.equal(summary.failed, 4);
});
test("summarizeTaskMetrics ignores unknown statuses", () => {
    const statuses = ["done", "unknown_status", "in_progress", "another_unknown"];
    const summary = summarizeTaskMetrics(statuses);
    assert.equal(summary.total, 4);
    assert.equal(summary.done, 1);
    assert.equal(summary.inProgress, 1);
    assert.equal(summary.failed, 0);
});
//# sourceMappingURL=metric-aggregator.test.js.map