import assert from "node:assert/strict";
import test from "node:test";
import {
  PlatformPanicService,
  type PanicActivationRequest,
} from "../../../src/ops-maturity/emergency/platform-panic-service.js";
import { buildForensicSnapshot } from "../../../src/ops-maturity/emergency/forensic-snapshot/index.js";

test("PlatformPanicService activate creates panic activation", () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "tenant_acme",
    reasonCode: "security.incident_detected",
    issuedBy: "admin_1",
    severity: "full",
  };

  const activation = service.activate(request);

  assert.strictEqual(activation.directive.scope, "tenant_acme");
  assert.strictEqual(activation.directive.scopeLevel, "tenant");
  assert.strictEqual(activation.directive.reasonCode, "security.incident_detected");
  assert.ok(activation.acknowledgments.length === 5); // All 5 planes
});

test("PlatformPanicService getActive returns activation by scope", () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "domain_analytics",
    reasonCode: "platform.drift_detected",
    issuedBy: "operator_1",
  };

  service.activate(request);
  const activation = service.getActive("domain_analytics");

  assert.strictEqual(activation?.directive.scope, "domain_analytics");
});

test("PlatformPanicService getActive returns null for unknown scope", () => {
  const service = new PlatformPanicService();
  const result = service.getActive("never_activated");
  assert.strictEqual(result, null);
});

test("PlatformPanicService listActive returns all active activations", () => {
  const service = new PlatformPanicService();
  service.activate({ scope: "scope_a", reasonCode: "test", issuedBy: "admin" });
  service.activate({ scope: "scope_b", reasonCode: "test", issuedBy: "admin" });

  const active = service.listActive();
  assert.strictEqual(active.length, 2);
});

test("PlatformPanicService evaluateExecution blocks frozen mode", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "region_us",
    reasonCode: "security.incident",
    issuedBy: "admin",
    freezeModes: ["deploy", "automation"],
  });

  const decision = service.evaluateExecution({ scope: "region_us", mode: "deploy" });

  assert.strictEqual(decision.blocked, true);
  assert.ok(decision.reasonCodes.includes("panic.execution_blocked"));
});

test("PlatformPanicService evaluateExecution allows non-frozen mode", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "region_us",
    reasonCode: "security.incident",
    issuedBy: "admin",
    freezeModes: ["deploy"],
  });

  const decision = service.evaluateExecution({ scope: "region_us", mode: "write" });

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
    scope: "tenant_x",
    reasonCode: "security.incident",
    issuedBy: "admin",
    freezeModes: ["deploy"],
    allowList: ["trusted_actor"],
  });

  const decision = service.evaluateExecution({
    scope: "tenant_x",
    mode: "deploy",
    actorId: "trusted_actor",
  });

  assert.strictEqual(decision.blocked, false);
  assert.ok(decision.reasonCodes.includes("panic.allow_list_bypass"));
});