import assert from "node:assert/strict";
import test from "node:test";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
test("newId generates unique IDs with correct prefix", () => {
    const id = newId("task");
    assert.equal(id.startsWith("task_"), true);
    assert.ok(id.length > "task_".length);
});
test("newId generates unique IDs", () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
        ids.add(newId("test"));
    }
    assert.equal(ids.size, 100);
});
test("newId with different prefixes produces different formats", () => {
    const taskId = newId("task");
    const execId = newId("exec");
    const sessId = newId("sess");
    assert.equal(taskId.startsWith("task_"), true);
    assert.equal(execId.startsWith("exec_"), true);
    assert.equal(sessId.startsWith("sess_"), true);
});
test("nowIso returns valid ISO 8601 format", () => {
    const timestamp = nowIso();
    const date = new Date(timestamp);
    assert.equal(!isNaN(date.getTime()), true);
});
test("nowIso returns UTC timestamp", () => {
    const timestamp = nowIso();
    assert.equal(timestamp.endsWith("Z"), true);
});
test("nowIso returns timestamps in chronological order", () => {
    const timestamps = [];
    for (let i = 0; i < 10; i++) {
        timestamps.push(nowIso());
    }
    for (let i = 1; i < timestamps.length; i++) {
        assert.equal(timestamps[i] >= timestamps[i - 1], true);
    }
});
test("newId format matches expected pattern prefix_uuid", () => {
    const id = newId("custom");
    const parts = id.split("_");
    assert.equal(parts.length, 2);
    assert.equal(parts[0], "custom");
    assert.ok(parts[1].length === 36); // UUID length
});
test("newId works with various prefix formats", () => {
    const prefixes = ["task", "exec", "sess", "evt", "div", "agent", "workflow"];
    for (const prefix of prefixes) {
        const id = newId(prefix);
        assert.equal(id.startsWith(`${prefix}_`), true, `Prefix ${prefix} should work`);
    }
});
test("nowIso is parseable by Date constructor", () => {
    const timestamp = nowIso();
    const parsed = Date.parse(timestamp);
    assert.ok(!isNaN(parsed));
});
test("nowIso produces sortable strings", () => {
    const t1 = nowIso();
    // Ensure different timestamps by waiting if needed
    let t2 = nowIso();
    while (t2 === t1) {
        t2 = nowIso();
    }
    let t3 = nowIso();
    while (t3 === t2) {
        t3 = nowIso();
    }
    assert.equal(t1 <= t2, true);
    assert.equal(t2 <= t3, true);
});
//# sourceMappingURL=ids-integration.test.js.map