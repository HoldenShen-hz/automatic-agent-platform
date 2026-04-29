import assert from "node:assert/strict";
import test from "node:test";
import {
  PlatformPanicService,
  type PanicActivationRequest,
} from "../../../../src/ops-maturity/emergency/platform-panic-service.js";
import type { ResumePlan } from "../../../../src/ops-maturity/emergency/resume-protocol/index.js";

test("brake: emergency brake can be engaged", () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "platform/brake-engage",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-001",
    freezeModes: ["deploy", "approval", "write", "automation"],
    requiredApprovers: ["admin-001", "admin-002"],
  };

  const activation = service.activate(request);

  assert.ok(activation != null);
  assert.strictEqual(activation.directive.scope, "platform/brake-engage");
  assert.strictEqual(activation.directive.freezeModes.length, 4);
});

test("brake: operations are blocked when brake is engaged", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform/blocked-ops",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-003",
    freezeModes: ["deploy", "automation"],
    requiredApprovers: ["admin-003", "admin-004"],
  });

  const deployDecision = service.evaluateExecution({ scope: "platform/blocked-ops", mode: "deploy" });
  assert.strictEqual(deployDecision.blocked, true);
  assert.ok(deployDecision.reasonCodes.includes("panic.execution_blocked"));

  const approvalDecision = service.evaluateExecution({ scope: "platform/blocked-ops", mode: "approval" });
  assert.strictEqual(approvalDecision.blocked, false);
  assert.ok(approvalDecision.reasonCodes.includes("panic.mode_not_frozen"));
});

test("brake: brake can be released to resume operations", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform/resume-brake",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-005",
    requiredApprovers: ["admin-005", "admin-006"],
  });

  const plan: ResumePlan = {
    scope: "platform/resume-brake",
    approvedBy: ["admin-a", "admin-b"],
    approvedRoles: ["platform_admin", "security_team"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  const receipt = service.resume("platform/resume-brake", plan);

  assert.strictEqual(receipt.resumed, true);
  assert.ok(receipt.resumedAt != null);

  const decision = service.evaluateExecution({ scope: "platform/resume-brake", mode: "deploy" });
  assert.strictEqual(decision.blocked, false);
  assert.strictEqual(decision.directiveId, null);
});

test("brake: emergency state is properly tracked", () => {
  const service = new PlatformPanicService();

  const activation1 = service.activate({
    scope: "platform/tracked-1",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-007",
    requiredApprovers: ["admin-007", "admin-008"],
  });

  const activation2 = service.activate({
    scope: "region/eu-central",
    reasonCode: "outage.database",
    activeIncidents: 2,
    issuedBy: "admin-008",
    requiredApprovers: ["admin-008", "admin-009"],
  });

  const list = service.listActive();
  assert.strictEqual(list.length, 2);

  const getActive1 = service.getActive("platform/tracked-1");
  assert.ok(getActive1 != null);
  assert.strictEqual(getActive1.directive.scope, "platform/tracked-1");

  const getActive2 = service.getActive("region/eu-central");
  assert.ok(getActive2 != null);
  assert.strictEqual(getActive2.directive.scopeLevel, "region");

  service.resume("platform/tracked-1", {
    scope: "platform/tracked-1",
    approvedBy: ["admin-a", "admin-b"],
    approvedRoles: ["platform_admin", "security_team"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  });

  const afterResume = service.listActive();
  assert.strictEqual(afterResume.length, 1);

  const receipt = service.getResumeReceipt("platform/tracked-1");
  assert.ok(receipt != null);
  assert.strictEqual(receipt.resumed, true);
});

test("brake: no blocking when brake not engaged", () => {
  const service = new PlatformPanicService();

  const decision = service.evaluateExecution({ scope: "platform/no-brake", mode: "deploy" });

  assert.strictEqual(decision.blocked, false);
  assert.strictEqual(decision.directiveId, null);
  assert.deepStrictEqual(decision.reasonCodes, []);
});

test("brake: allowlist bypasses blocked operation when brake engaged", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform/allowlist-bypass",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-010",
    freezeModes: ["deploy"],
    allowList: ["critical-actor-001"],
    requiredApprovers: ["admin-010", "admin-011"],
  });

  const bypassDecision = service.evaluateExecution({
    scope: "platform/allowlist-bypass",
    mode: "deploy",
    actorId: "critical-actor-001",
  });

  assert.strictEqual(bypassDecision.blocked, false);
  assert.ok(bypassDecision.reasonCodes.includes("panic.allow_list_bypass"));

  const normalDecision = service.evaluateExecution({
    scope: "platform/allowlist-bypass",
    mode: "deploy",
    actorId: "normal-actor",
  });

  assert.strictEqual(normalDecision.blocked, true);
});

test("brake: resume fails when plan is incomplete", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform/resume-fail",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-012",
    requiredApprovers: ["admin-012", "admin-013"],
  });

  const incompletePlan: ResumePlan = {
    scope: "platform/resume-fail",
    approvedBy: ["admin-a"],
    checkpointsVerified: false,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  const receipt = service.resume("platform/resume-fail", incompletePlan);

  assert.strictEqual(receipt.resumed, false);
  assert.ok(receipt.reasonCodes.includes("panic.resume_checkpoints_incomplete"));

  const stillActive = service.getActive("platform/resume-fail");
  assert.ok(stillActive != null);
});

test("brake: resume fails when scope has no active brake", () => {
  const service = new PlatformPanicService();

  const plan: ResumePlan = {
    scope: "platform/nonexistent",
    approvedBy: ["admin-a", "admin-b"],
    approvedRoles: ["platform_admin", "security_team"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  const receipt = service.resume("platform/nonexistent", plan);

  assert.strictEqual(receipt.resumed, false);
  assert.ok(receipt.reasonCodes.includes("panic.directive_not_found"));
});