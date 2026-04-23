import assert from "node:assert/strict";
import test from "node:test";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
test("newId generates valid ID with prefix", () => {
    const id = newId("task");
    assert.ok(id.startsWith("task_"), `Expected ID to start with "task_", got: ${id}`);
});
test("newId generates unique IDs", () => {
    const ids = new Set();
    for (let i = 0; i < 100; i++) {
        ids.add(newId("exec"));
    }
    assert.equal(ids.size, 100, "All 100 generated IDs should be unique");
});
test("newId generates UUID-formatted suffix", () => {
    const id = newId("test");
    const parts = id.split("_");
    assert.equal(parts.length, 2, "ID should have prefix_uuid format");
    // UUID format: 8-4-4-4-12 hex characters
    assert.match(parts[1], /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});
test("newId accepts any prefix string", () => {
    const prefixes = ["task", "exec", "sess", "evt", "worker", "a", "ALLCAPS"];
    for (const prefix of prefixes) {
        const id = newId(prefix);
        assert.ok(id.startsWith(`${prefix}_`), `ID should start with "${prefix}_", got: ${id}`);
    }
});
test("newId produces different IDs each call", () => {
    const id1 = newId("task");
    const id2 = newId("task");
    assert.notEqual(id1, id2, "Two calls to newId should produce different IDs");
});
test("nowIso returns ISO 8601 formatted timestamp", () => {
    const timestamp = nowIso();
    // ISO 8601 format: 2026-04-12T10:30:00.000Z
    assert.match(timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
});
test("nowIso returns current time (within 1 second tolerance)", () => {
    const timestamp = nowIso();
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = Math.abs(now.getTime() - date.getTime());
    assert.ok(diffMs < 1000, `Timestamp should be within 1 second of current time, diff was ${diffMs}ms`);
});
test("nowIso returns string type", () => {
    const timestamp = nowIso();
    assert.equal(typeof timestamp, "string");
});
test("newId and nowIso can be used together", () => {
    const id = newId("evt");
    const timestamp = nowIso();
    assert.ok(id.includes("_"));
    assert.ok(timestamp.includes("T"));
    assert.ok(timestamp.endsWith("Z"));
});
//# sourceMappingURL=ids.test.js.map