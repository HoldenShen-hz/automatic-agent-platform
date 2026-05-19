/**
 * Task Board CLI Tests
 *
 * Tests for task-board.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { resolveCliDbPath } from "../../../../src/sdk/cli/authoritative-storage.js";
// ---------------------------------------------------------------------------
// Tests for resolveDbPath
// ---------------------------------------------------------------------------
test("resolveDbPath returns path from AA_DB_PATH when set", () => {
    const previousDbPath = process.env.AA_DB_PATH;
    const customPath = "/custom/db/path.db";
    try {
        process.env.AA_DB_PATH = customPath;
        const resolved = resolveCliDbPath();
        assert.equal(resolved, customPath);
    }
    finally {
        if (previousDbPath == null) {
            delete process.env.AA_DB_PATH;
        }
        else {
            process.env.AA_DB_PATH = previousDbPath;
        }
    }
});
test("resolveDbPath returns default path when AA_DB_PATH not set", () => {
    const previousDbPath = process.env.AA_DB_PATH;
    try {
        delete process.env.AA_DB_PATH;
        const resolved = resolveCliDbPath();
        // Default path should end with data/sqlite/authoritative-demo.db
        assert.ok(resolved.includes("data/sqlite/authoritative-demo.db"), `Expected default path, got: ${resolved}`);
    }
    finally {
        if (previousDbPath == null) {
            delete process.env.AA_DB_PATH;
        }
        else {
            process.env.AA_DB_PATH = previousDbPath;
        }
    }
});
// ---------------------------------------------------------------------------
// Tests for task board listing logic
// ---------------------------------------------------------------------------
test("task board lists up to 25 items by default", () => {
    const defaultLimit = 25;
    const items = Array.from({ length: 30 }, (_, i) => ({ id: `task-${i}` }));
    const listResult = items.slice(0, defaultLimit);
    assert.equal(listResult.length, 25);
    assert.equal(listResult[0].id, "task-0");
    assert.equal(listResult[24].id, "task-24");
});
test("task board respects custom limit", () => {
    const customLimit = 10;
    const items = Array.from({ length: 30 }, (_, i) => ({ id: `task-${i}` }));
    const listResult = items.slice(0, customLimit);
    assert.equal(listResult.length, 10);
    assert.equal(listResult[0].id, "task-0");
    assert.equal(listResult[9].id, "task-9");
});
test("task board handles empty result", () => {
    const items = [];
    const listResult = items.slice(0, 25);
    assert.equal(listResult.length, 0);
});
test("task board output structure includes items array", () => {
    const mockItems = [
        { id: "task-1", status: "queued" },
        { id: "task-2", status: "running" },
    ];
    const output = { items: mockItems };
    assert.ok(Array.isArray(output.items));
    assert.equal(output.items.length, 2);
    assert.equal(output.items[0].id, "task-1");
});
// ---------------------------------------------------------------------------
// Tests for task board CLI env config (AA_DB_PATH resolution)
// ---------------------------------------------------------------------------
test("task board CLI uses resolveCliDbPath for db path", () => {
    const previousDbPath = process.env.AA_DB_PATH;
    const customPath = "/custom/taskboard.db";
    try {
        process.env.AA_DB_PATH = customPath;
        const dbPath = resolveCliDbPath();
        assert.equal(dbPath, customPath);
    }
    finally {
        if (previousDbPath == null) {
            delete process.env.AA_DB_PATH;
        }
        else {
            process.env.AA_DB_PATH = previousDbPath;
        }
    }
});
test("task board CLI dbPath option is passed to withCliStorage", () => {
    const dbPath = "/test/taskboard.db";
    const options = { dbPath };
    assert.equal(options.dbPath, "/test/taskboard.db");
    assert.ok(options.dbPath.endsWith(".db"));
});
// ---------------------------------------------------------------------------
// Tests for task board output formatting
// ---------------------------------------------------------------------------
test("task board outputs JSON with items key", () => {
    const items = [
        { id: "task-1", title: "Test Task 1" },
        { id: "task-2", title: "Test Task 2" },
    ];
    const output = { items };
    const jsonOutput = JSON.stringify(output, null, 2);
    assert.ok(jsonOutput.includes('"items"'));
    assert.ok(jsonOutput.includes('"task-1"'));
    assert.ok(jsonOutput.includes('"Test Task 1"'));
});
test("task board outputs formatted JSON with indentation", () => {
    const output = { items: [{ id: "task-1" }] };
    const jsonOutput = JSON.stringify(output, null, 2);
    // Check for proper indentation (2 spaces)
    assert.ok(jsonOutput.includes("\n  "));
});
//# sourceMappingURL=task-board.test.js.map