import assert from "node:assert/strict";
import test from "node:test";
import { createStateCommand, } from "../../../../../src/platform/contracts/state-command/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
test("StateCommandAction accepts canonical state mutation actions", () => {
    const actions = ["upsert", "transition", "append_event", "delete"];
    assert.equal(actions.length, 4);
});
test("createStateCommand builds transition commands with next status payload", () => {
    const command = createStateCommand({
        entityKind: "approval",
        entityId: "approval-1",
        action: "transition",
        expectedVersion: 3,
        payload: { nextStatus: "approved" },
        emittedBy: "policy-center",
    });
    assert.equal(command.action, "transition");
    assert.equal(command.expectedVersion, 3);
    assert.equal(command.payload.nextStatus, "approved");
});
test("createStateCommand generates a commandId when not provided", () => {
    const command = createStateCommand({
        entityKind: "task",
        entityId: "task-1",
        action: "upsert",
        expectedVersion: 1,
        payload: {},
        emittedBy: "execution-engine",
    });
    assert.ok(command.commandId.startsWith("statecmd_"));
});
test("createStateCommand uses provided commandId", () => {
    const command = createStateCommand({
        commandId: "custom-command-id",
        entityKind: "task",
        entityId: "task-1",
        action: "upsert",
        expectedVersion: 1,
        payload: {},
        emittedBy: "execution-engine",
    });
    assert.equal(command.commandId, "custom-command-id");
});
test("createStateCommand sets createdAt to nowIso when not provided", () => {
    const command = createStateCommand({
        entityKind: "task",
        entityId: "task-1",
        action: "upsert",
        expectedVersion: 1,
        payload: {},
        emittedBy: "execution-engine",
    });
    assert.ok(command.createdAt.includes("T"));
});
test("createStateCommand uses provided createdAt timestamp", () => {
    const command = createStateCommand({
        entityKind: "task",
        entityId: "task-1",
        action: "upsert",
        expectedVersion: 1,
        payload: {},
        emittedBy: "execution-engine",
        createdAt: "2026-01-01T00:00:00.000Z",
    });
    assert.equal(command.createdAt, "2026-01-01T00:00:00.000Z");
});
test("createStateCommand throws when entityKind is empty", () => {
    assert.throws(() => createStateCommand({
        entityKind: "",
        entityId: "task-1",
        action: "upsert",
        expectedVersion: 1,
        payload: {},
        emittedBy: "execution-engine",
    }), ValidationError);
});
test("createStateCommand throws when entityId is empty", () => {
    assert.throws(() => createStateCommand({
        entityKind: "task",
        entityId: "",
        action: "upsert",
        expectedVersion: 1,
        payload: {},
        emittedBy: "execution-engine",
    }), ValidationError);
});
test("createStateCommand throws when emittedBy is empty", () => {
    assert.throws(() => createStateCommand({
        entityKind: "task",
        entityId: "task-1",
        action: "upsert",
        expectedVersion: 1,
        payload: {},
        emittedBy: "",
    }), ValidationError);
});
test("createStateCommand throws when action is transition but nextStatus is missing", () => {
    assert.throws(() => createStateCommand({
        entityKind: "task",
        entityId: "task-1",
        action: "transition",
        expectedVersion: 1,
        payload: {},
        emittedBy: "execution-engine",
    }), ValidationError);
});
test("createStateCommand accepts append_event action without nextStatus", () => {
    const command = createStateCommand({
        entityKind: "task",
        entityId: "task-1",
        action: "append_event",
        expectedVersion: 2,
        payload: { event: "TaskStarted" },
        emittedBy: "execution-engine",
    });
    assert.equal(command.action, "append_event");
});
test("createStateCommand accepts delete action", () => {
    const command = createStateCommand({
        entityKind: "task",
        entityId: "task-1",
        action: "delete",
        expectedVersion: 5,
        payload: {},
        emittedBy: "orchestration",
    });
    assert.equal(command.action, "delete");
});
test("createStateCommand normalizes expectedVersion to null when undefined", () => {
    const command = createStateCommand({
        entityKind: "task",
        entityId: "task-1",
        action: "upsert",
        expectedVersion: undefined,
        payload: {},
        emittedBy: "execution-engine",
    });
    assert.equal(command.expectedVersion, null);
});
test("createStateCommand copies payload to avoid mutation", () => {
    const originalPayload = { key: "value" };
    const command = createStateCommand({
        entityKind: "task",
        entityId: "task-1",
        action: "upsert",
        expectedVersion: 1,
        payload: originalPayload,
        emittedBy: "execution-engine",
    });
    // Verify it's a copy, not a reference
    assert.notEqual(command.payload, originalPayload);
    assert.deepEqual(command.payload, originalPayload);
});
test("StateCommand interface accepts all fields", () => {
    const command = {
        commandId: "cmd-123",
        entityKind: "workflow",
        entityId: "wf-456",
        action: "transition",
        expectedVersion: 10,
        payload: { nextStatus: "completed" },
        emittedBy: "planner",
        createdAt: "2026-01-01T00:00:00.000Z",
    };
    assert.equal(command.commandId, "cmd-123");
    assert.equal(command.entityKind, "workflow");
    assert.equal(command.action, "transition");
    assert.equal(command.expectedVersion, 10);
});
//# sourceMappingURL=index.test.js.map