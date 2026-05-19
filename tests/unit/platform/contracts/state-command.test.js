/**
 * State Command Contract Unit Tests
 *
 * Tests the state command creation and validation logic.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createStateCommand } from "../../../../src/platform/contracts/state-command/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
test("state-command: createStateCommand generates valid command for upsert action", () => {
    const command = createStateCommand({
        entityKind: "task",
        entityId: "task_123",
        action: "upsert",
        expectedVersion: null,
        payload: { status: "done" },
        emittedBy: "worker_1",
    });
    assert.equal(command.entityKind, "task");
    assert.equal(command.entityId, "task_123");
    assert.equal(command.action, "upsert");
    assert.equal(command.expectedVersion, null);
    assert.deepEqual(command.payload, { status: "done" });
    assert.equal(command.emittedBy, "worker_1");
    assert.ok(command.commandId.startsWith("statecmd_"));
    assert.ok(command.createdAt.length > 0);
});
test("state-command: createStateCommand generates valid command for transition action", () => {
    const command = createStateCommand({
        entityKind: "task",
        entityId: "task_123",
        action: "transition",
        expectedVersion: 5,
        payload: { nextStatus: "completed" },
        emittedBy: "orchestrator",
    });
    assert.equal(command.action, "transition");
    assert.equal(command.expectedVersion, 5);
    assert.deepEqual(command.payload, { nextStatus: "completed" });
});
test("state-command: createStateCommand throws when entityKind is empty", () => {
    assert.throws(() => createStateCommand({
        entityKind: "",
        entityId: "task_123",
        action: "upsert",
        expectedVersion: null,
        payload: {},
        emittedBy: "worker_1",
    }), ValidationError);
});
test("state-command: createStateCommand throws when entityId is empty", () => {
    assert.throws(() => createStateCommand({
        entityKind: "task",
        entityId: "   ",
        action: "upsert",
        expectedVersion: null,
        payload: {},
        emittedBy: "worker_1",
    }), ValidationError);
});
test("state-command: createStateCommand throws when emittedBy is empty", () => {
    assert.throws(() => createStateCommand({
        entityKind: "task",
        entityId: "task_123",
        action: "upsert",
        expectedVersion: null,
        payload: {},
        emittedBy: "",
    }), ValidationError);
});
test("state-command: createStateCommand throws when transition action lacks nextStatus", () => {
    assert.throws(() => createStateCommand({
        entityKind: "task",
        entityId: "task_123",
        action: "transition",
        expectedVersion: null,
        payload: { wrongField: "value" },
        emittedBy: "worker_1",
    }), ValidationError);
});
test("state-command: createStateCommand accepts custom commandId and createdAt", () => {
    const command = createStateCommand({
        entityKind: "task",
        entityId: "task_123",
        action: "append_event",
        expectedVersion: 1,
        payload: { event: "TaskStarted" },
        emittedBy: "system",
        commandId: "custom_cmd",
        createdAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(command.commandId, "custom_cmd");
    assert.equal(command.createdAt, "2026-01-01T00:00:00.000Z");
});
test("state-command: createStateCommand copies payload without mutation", () => {
    const originalPayload = { key: "value" };
    const command = createStateCommand({
        entityKind: "task",
        entityId: "task_123",
        action: "upsert",
        expectedVersion: null,
        payload: originalPayload,
        emittedBy: "worker_1",
    });
    // Modify original after creation
    originalPayload.key = "modified";
    // Command payload should be unchanged
    assert.equal(command.payload.key, "value");
});
//# sourceMappingURL=state-command.test.js.map