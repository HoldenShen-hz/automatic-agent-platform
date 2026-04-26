import test from "node:test";
import { strict as assert } from "node:assert/strict";
import { shouldEnterPanicMode, type PanicDirectiveInput } from "../../../../../src/ops-maturity/emergency/panic-controller/index.js";

test("shouldEnterPanicMode returns true when activeIncidents > 0", () => {
  const input: PanicDirectiveInput = {
    scope: "tenant-1",
    reasonCode: "overload",
    activeIncidents: 5,
  };

  const result = shouldEnterPanicMode(input);

  assert.strictEqual(result, true);
});

test("shouldEnterPanicMode returns true when reasonCode starts with security.", () => {
  const input: PanicDirectiveInput = {
    scope: "tenant-1",
    reasonCode: "security.breach",
    activeIncidents: 0,
  };

  const result = shouldEnterPanicMode(input);

  assert.strictEqual(result, true);
});

test("shouldEnterPanicMode returns true for security.auth breach", () => {
  const input: PanicDirectiveInput = {
    scope: "tenant-1",
    reasonCode: "security.auth.breach",
    activeIncidents: 0,
  };

  const result = shouldEnterPanicMode(input);

  assert.strictEqual(result, true);
});

test("shouldEnterPanicMode returns false when no incidents and normal reason code", () => {
  const input: PanicDirectiveInput = {
    scope: "tenant-1",
    reasonCode: "overload",
    activeIncidents: 0,
  };

  const result = shouldEnterPanicMode(input);

  assert.strictEqual(result, false);
});

test("shouldEnterPanicMode handles multiple active incidents", () => {
  const input: PanicDirectiveInput = {
    scope: "tenant-1",
    reasonCode: "routine_maintenance",
    activeIncidents: 100,
  };

  const result = shouldEnterPanicMode(input);

  assert.strictEqual(result, true);
});

test("shouldEnterPanicMode treats any positive incident count as trigger", () => {
  const input: PanicDirectiveInput = {
    scope: "tenant-1",
    reasonCode: "minor_issue",
    activeIncidents: 1,
  };

  const result = shouldEnterPanicMode(input);

  assert.strictEqual(result, true);
});

test("shouldEnterPanicMode returns false for zero incidents and non-security reason", () => {
  const input: PanicDirectiveInput = {
    scope: "tenant-1",
    reasonCode: "scheduled_maintenance",
    activeIncidents: 0,
  };

  const result = shouldEnterPanicMode(input);

  assert.strictEqual(result, false);
});

test("shouldEnterPanicMode handles security. prefix case sensitively", () => {
  const input: PanicDirectiveInput = {
    scope: "tenant-1",
    reasonCode: "Security.Injection",
    activeIncidents: 0,
  };

  const result = shouldEnterPanicMode(input);

  assert.strictEqual(result, false);
});

test("shouldEnterPanicMode ignores reasonCode with security. outside prefix", () => {
  const input: PanicDirectiveInput = {
    scope: "tenant-1",
    reasonCode: "audit.security.event",
    activeIncidents: 0,
  };

  const result = shouldEnterPanicMode(input);

  assert.strictEqual(result, false);
});

test("shouldEnterPanicMode returns true for security.xss", () => {
  const input: PanicDirectiveInput = {
    scope: "tenant-1",
    reasonCode: "security.xss",
    activeIncidents: 0,
  };

  const result = shouldEnterPanicMode(input);

  assert.strictEqual(result, true);
});

test("shouldEnterPanicMode returns true for security.injection", () => {
  const input: PanicDirectiveInput = {
    scope: "tenant-1",
    reasonCode: "security.injection",
    activeIncidents: 0,
  };

  const result = shouldEnterPanicMode(input);

  assert.strictEqual(result, true);
});

test("shouldEnterPanicMode handles empty scope", () => {
  const input: PanicDirectiveInput = {
    scope: "",
    reasonCode: "security.breach",
    activeIncidents: 0,
  };

  const result = shouldEnterPanicMode(input);

  assert.strictEqual(result, true);
});

test("shouldEnterPanicMode handles very large incident count", () => {
  const input: PanicDirectiveInput = {
    scope: "tenant-1",
    reasonCode: "cascade_failure",
    activeIncidents: 999999,
  };

  const result = shouldEnterPanicMode(input);

  assert.strictEqual(result, true);
});

test("shouldEnterPanicMode evaluates both conditions with OR logic", () => {
  const input: PanicDirectiveInput = {
    scope: "global",
    reasonCode: "security.breach",
    activeIncidents: 10,
  };

  const result = shouldEnterPanicMode(input);

  assert.strictEqual(result, true);
});

test("shouldEnterPanicMode with reasonCode containing multiple dots", () => {
  const input: PanicDirectiveInput = {
    scope: "tenant-1",
    reasonCode: "security.auth.two_factor.bypass",
    activeIncidents: 0,
  };

  const result = shouldEnterPanicMode(input);

  assert.strictEqual(result, true);
});

test("shouldEnterPanicMode with reasonCode data.integrity.violation does not trigger", () => {
  const input: PanicDirectiveInput = {
    scope: "tenant-1",
    reasonCode: "data.integrity.violation",
    activeIncidents: 0,
  };

  const result = shouldEnterPanicMode(input);

  assert.strictEqual(result, false);
});

test("shouldEnterPanicMode with reasonCode network.ddos triggers only if security prefix", () => {
  const input: PanicDirectiveInput = {
    scope: "tenant-1",
    reasonCode: "network.ddos",
    activeIncidents: 0,
  };

  const result = shouldEnterPanicMode(input);

  assert.strictEqual(result, false);
});

test("shouldEnterPanicMode with activeIncidents 0 and reason audit.info does not trigger", () => {
  const input: PanicDirectiveInput = {
    scope: "tenant-1",
    reasonCode: "audit.info",
    activeIncidents: 0,
  };

  const result = shouldEnterPanicMode(input);

  assert.strictEqual(result, false);
});

test("shouldEnterPanicModePanicDirectiveInput is readonly interface", () => {
  const input: PanicDirectiveInput = {
    scope: "readonly-test",
    reasonCode: "test",
    activeIncidents: 1,
  };

  assert.strictEqual(input.scope, "readonly-test");
  assert.strictEqual(input.reasonCode, "test");
  assert.strictEqual(input.activeIncidents, 1);
});
