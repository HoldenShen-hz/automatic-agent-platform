import assert from "node:assert/strict";
import test from "node:test";

import {
  PlatformPanicService,
  type PanicActivationRequest,
} from "../../../src/ops-maturity/emergency/platform-panic-service.js";

test("PlatformPanicService activate creates panic directive", async () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "platform",
    scopeLevel: "platform",
    reasonCode: "security.incident",
    issuedBy: "operator-001",
    severity: "full",
    triggerSignals: ["anomaly_detected"],
  };

  const activation = service.activate(request);

  assert.ok(activation.directive.directiveId.startsWith("panic:"));
  assert.equal(activation.directive.scope, "platform");
  assert.equal(activation.directive.reasonCode, "security.incident");
  assert.ok(activation.directive.freezeModes.length > 0);
  assert.ok(activation.acknowledgments.length >= 5);
  assert.ok(activation.forensicSnapshot != null);
});

test("PlatformPanicService activate requires minimum approvers", async () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "platform",
    scopeLevel: "platform",
    reasonCode: "deployment.cascade_failure",
    issuedBy: "single-operator",
    requiredApprovers: ["only-one"],
  };

  assert.throws(
    () => service.activate(request),
    (err: Error) => err.message.includes("required_approvers_minimum_not_met")
  );
});

test("PlatformPanicService getActive returns activation for scope", async () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "region/us-east",
    scopeLevel: "region",
    reasonCode: "outage.detected",
    issuedBy: "ops-team",
    requiredApprovers: ["lead1", "lead2"],
  };

  service.activate(request);
  const activation = service.getActive("region/us-east");

  assert.ok(activation != null);
  assert.equal(activation!.directive.scope, "region/us-east");
});

test("PlatformPanicService getActive returns null for unknown scope", async () => {
  const service = new PlatformPanicService();

  const activation = service.getActive("unknown/scope");

  assert.equal(activation, null);
});

test("PlatformPanicService listActive returns all active activations", async () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    scopeLevel: "platform",
    reasonCode: "security.breach",
    issuedBy: "op1",
    requiredApprovers: ["a1", "a2"],
  });
  service.activate({
    scope: "tenant/acme",
    scopeLevel: "tenant",
    reasonCode: "cost.anomaly",
    issuedBy: "op2",
    requiredApprovers: ["b1", "b2"],
  });

  const active = service.listActive();

  assert.equal(active.length, 2);
});

test("PlatformPanicService evaluateExecution blocks when panic active", async () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    scopeLevel: "platform",
    reasonCode: "security.breach",
    issuedBy: "op1",
    requiredApprovers: ["a1", "a2"],
  });

  const decision = service.evaluateExecution({
    scope: "platform",
    mode: "deploy",
  });

  assert.equal(decision.blocked, true);
  assert.ok(decision.directiveId != null);
  assert.ok(decision.reasonCodes.length > 0);
});

test("PlatformPanicService evaluateExecution does not block unrelated mode", async () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    scopeLevel: "platform",
    reasonCode: "security.breach",
    issuedBy: "op1",
    requiredApprovers: ["a1", "a2"],
    freezeModes: ["deploy"],
  });

  const decision = service.evaluateExecution({
    scope: "platform",
    mode: "approval",
  });

  assert.equal(decision.blocked, false);
});

test("PlatformPanicService evaluateExecution allows actors on allowList", async () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    scopeLevel: "platform",
    reasonCode: "security.breach",
    issuedBy: "op1",
    requiredApprovers: ["a1", "a2"],
    allowList: ["whitelisted-actor"],
  });

  const decision = service.evaluateExecution({
    scope: "platform",
    mode: "deploy",
    actorId: "whitelisted-actor",
  });

  assert.equal(decision.blocked, false);
  assert.ok(decision.reasonCodes.includes("panic.allow_list_bypass"));
});

test("PlatformPanicService evaluateExecution does not block when no panic active", async () => {
  const service = new PlatformPanicService();

  const decision = service.evaluateExecution({
    scope: "platform",
    mode: "deploy",
  });

  assert.equal(decision.blocked, false);
  assert.equal(decision.directiveId, null);
});

test("PlatformPanicService resume clears panic and returns receipt", async () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    scopeLevel: "platform",
    reasonCode: "security.breach",
    issuedBy: "op1",
    requiredApprovers: ["a1", "a2"],
  });
  const plan = {
    checkpointIds: ["cp1", "cp2", "cp3"],
    verifiedSignatures: 2,
    completedAt: new Date().toISOString(),
  };

  const receipt = service.resume("platform", plan);

  assert.equal(receipt.resumed, true);
  assert.ok(receipt.resumedAt != null);
  assert.ok(receipt.directiveId != null);
  assert.ok(service.getActive("platform") === null);
});

test("PlatformPanicService resume fails when checkpoints incomplete", async () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    scopeLevel: "platform",
    reasonCode: "security.breach",
    issuedBy: "op1",
    requiredApprovers: ["a1", "a2"],
  });
  const plan = {
    checkpointIds: ["cp1"],
    verifiedSignatures: 0,
    completedAt: new Date().toISOString(),
  };

  const receipt = service.resume("platform", plan);

  assert.equal(receipt.resumed, false);
  assert.equal(receipt.resumedAt, null);
});

test("PlatformPanicService getResumeReceipt returns receipt", async () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    scopeLevel: "platform",
    reasonCode: "security.breach",
    issuedBy: "op1",
    requiredApprovers: ["a1", "a2"],
  });
  const plan = {
    checkpointIds: ["cp1", "cp2", "cp3"],
    verifiedSignatures: 2,
    completedAt: new Date().toISOString(),
  };
  service.resume("platform", plan);

  const receipt = service.getResumeReceipt("platform");

  assert.ok(receipt != null);
  assert.equal(receipt.resumed, true);
});

test("PlatformPanicService activate derives scope level from scope string", async () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "domain/coding",
    scopeLevel: "domain",
    reasonCode: "drift.detected",
    issuedBy: "op1",
    requiredApprovers: ["a1", "a2"],
  };

  const activation = service.activate(request);

  assert.equal(activation.directive.scopeLevel, "domain");
});
