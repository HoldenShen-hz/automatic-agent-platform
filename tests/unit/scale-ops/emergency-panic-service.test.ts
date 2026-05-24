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
    reasonCode: "security.incident",
    issuedBy: "operator-001",
    severity: "full",
    triggerSignals: ["anomaly_detected"],
    requiredApprovers: ["security-lead", "platform-lead"],
  };

  const activation = service.activate(request);

  assert.ok(activation.directive.directiveId.startsWith("panic_"));
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
    reasonCode: "security.approval_gap",
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
    reasonCode: "outage.detected",
    activeIncidents: 1,
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
    reasonCode: "security.breach",
    issuedBy: "op1",
    requiredApprovers: ["a1", "a2"],
  });
  service.activate({
    scope: "tenant/acme",
    reasonCode: "cost.anomaly",
    activeIncidents: 1,
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
    reasonCode: "security.breach",
    issuedBy: "op1",
    requiredApprovers: ["a1", "a2"],
  });
  const plan = {
    planId: "resume-plan-1",
    scope: "platform",
    scopeRef: "platform",
    approvedBy: ["admin1", "admin2"],
    approvalCount: 2,
    approvedRoles: ["platform_admin", "platform_admin"] as const,
    compatibilityCheckRef: "compatibility-check-1",
    mode: "standard" as const,
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
    createdAt: new Date().toISOString(),
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
    reasonCode: "security.breach",
    issuedBy: "op1",
    requiredApprovers: ["a1", "a2"],
  });
  const plan = {
    planId: "resume-plan-2",
    scope: "platform",
    scopeRef: "platform",
    approvedBy: ["admin1"],
    approvalCount: 1,
    approvedRoles: ["platform_admin"] as const,
    compatibilityCheckRef: "compatibility-check-2",
    mode: "standard" as const,
    checkpointsVerified: false,
    forensicSnapshotReviewed: false,
    rollbackPlanReady: false,
    validationRunPassed: false,
    createdAt: new Date().toISOString(),
  };

  const receipt = service.resume("platform", plan);

  assert.equal(receipt.resumed, false);
  assert.equal(receipt.resumedAt, null);
});

test("PlatformPanicService getResumeReceipt returns receipt", async () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    reasonCode: "security.breach",
    issuedBy: "op1",
    requiredApprovers: ["a1", "a2"],
  });
  const plan = {
    planId: "resume-plan-3",
    scope: "platform",
    scopeRef: "platform",
    approvedBy: ["admin1", "admin2"],
    approvalCount: 2,
    approvedRoles: ["platform_admin", "platform_admin"] as const,
    compatibilityCheckRef: "compatibility-check-3",
    mode: "standard" as const,
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
    createdAt: new Date().toISOString(),
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
    reasonCode: "drift.detected",
    activeIncidents: 1,
    issuedBy: "op1",
    requiredApprovers: ["a1", "a2"],
  };

  const activation = service.activate(request);

  assert.equal(activation.directive.scopeLevel, "domain");
});
