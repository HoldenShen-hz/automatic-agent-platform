import assert from "node:assert/strict";
import test from "node:test";
import { nowIso, newId } from "../../../../../src/platform/contracts/types/ids.js";
test("newId generates valid IDs with various prefixes", () => {
    const prefixes = ["task", "exec", "sess", "evt", "worker", "directive", "plan", "receipt"];
    for (const prefix of prefixes) {
        const id = newId(prefix);
        assert.ok(id.startsWith(`${prefix}_`), `ID should start with "${prefix}_", got: ${id}`);
    }
});
test("newId generates UUID-formatted suffix", () => {
    const id = newId("test");
    const parts = id.split("_");
    assert.equal(parts.length, 2);
    // UUID format validation
    assert.match(parts[1], /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});
test("newId generates unique IDs across many calls", () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i++) {
        ids.add(newId("unique"));
    }
    assert.equal(ids.size, 1000, "All 1000 generated IDs should be unique");
});
test("newId produces different IDs for different prefixes", () => {
    const id1 = newId("prefix1");
    const id2 = newId("prefix2");
    assert.notEqual(id1, id2);
    assert.ok(id1.startsWith("prefix1_"));
    assert.ok(id2.startsWith("prefix2_"));
});
test("nowIso returns ISO 8601 formatted timestamp", () => {
    const timestamp = nowIso();
    assert.match(timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});
test("nowIso returns current time within reasonable tolerance", () => {
    const before = Date.now();
    const timestamp = nowIso();
    const after = Date.now();
    const date = new Date(timestamp);
    assert.ok(date.getTime() >= before && date.getTime() <= after + 1);
});
test("nowIso returns consistent string type", () => {
    const timestamp = nowIso();
    assert.equal(typeof timestamp, "string");
});
test("newId and nowIso work together for event record creation", () => {
    const eventId = newId("evt");
    const timestamp = nowIso();
    assert.ok(eventId.includes("_"));
    assert.ok(timestamp.includes("T"));
    assert.ok(timestamp.endsWith("Z"));
    // Simulate creating an event record
    const eventRecord = {
        id: eventId,
        timestamp,
        data: "test event",
    };
    assert.equal(eventRecord.id, eventId);
    assert.equal(eventRecord.timestamp, timestamp);
});
test("newId with single character prefix", () => {
    const id = newId("a");
    assert.ok(id.startsWith("a_"));
    assert.ok(id.length > 3);
});
test("newId with numeric-like prefix", () => {
    const id = newId("123");
    assert.ok(id.startsWith("123_"));
});
test("nowIso can be used in JSON serialization", () => {
    const timestamp = nowIso();
    const json = JSON.stringify({ createdAt: timestamp });
    const parsed = JSON.parse(json);
    assert.equal(parsed.createdAt, timestamp);
    assert.ok(parsed.createdAt.includes("2026")); // Current year
});
test("newId generates UUIDs that are valid for use as identifiers", () => {
    const ids = [
        newId("task"),
        newId("execution"),
        newId("session"),
    ];
    for (const id of ids) {
        // Check it's a valid format
        const uuidPart = id.split("_")[1];
        assert.ok(uuidPart !== undefined);
        assert.equal(uuidPart.length, 36); // Standard UUID length
    }
});
test("nowIso creates timestamps in UTC", () => {
    const timestamp = nowIso();
    assert.ok(timestamp.endsWith("Z"), "ISO timestamp should end with Z for UTC");
    assert.ok(timestamp.includes("+") === false, "Should not contain timezone offset");
});
test("newId can be used for multiple entity types simultaneously", () => {
    const taskId = newId("task");
    const execId = newId("exec");
    const sessId = newId("sess");
    const evtId = newId("evt");
    // All should be unique
    const allIds = new Set([taskId, execId, sessId, evtId]);
    assert.equal(allIds.size, 4, "All entity IDs should be unique");
    // Each should have correct prefix
    assert.ok(taskId.startsWith("task_"));
    assert.ok(execId.startsWith("exec_"));
    assert.ok(sessId.startsWith("sess_"));
    assert.ok(evtId.startsWith("evt_"));
});
//# sourceMappingURL=ids-utility.test.js.map