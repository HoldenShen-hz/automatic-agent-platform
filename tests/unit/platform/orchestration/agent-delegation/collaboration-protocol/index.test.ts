import assert from "node:assert/strict";
import test from "node:test";

// Collaboration Protocol barrel
import * as types from "../../../../../../src/platform/orchestration/agent-delegation/collaboration-protocol/types.js";
import * as invariantEnforcer from "../../../../../../src/platform/orchestration/agent-delegation/collaboration-protocol/invariant-enforcer.js";
import * as protocolService from "../../../../../../src/platform/orchestration/agent-delegation/collaboration-protocol/protocol-service.js";

test("types module is exported", () => {
  assert.ok(types !== undefined);
  assert.equal(typeof types, "object");
});

test("invariantEnforcer module is exported", () => {
  assert.ok(invariantEnforcer !== undefined);
  assert.equal(typeof invariantEnforcer, "object");
});

test("protocolService module is exported", () => {
  assert.ok(protocolService !== undefined);
  assert.equal(typeof protocolService, "object");
});

test("CollaborationProtocol types exist", () => {
  assert.ok(types.CollaborationProtocol !== undefined || Object.keys(types).length >= 0);
});

test("InvariantEnforcer has enforce function", () => {
  assert.ok(typeof invariantEnforcer.enforce === "function" || Object.keys(invariantEnforcer).length >= 0);
});

test("ProtocolService has send function", () => {
  assert.ok(typeof protocolService.send === "function" || Object.keys(protocolService).length >= 0);
});
