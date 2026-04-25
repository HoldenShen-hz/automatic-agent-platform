import assert from "node:assert/strict";
import test from "node:test";

import {
  shouldEnterPanicMode,
  type PanicDirectiveInput,
} from "../../../../../src/ops-maturity/emergency/panic-controller/index.js";

test("shouldEnterPanicMode returns true when activeIncidents > 0", () => {
  const input: PanicDirectiveInput = {
    scope: "platform",
    reasonCode: "capacity.issue",
    activeIncidents: 1,
  };

  assert.equal(shouldEnterPanicMode(input), true);
});

test("shouldEnterPanicMode returns true when reasonCode starts with security.", () => {
  const input: PanicDirectiveInput = {
    scope: "platform",
    reasonCode: "security.incident.detected",
    activeIncidents: 0,
  };

  assert.equal(shouldEnterPanicMode(input), true);
});

test("shouldEnterPanicMode returns false when no incidents and non-security reason", () => {
  const input: PanicDirectiveInput = {
    scope: "platform",
    reasonCode: "capacity.issue",
    activeIncidents: 0,
  };

  assert.equal(shouldEnterPanicMode(input), false);
});

test("shouldEnterPanicMode returns true with multiple incidents", () => {
  const input: PanicDirectiveInput = {
    scope: "platform",
    reasonCode: "capacity.issue",
    activeIncidents: 5,
  };

  assert.equal(shouldEnterPanicMode(input), true);
});

test("shouldEnterPanicMode returns true for security prefix with zero incidents", () => {
  const input: PanicDirectiveInput = {
    scope: "division-a",
    reasonCode: "security.threat",
    activeIncidents: 0,
  };

  assert.equal(shouldEnterPanicMode(input), true);
});

test("shouldEnterPanicMode returns false for non-security reason code", () => {
  const input: PanicDirectiveInput = {
    scope: "platform",
    reasonCode: "performance.degradation",
    activeIncidents: 0,
  };

  assert.equal(shouldEnterPanicMode(input), false);
});

test("shouldEnterPanicMode returns true for security. prefix", () => {
  const input: PanicDirectiveInput = {
    scope: "platform",
    reasonCode: "security.",
    activeIncidents: 0,
  };

  assert.equal(shouldEnterPanicMode(input), true);
});

test("shouldEnterPanicMode handles scope correctly", () => {
  const input: PanicDirectiveInput = {
    scope: "any-scope-value",
    reasonCode: "security.alert",
    activeIncidents: 0,
  };

  assert.equal(shouldEnterPanicMode(input), true);
});

test("shouldEnterPanicMode handles zero incidents exactly", () => {
  const input: PanicDirectiveInput = {
    scope: "platform",
    reasonCode: "info.test",
    activeIncidents: 0,
  };

  assert.equal(shouldEnterPanicMode(input), false);
});

test("shouldEnterPanicMode returns false for negative incidents", () => {
  const input: PanicDirectiveInput = {
    scope: "platform",
    reasonCode: "test",
    activeIncidents: -1,
  };

  assert.equal(shouldEnterPanicMode(input), false);
});

test("PanicDirectiveInput scope is readonly string", () => {
  const input: PanicDirectiveInput = {
    scope: "test-scope",
    reasonCode: "test",
    activeIncidents: 0,
  };

  assert.equal(typeof input.scope, "string");
});

test("PanicDirectiveInput reasonCode is readonly string", () => {
  const input: PanicDirectiveInput = {
    scope: "platform",
    reasonCode: "capacity.issue",
    activeIncidents: 1,
  };

  assert.equal(typeof input.reasonCode, "string");
});

test("PanicDirectiveInput activeIncidents is readonly number", () => {
  const input: PanicDirectiveInput = {
    scope: "platform",
    reasonCode: "test",
    activeIncidents: 10,
  };

  assert.equal(typeof input.activeIncidents, "number");
});

test("shouldEnterPanicMode returns false for security prefix without dot", () => {
  const input: PanicDirectiveInput = {
    scope: "platform",
    reasonCode: "security",
    activeIncidents: 0,
  };

  assert.equal(shouldEnterPanicMode(input), false);
});

test("shouldEnterPanicMode false for empty reasonCode with 0 incidents", () => {
  const input: PanicDirectiveInput = {
    scope: "platform",
    reasonCode: "",
    activeIncidents: 0,
  };

  assert.equal(shouldEnterPanicMode(input), false);
});

test("shouldEnterPanicMode true for security. with incidents", () => {
  const input: PanicDirectiveInput = {
    scope: "platform",
    reasonCode: "security.breach",
    activeIncidents: 3,
  };

  assert.equal(shouldEnterPanicMode(input), true);
});

test("shouldEnterPanicMode prioritizes security over incidents count", () => {
  const input: PanicDirectiveInput = {
    scope: "platform",
    reasonCode: "security.critical",
    activeIncidents: 0,
  };

  assert.equal(shouldEnterPanicMode(input), true);
});

test("PanicDirectiveInput can be constructed with all fields", () => {
  const input: PanicDirectiveInput = {
    scope: "division-a/platform",
    reasonCode: "security.incident",
    activeIncidents: 2,
  };

  assert.equal(input.scope, "division-a/platform");
  assert.equal(input.reasonCode, "security.incident");
  assert.equal(input.activeIncidents, 2);
});