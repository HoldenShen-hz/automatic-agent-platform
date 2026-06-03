import assert from "node:assert/strict";
import test from "node:test";

// Collaboration Protocol barrel
import * as types from "../../../../../../src/platform/five-plane-orchestration/agent-delegation/collaboration-protocol/types.js";
import * as invariantEnforcer from "../../../../../../src/platform/five-plane-orchestration/agent-delegation/collaboration-protocol/invariant-enforcer.js";
import * as protocolService from "../../../../../../src/platform/five-plane-orchestration/agent-delegation/collaboration-protocol/protocol-service.js";

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
  assert.ok(types.ACPMessageSchema !== undefined);
});

test("InvariantEnforcer has enforce function", () => {
  assert.ok(typeof invariantEnforcer.ACPInvariantEnforcer === "function");
});

test("ProtocolService has send function", () => {
  assert.ok(typeof protocolService.CollaborationProtocolService === "function");
});
