import assert from "node:assert/strict";
import test from "node:test";
import {
  PlatformPanicService,
  type PanicActivationRequest,
} from "../../../src/ops-maturity/emergency/platform-panic-service.js";

test("PlatformPanicService activate creates panic activation with security reason", () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "platform",
    reasonCode: "security.incident_detected",
    issuedBy: "admin_1",
    severity: "full",
    activeIncidents: 0,
    requiredApprovers: ["admin_1", "admin_2"],
  };

  const activation = service.activate(request);

  assert.strictEqual(activation.directive.scope, "platform");
  assert.strictEqual(activation.directive.scopeLevel, "platform");
  assert.strictEqual(activation.directive.reasonCode, "security.incident_detected");
  assert.ok(activation.acknowledgments.length === 5); // All 5 planes
});

test("PlatformPanicService activate creates panic activation with incidents", () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "domain",
    reasonCode: "platform.drift_detected",
    issuedBy: "operator_1",
    activeIncidents: 3,
    requiredApprovers: ["op_1", "op_2"],
  };

  const activation = service.activate(request);

  assert.strictEqual(activation.directive.scope, "domain");
  assert.strictEqual(activation.directive.scopeLevel, "domain");
});

test("PlatformPanicService getActive returns activation by scope", () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "region",
    reasonCode: "security.breach",
    issuedBy: "operator_1",
    activeIncidents: 0,
    requiredApprovers: ["op_1", "op_2"],
  };

  service.activate(request);
  const activation = service.getActive("region");

  assert.strictEqual(activation?.directive.scope, "region");
});

test("PlatformPanicService getActive returns null for unknown scope", () => {
  const service = new PlatformPanicService();
  const result = service.getActive("never_activated");
  assert.strictEqual(result, null);
});

test("PlatformPanicService listActive returns all active activations", () => {
  const service = new PlatformPanicService();
  service.activate({ scope: "node", reasonCode: "security.incident", issuedBy: "admin", activeIncidents: 0, requiredApprovers: ["a1", "a2"] });
  service.activate({ scope: "run", reasonCode: "security.issue", issuedBy: "admin", activeIncidents: 0, requiredApprovers: ["a1", "a2"] });

  const active = service.listActive();
  assert.strictEqual(active.length, 2);
});

test("PlatformPanicService evaluateExecution blocks frozen mode", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    reasonCode: "security.incident",
    issuedBy: "admin",
    activeIncidents: 0,
    freezeModes: ["deploy", "automation"],
    requiredApprovers: ["admin", "admin2"],
  });

  const decision = service.evaluateExecution({ scope: "platform", mode: "deploy" });

  assert.strictEqual(decision.blocked, true);
  assert.ok(decision.reasonCodes.includes("panic.execution_blocked"));
});

test("PlatformPanicService evaluateExecution allows non-frozen mode", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    reasonCode: "security.incident",
    issuedBy: "admin",
    activeIncidents: 0,
    freezeModes: ["deploy"],
    requiredApprovers: ["admin", "admin2"],
  });

  const decision = service.evaluateExecution({ scope: "platform", mode: "write" });

  assert.strictEqual(decision.blocked, false);
  assert.ok(decision.reasonCodes.includes("panic.mode_not_frozen"));
});

test("PlatformPanicService evaluateExecution allows unknown scope", () => {
  const service = new PlatformPanicService();
  const decision = service.evaluateExecution({ scope: "never_activated", mode: "deploy" });

  assert.strictEqual(decision.blocked, false);
  assert.strictEqual(decision.directiveId, null);
});

test("PlatformPanicService evaluateExecution allows listed actors", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "tenant",
    reasonCode: "security.incident",
    issuedBy: "admin",
    activeIncidents: 0,
    freezeModes: ["deploy"],
    allowList: ["trusted_actor"],
    requiredApprovers: ["admin", "admin2"],
  });

  const decision = service.evaluateExecution({
    scope: "tenant",
    mode: "deploy",
    actorId: "trusted_actor",
  });

  assert.strictEqual(decision.blocked, false);
  assert.ok(decision.reasonCodes.includes("panic.allow_list_bypass"));
});

test("PlatformPanicService evaluateExecution allows when mode not frozen", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "node",
    reasonCode: "security.alert",
    issuedBy: "admin",
    activeIncidents: 0,
    freezeModes: ["deploy", "approval"],
    requiredApprovers: ["admin", "admin2"],
  });

  const decision = service.evaluateExecution({ scope: "node", mode: "automation" });

  assert.strictEqual(decision.blocked, false);
});