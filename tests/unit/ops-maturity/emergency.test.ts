import assert from "node:assert/strict";
import test from "node:test";
import { PlatformPanicService, type PanicActivationRequest } from "../../../src/ops-maturity/emergency/platform-panic-service.js";
import { shouldEnterPanicMode } from "../../../src/ops-maturity/emergency/panic-controller/index.js";
import { canResumeFromPanic, type ResumePlan } from "../../../src/ops-maturity/emergency/resume-protocol/index.js";

test("panic: activate directive with valid request", () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "platform/us-west",
    reasonCode: "security.breach",
    activeIncidents: 3,
    issuedBy: "admin-001",
    freezeModes: ["deploy", "approval", "write", "automation"],
    requiredApprovers: ["admin-001", "admin-002"],
  };

  const activation = service.activate(request);

  assert.strictEqual(activation.directive.scope, "platform/us-west");
  assert.strictEqual(activation.directive.scopeLevel, "platform");
  assert.strictEqual(activation.directive.reasonCode, "security.breach");
  assert.strictEqual(activation.directive.issuedBy, "admin-001");
  assert.strictEqual(activation.directive.severity, "full");
  assert.ok(activation.acknowledgments.length === 5);
});

test("panic: activate directive derives default freeze modes for security", () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "region/eu-central",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-002",
    requiredApprovers: ["admin-002", "admin-003"],
  };

  const activation = service.activate(request);

  assert.deepStrictEqual(activation.directive.freezeModes, ["deploy", "approval", "write", "automation"]);
});

test("panic: activate directive derives default freeze modes for non-security", () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "tenant/acme",
    reasonCode: "outage.database",
    activeIncidents: 2,
    issuedBy: "admin-003",
    requiredApprovers: ["admin-003", "admin-004"],
  };

  const activation = service.activate(request);

  assert.deepStrictEqual(activation.directive.freezeModes, ["deploy", "automation"]);
});

test("panic: activate fails when no incidents and non-security reason", () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "platform/test",
    reasonCode: "test.reason",
    activeIncidents: 0,
    issuedBy: "admin-004",
  };

  assert.throws(() => service.activate(request), /panic.directive_rejected/);
});

test("panic: get active returns activation", () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "platform/active-test",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-005",
    requiredApprovers: ["admin-005", "admin-006"],
  };
  service.activate(request);

  const activation = service.getActive("platform/active-test");

  assert.ok(activation != null);
  assert.strictEqual(activation.directive.scope, "platform/active-test");
});

test("panic: get active returns null when not found", () => {
  const service = new PlatformPanicService();

  const activation = service.getActive("platform/nonexistent");

  assert.strictEqual(activation, null);
});

test("panic: list active returns all activations sorted", () => {
  const service = new PlatformPanicService();
  service.activate({ scope: "platform/b", reasonCode: "security.breach", activeIncidents: 1, issuedBy: "a", requiredApprovers: ["a", "b"] });
  service.activate({ scope: "platform/a", reasonCode: "security.breach", activeIncidents: 1, issuedBy: "a", requiredApprovers: ["a", "b"] });

  const list = service.listActive();

  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].directive.scope, "platform/a");
  assert.strictEqual(list[1].directive.scope, "platform/b");
});

test("panic: evaluate execution blocked when mode is frozen", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform/blocked",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-006",
    freezeModes: ["deploy"],
    requiredApprovers: ["admin-006", "admin-007"],
  });

  const decision = service.evaluateExecution({ scope: "platform/blocked", mode: "deploy" });

  assert.strictEqual(decision.blocked, true);
  assert.ok(decision.reasonCodes.includes("panic.execution_blocked"));
});

test("panic: evaluate execution not blocked when mode not frozen", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform/mode-test",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-007",
    freezeModes: ["deploy"],
    requiredApprovers: ["admin-007", "admin-008"],
  });

  const decision = service.evaluateExecution({ scope: "platform/mode-test", mode: "write" });

  assert.strictEqual(decision.blocked, false);
  assert.ok(decision.reasonCodes.includes("panic.mode_not_frozen"));
});

test("panic: evaluate execution allowlist bypass", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform/allowlist-test",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-008",
    freezeModes: ["deploy"],
    allowList: ["actor-001", "actor-002"],
    requiredApprovers: ["admin-008", "admin-009"],
  });

  const decision = service.evaluateExecution({
    scope: "platform/allowlist-test",
    mode: "deploy",
    actorId: "actor-001",
  });

  assert.strictEqual(decision.blocked, false);
  assert.ok(decision.reasonCodes.includes("panic.allow_list_bypass"));
});

test("panic: evaluate execution not blocked when no activation", () => {
  const service = new PlatformPanicService();

  const decision = service.evaluateExecution({ scope: "platform/none", mode: "deploy" });

  assert.strictEqual(decision.blocked, false);
  assert.strictEqual(decision.directiveId, null);
});

test("panic: resume with valid plan succeeds", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform/resume-ok",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-009",
    requiredApprovers: ["admin-009", "admin-010"],
  });
  const plan: ResumePlan = {
    scope: "platform/resume-ok",
    approvedBy: ["admin-a", "admin-b"],
    approvedRoles: ["platform_admin", "security_team"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  const receipt = service.resume("platform/resume-ok", plan);

  assert.strictEqual(receipt.resumed, true);
  assert.ok(receipt.resumedAt != null);
  assert.ok(receipt.directiveId != null);
});

test("panic: resume with incomplete checkpoints fails", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform/resume-fail",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-010",
    requiredApprovers: ["admin-010", "admin-011"],
  });
  const plan: ResumePlan = {
    scope: "platform/resume-fail",
    approvedBy: ["admin-a", "admin-b"],
    approvedRoles: ["platform_admin", "security_team"],
    checkpointsVerified: false,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  const receipt = service.resume("platform/resume-fail", plan);

  assert.strictEqual(receipt.resumed, false);
  assert.ok(receipt.reasonCodes.includes("panic.resume_checkpoints_incomplete"));
});

test("panic: resume when no activation returns not found", () => {
  const service = new PlatformPanicService();
  const plan: ResumePlan = {
    scope: "platform/none",
    approvedBy: ["admin-a", "admin-b"],
    checkpointsVerified: true,
  };

  const receipt = service.resume("platform/none", plan);

  assert.strictEqual(receipt.resumed, false);
  assert.ok(receipt.reasonCodes.includes("panic.directive_not_found"));
});

test("panic: get resume receipt returns stored receipt", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform/receipt-test",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-011",
    requiredApprovers: ["admin-011", "admin-012"],
  });
  const plan: ResumePlan = {
    scope: "platform/receipt-test",
    approvedBy: ["admin-a", "admin-b"],
    approvedRoles: ["platform_admin", "platform_admin"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };
  service.resume("platform/receipt-test", plan);

  const receipt = service.getResumeReceipt("platform/receipt-test");

  assert.ok(receipt != null);
  assert.strictEqual(receipt.resumed, true);
});

test("panic: get resume receipt returns null when none", () => {
  const service = new PlatformPanicService();

  const receipt = service.getResumeReceipt("platform/none");

  assert.strictEqual(receipt, null);
});

test("panic: should enter panic mode with active incidents", () => {
  const input = { scope: "platform/test", reasonCode: "test", activeIncidents: 1 };
  assert.strictEqual(shouldEnterPanicMode(input), true);
});

test("panic: should enter panic mode with security reason code", () => {
  const input = { scope: "platform/test", reasonCode: "security.breach", activeIncidents: 0 };
  assert.strictEqual(shouldEnterPanicMode(input), true);
});

test("panic: should not enter panic mode with no incidents and non-security reason", () => {
  const input = { scope: "platform/test", reasonCode: "test.info", activeIncidents: 0 };
  assert.strictEqual(shouldEnterPanicMode(input), false);
});

test("panic: can resume with valid plan", () => {
  const plan: ResumePlan = {
    scope: "platform/test",
    approvedBy: ["admin-a", "admin-b"],
    approvedRoles: ["platform_admin", "security_team"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };
  assert.strictEqual(canResumeFromPanic(plan), true);
});

test("panic: can resume with two platform admins no security team (break glass)", () => {
  const plan: ResumePlan = {
    scope: "platform/test",
    approvedBy: ["admin-a", "admin-b"],
    approvedRoles: ["platform_admin", "platform_admin"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };
  assert.strictEqual(canResumeFromPanic(plan), true);
});

test("panic: cannot resume with insufficient approvers", () => {
  const plan: ResumePlan = {
    scope: "platform/test",
    approvedBy: ["admin-a"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };
  assert.strictEqual(canResumeFromPanic(plan), false);
});

test("panic: cannot resume with missing forensic snapshot review", () => {
  const plan: ResumePlan = {
    scope: "platform/test",
    approvedBy: ["admin-a", "admin-b"],
    approvedRoles: ["platform_admin", "security_team"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: false,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };
  assert.strictEqual(canResumeFromPanic(plan), false);
});

test("panic: cannot resume with one admin and no break glass", () => {
  const plan: ResumePlan = {
    scope: "platform/test",
    approvedBy: ["admin-a", "admin-b"],
    approvedRoles: ["platform_admin"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };
  assert.strictEqual(canResumeFromPanic(plan), false);
});

test("panic: activate requires at least two approvers", () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "platform/min-approvers",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "solo-admin",
  };

  assert.throws(() => service.activate(request), /panic.required_approvers_minimum_not_met/);
});

test("panic: activation scope levels derived correctly", () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "domain/marketing",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-d",
    requiredApprovers: ["admin-d", "admin-e"],
  };

  const activation = service.activate(request);

  assert.strictEqual(activation.directive.scopeLevel, "domain");
});

test("panic: invalid scope level throws", () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "invalid_scope_level/test",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-e",
  };

  assert.throws(() => service.activate(request), /panic.invalid_scope_level/);
});

test("panic: propagation records created for target scopes", () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "platform/propagation",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-f",
    targetScopes: ["platform/propagation", "region/us-west", "tenant/acme"],
    requiredApprovers: ["admin-f", "admin-g"],
  };

  const activation = service.activate(request);

  assert.strictEqual(activation.propagationRecords.length, 3);
  assert.strictEqual(activation.propagationRecords[0].propagationMode, "direct");
  assert.strictEqual(activation.propagationRecords[1].propagationMode, "inherited");
});

test("panic: evaluate execution scope matching with hierarchy", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-g",
    requiredApprovers: ["admin-g", "admin-h"],
  });

  const decision = service.evaluateExecution({ scope: "platform/us-west", mode: "deploy" });

  assert.strictEqual(decision.blocked, true);
});

test("panic: resume deletes activation after success", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform/delete-after-resume",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-h",
    requiredApprovers: ["admin-h", "admin-i"],
  });
  const plan: ResumePlan = {
    scope: "platform/delete-after-resume",
    approvedBy: ["admin-a", "admin-b"],
    approvedRoles: ["platform_admin", "security_team"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };
  service.resume("platform/delete-after-resume", plan);

  const activation = service.getActive("platform/delete-after-resume");

  assert.strictEqual(activation, null);
});
