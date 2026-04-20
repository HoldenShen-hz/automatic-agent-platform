import assert from "node:assert/strict";
import test from "node:test";

import { createStateCommand, type StateCommandAction } from "../../../../../src/platform/contracts/state-command/index.js";

test("StateCommandAction accepts canonical state mutation actions", () => {
  const actions: StateCommandAction[] = ["upsert", "transition", "append_event", "delete"];
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
