import assert from "node:assert/strict";
import test from "node:test";
import {
  PlatformPanicService,
  type PanicActivationRequest,
  type PanicResumeReceipt,
} from "../../../src/ops-maturity/emergency/platform-panic-service.js";
import { shouldEnterPanicMode } from "../../../src/ops-maturity/emergency/panic-controller/index.js";
import { canResumeFromPanic, type ResumePlan } from "../../../src/ops-maturity/emergency/resume-protocol/index.js";

test("panic-resume: activate creates panic directive", () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "platform",
    reasonCode: "security.incident",
    activeIncidents: 3,
    issuedBy: "security_team",
    requiredApprovers: ["security_lead", "sre_lead"],
  };

  const activation = service.activate(request);

  assert.ok(activation.directive.directiveId.length > 0);
  assert.strictEqual(activation.directive.scope, "platform");
  assert.strictEqual(activation.directive.scopeLevel, "platform");
  assert.strictEqual(activation.directive.reasonCode, "security.incident");
  assert.ok(activation.forensicSnapshot !== undefined);
});

test("panic-resume: activate creates acknowledgments for all planes", () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "region",
    reasonCode: "capacity.exceeded",
    activeIncidents: 2,
    issuedBy: "ops_team",
    requiredApprovers: ["ops_lead", "capacity_manager"],
  };

  const activation = service.activate(request);

  assert.strictEqual(activation.acknowledgments.length, 5);
  const planes = activation.acknowledgments.map((a) => a.plane);
  assert.ok(planes.includes("P1"));
  assert.ok(planes.includes("P2"));
  assert.ok(planes.includes("P3"));
  assert.ok(planes.includes("P4"));
  assert.ok(planes.includes("P5"));
});

test("panic-resume: activate creates propagation records for sub-scopes", () => {
  const service = new PlatformPanicService();
  const request: PanicActivationRequest = {
    scope: "tenant",
    reasonCode: "security.threat",
    activeIncidents: 1,
    issuedBy: "tenant_admin",
    requiredApprovers: ["tenant_admin", "security_lead"],
    targetScopes: ["tenant", "domain"],
  };

  const activation = service.activate(request);

  assert.strictEqual(activation.propagationRecords.length, 2);
  const directRecord = activation.propagationRecords.find((r) => r.propagationMode === "direct");
  const inheritedRecord = activation.propagationRecords.find((r) => r.propagationMode === "inherited");
  assert.ok(directRecord !== undefined);
  assert.ok(inheritedRecord !== undefined);
  assert.strictEqual(inheritedRecord?.targetScope, "domain");
});

test("panic-resume: getActive returns activation", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    reasonCode: "test",
    activeIncidents: 1,
    issuedBy: "test",
    requiredApprovers: ["lead1", "lead2"],
  });

  const active = service.getActive("platform");

  assert.ok(active !== null);
  assert.strictEqual(active?.directive.scope, "platform");
});

test("panic-resume: getActive returns null for unknown scope", () => {
  const service = new PlatformPanicService();

  const active = service.getActive("unknown:scope");

  assert.strictEqual(active, null);
});

test("panic-resume: listActive returns all active activations", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    reasonCode: "test1",
    activeIncidents: 1,
    issuedBy: "test",
    requiredApprovers: ["lead1", "lead2"],
  });
  service.activate({
    scope: "region",
    reasonCode: "test2",
    activeIncidents: 1,
    issuedBy: "test",
    requiredApprovers: ["lead1", "lead2"],
  });

  const active = service.listActive();

  assert.strictEqual(active.length, 2);
});

test("panic-resume: evaluateExecution blocks frozen mode", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "security",
    requiredApprovers: ["lead1", "lead2"],
  });

  const decision = service.evaluateExecution({
    scope: "platform",
    mode: "deploy",
  });

  assert.strictEqual(decision.blocked, true);
  assert.ok(decision.directiveId !== null);
  assert.ok(decision.reasonCodes.length > 0);
});

test("panic-resume: evaluateExecution allows non-frozen mode", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    reasonCode: "capacity.issue",
    activeIncidents: 1,
    issuedBy: "ops",
    requiredApprovers: ["lead1", "lead2"],
  });

  const decision = service.evaluateExecution({
    scope: "platform",
    mode: "approval",
  });

  assert.strictEqual(decision.blocked, false);
  assert.ok(decision.directiveId !== null); // directiveId is present but mode is not blocked
  assert.ok(decision.reasonCodes.includes("panic.mode_not_frozen"));
});

test("panic-resume: evaluateExecution allows allowlisted actor", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    reasonCode: "security.incident",
    activeIncidents: 1,
    issuedBy: "security",
    requiredApprovers: ["lead1", "lead2"],
    allowList: ["automation-bot"],
  });

  const decision = service.evaluateExecution({
    scope: "platform",
    mode: "deploy",
    actorId: "automation-bot",
  });

  assert.strictEqual(decision.blocked, false);
  assert.ok(decision.reasonCodes.includes("panic.allow_list_bypass"));
});

test("panic-resume: resume with valid plan clears activation", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    reasonCode: "test",
    activeIncidents: 1,
    issuedBy: "test",
    requiredApprovers: ["lead1", "lead2"],
  });

  const plan: ResumePlan = {
    scope: "platform",
    approvedBy: ["lead1", "lead2"],
    approvedRoles: ["platform_admin", "security_team"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  const receipt = service.resume("platform", plan);

  assert.strictEqual(receipt.resumed, true);
  assert.strictEqual(service.getActive("platform"), null);
});

test("panic-resume: resume without active directive fails", () => {
  const service = new PlatformPanicService();
  const plan: ResumePlan = {
    scope: "unknown",
    approvedBy: ["lead1"],
    approvedRoles: ["admin"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  const receipt = service.resume("unknown", plan);

  assert.strictEqual(receipt.resumed, false);
  assert.ok(receipt.reasonCodes.includes("panic.directive_not_found"));
});

test("panic-resume: resume with incomplete checkpoints fails", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "region",
    reasonCode: "test",
    activeIncidents: 1,
    issuedBy: "test",
    requiredApprovers: ["lead1", "lead2"],
  });

  const plan: ResumePlan = {
    scope: "region",
    approvedBy: ["lead1", "lead2"],
    approvedRoles: ["platform_admin", "security_team"],
    checkpointsVerified: false, // Incomplete
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  const receipt = service.resume("region", plan);

  assert.strictEqual(receipt.resumed, false);
  assert.ok(receipt.reasonCodes.includes("panic.resume_checkpoints_incomplete"));
});

test("panic-resume: resume issues platform resume directive", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "tenant",
    reasonCode: "security.threat",
    activeIncidents: 1,
    issuedBy: "security",
    requiredApprovers: ["security_lead", "tenant_admin"],
  });

  const plan: ResumePlan = {
    scope: "tenant",
    approvedBy: ["security_lead", "tenant_admin"],
    approvedRoles: ["platform_admin", "security_team"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  service.resume("tenant", plan);

  const resumeDirective = service.getResumeDirective("tenant");
  assert.ok(resumeDirective !== null);
  assert.ok(resumeDirective.directiveId.length > 0);
  assert.strictEqual(resumeDirective.relatedPanicDirectiveId, service.getResumeReceipt("tenant")?.directiveId);
  assert.strictEqual(resumeDirective.scope, "tenant");
  assert.strictEqual(resumeDirective.rollbackExecuted, true);
  assert.strictEqual(resumeDirective.allowlistRestored, true);
});

test("panic-resume: getResumeReceipt returns receipt after resume", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "domain",
    reasonCode: "test",
    activeIncidents: 1,
    issuedBy: "test",
    requiredApprovers: ["lead1", "lead2"],
  });

  const plan: ResumePlan = {
    scope: "domain",
    approvedBy: ["lead1", "lead2"],
    approvedRoles: ["platform_admin", "security_team"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  service.resume("domain", plan);

  const receipt = service.getResumeReceipt("domain");
  assert.ok(receipt !== null);
  assert.strictEqual(receipt?.resumed, true);
  assert.ok(receipt?.resumedAt !== null);
});

test("panic-resume: getResumeReceipt returns null before resume", () => {
  const service = new PlatformPanicService();

  const receipt = service.getResumeReceipt("platform");

  assert.strictEqual(receipt, null);
});

test("panic-resume: getResumeDirective returns null before resume", () => {
  const service = new PlatformPanicService();

  const directive = service.getResumeDirective("platform");

  assert.strictEqual(directive, null);
});

test("panic-resume: evaluateExecution with matching scope in propagation", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    reasonCode: "security",
    activeIncidents: 1,
    issuedBy: "test",
    requiredApprovers: ["lead1", "lead2"],
    targetScopes: ["platform", "region"],
  });

  // Check execution at a sub-scope that inherits from platform
  const decision = service.evaluateExecution({
    scope: "region",
    mode: "automation",
  });

  assert.strictEqual(decision.blocked, true);
});

test("panic-resume: shouldEnterPanicMode determines entry", () => {
  const request: PanicActivationRequest = {
    scope: "platform",
    reasonCode: "security.incident",
    activeIncidents: 3,
    issuedBy: "security",
    requiredApprovers: ["lead1", "lead2"],
  };

  const shouldEnter = shouldEnterPanicMode(request);

  assert.strictEqual(shouldEnter, true);
});

test("panic-resume: canResumeFromPanic validates plan", () => {
  const validPlan: ResumePlan = {
    scope: "platform",
    approvedBy: ["lead1", "lead2"],
    approvedRoles: ["platform_admin", "security_team"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  const canResume = canResumeFromPanic(validPlan);

  assert.strictEqual(canResume, true);
});

test("panic-resume: canResumeFromPanic rejects incomplete plan", () => {
  const incompletePlan: ResumePlan = {
    scope: "platform",
    approvedBy: ["lead1"],
    approvedRoles: [],
    checkpointsVerified: false,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  const canResume = canResumeFromPanic(incompletePlan);

  assert.strictEqual(canResume, false);
});

test("panic-resume: resume stores receipt for later retrieval", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "node",
    reasonCode: "hardware.failure",
    activeIncidents: 1,
    issuedBy: "ops",
    requiredApprovers: ["ops_lead", "hardware_team"],
  });

  const plan: ResumePlan = {
    scope: "node",
    approvedBy: ["ops_lead", "hardware_team"],
    approvedRoles: ["platform_admin", "security_team"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  };

  service.resume("node", plan);
  const receipt = service.getResumeReceipt("node");

  assert.ok(receipt !== null);
  assert.strictEqual(receipt.scope, "node");
  assert.ok(receipt.reasonCodes.includes("panic.resumed_explicitly"));
});

test("panic-resume: multiple scopes can be active simultaneously", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    reasonCode: "security.platform",
    activeIncidents: 1,
    issuedBy: "security",
    requiredApprovers: ["lead1", "lead2"],
  });
  service.activate({
    scope: "region",
    reasonCode: "capacity.region",
    activeIncidents: 1,
    issuedBy: "ops",
    requiredApprovers: ["lead1", "lead2"],
  });

  const platformActive = service.getActive("platform");
  const regionActive = service.getActive("region");

  assert.ok(platformActive !== null);
  assert.ok(regionActive !== null);
  assert.strictEqual(service.listActive().length, 2);
});

test("panic-resume: resuming one scope does not affect others", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    reasonCode: "test1",
    activeIncidents: 1,
    issuedBy: "test",
    requiredApprovers: ["lead1", "lead2"],
  });
  service.activate({
    scope: "region",
    reasonCode: "test2",
    activeIncidents: 1,
    issuedBy: "test",
    requiredApprovers: ["lead1", "lead2"],
  });

  service.resume("platform", {
    scope: "platform",
    approvedBy: ["lead1", "lead2"],
    approvedRoles: ["platform_admin", "security_team"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  });

  assert.strictEqual(service.getActive("platform"), null);
  assert.ok(service.getActive("region") !== null);
});
