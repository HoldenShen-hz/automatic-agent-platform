import assert from "node:assert/strict";
import test from "node:test";

import { PlatformPanicService, type PlatformPanicDirective } from "../../../src/ops-maturity/emergency/platform-panic-service.js";

test("PlatformPanicDirective contains all required fields per R3-34", () => {
  const service = new PlatformPanicService();
  const activation = service.activate({
    scope: "platform",
    reasonCode: "security.compromise",
    activeIncidents: 1,
    issuedBy: "sre_lead",
    requiredApprovers: ["sre_lead", "security_lead"],
    issuedAt: "2026-04-28T00:00:00.000Z",
    severity: "full",
  });

  const directive = activation.directive;

  // Verify PlatformPanicDirective fields per R3-34
  assert.ok(directive.directiveId, "directiveId should be present");
  assert.ok(directive.scope, "scope should be present");
  assert.ok(directive.scopeLevel, "scopeLevel should be present");
  assert.ok(directive.reasonCode, "reasonCode should be present");
  assert.ok(directive.issuedBy, "issuedBy should be present");
  assert.ok(directive.issuedAt, "issuedAt should be present");
  assert.ok(Array.isArray(directive.freezeModes), "freezeModes should be an array");
  assert.ok(directive.freezeModes.length > 0, "freezeModes should not be empty");
  assert.ok(Array.isArray(directive.requiredApprovers), "requiredApprovers should be an array");
  assert.ok(directive.requiredApprovers.length >= 2, "requiredApprovers should have at least 2 approvers");
  assert.ok(directive.severity === "full" || directive.severity === "partial", "severity should be valid");
});

test("PlatformPanicDirective optional fields are set when provided", () => {
  const service = new PlatformPanicService();
  const activation = service.activate({
    scope: "region",
    reasonCode: "security.threat_detected",
    activeIncidents: 3,
    issuedBy: "security_team",
    requiredApprovers: ["security_lead", "sre_lead"],
    issuedAt: "2026-04-28T00:00:00.000Z",
    reconfirmationAfterSeconds: 600,
    rollbackStrategy: "automatic",
    allowList: ["automated_remediation_bot"],
    severity: "partial",
  });

  const directive = activation.directive;

  assert.equal(directive.reconfirmationAfterSeconds, 300, "reconfirmationAfterSeconds should default to 300");
  assert.equal(directive.rollbackStrategy, "automatic", "rollbackStrategy should be automatic");
  assert.deepEqual(directive.allowList, ["automated_remediation_bot"], "allowList should be set");
  assert.equal(directive.severity, "partial", "severity should be partial");
});

test("PlatformPanicDirective freezeModes defaults based on reasonCode", () => {
  const service = new PlatformPanicService();

  // Security reason code gets all freeze modes
  const securityActivation = service.activate({
    scope: "platform",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "security_lead",
    requiredApprovers: ["security_lead", "sre_lead"],
  });
  assert.deepEqual(
    securityActivation.directive.freezeModes,
    ["deploy", "approval", "write", "automation"],
    "security reason should trigger all freeze modes"
  );

  // Non-security reason code gets default freeze modes
  const otherActivation = service.activate({
    scope: "tenant",
    reasonCode: "capacity.exceeded",
    activeIncidents: 2,
    issuedBy: "sre_lead",
    requiredApprovers: ["sre_lead", "capacity_manager"],
  });
  assert.deepEqual(
    otherActivation.directive.freezeModes,
    ["deploy", "automation"],
    "non-security reason should trigger default freeze modes"
  );
});

test("PlatformPanicDirective scopeLevel is derived from scope", () => {
  const service = new PlatformPanicService();

  const platformActivation = service.activate({
    scope: "platform",
    reasonCode: "capacity.exceeded",
    activeIncidents: 1,
    issuedBy: "sre_lead",
    requiredApprovers: ["sre_lead", "capacity_manager"],
  });
  assert.equal(platformActivation.directive.scopeLevel, "platform");

  const regionActivation = service.activate({
    scope: "region",
    reasonCode: "capacity.exceeded",
    activeIncidents: 1,
    issuedBy: "sre_lead",
    requiredApprovers: ["sre_lead", "capacity_manager"],
  });
  assert.equal(regionActivation.directive.scopeLevel, "region");

  const tenantActivation = service.activate({
    scope: "tenant",
    reasonCode: "capacity.exceeded",
    activeIncidents: 1,
    issuedBy: "sre_lead",
    requiredApprovers: ["sre_lead", "capacity_manager"],
  });
  assert.equal(tenantActivation.directive.scopeLevel, "tenant");

  const domainActivation = service.activate({
    scope: "domain",
    reasonCode: "capacity.exceeded",
    activeIncidents: 1,
    issuedBy: "sre_lead",
    requiredApprovers: ["sre_lead", "capacity_manager"],
  });
  assert.equal(domainActivation.directive.scopeLevel, "domain");
});

test("PlatformPanicService evaluateExecution blocks frozen modes", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    reasonCode: "security.compromise",
    activeIncidents: 1,
    issuedBy: "sre_lead",
    requiredApprovers: ["sre_lead", "security_lead"],
  });

  const deployCheck = service.evaluateExecution({
    scope: "platform",
    mode: "deploy",
  });
  assert.equal(deployCheck.blocked, true, "deploy mode should be blocked");
  assert.ok(deployCheck.directiveId, "directiveId should be present");
  assert.ok(deployCheck.reasonCodes.length > 0, "reasonCodes should not be empty");

  const automationCheck = service.evaluateExecution({
    scope: "platform",
    mode: "automation",
  });
  assert.equal(automationCheck.blocked, true, "automation mode should be blocked");
});

test("PlatformPanicService evaluateExecution allows non-frozen modes", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    reasonCode: "capacity.exceeded",
    activeIncidents: 1,
    issuedBy: "sre_lead",
    requiredApprovers: ["sre_lead", "capacity_manager"],
  });

  // approval mode is not in default freeze modes for non-security reason
  const approvalCheck = service.evaluateExecution({
    scope: "platform",
    mode: "approval",
  });
  assert.equal(approvalCheck.blocked, false, "approval mode should not be blocked");
});

test("PlatformPanicService evaluateExecution allows actors on allowList", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    reasonCode: "security.compromise",
    activeIncidents: 1,
    issuedBy: "sre_lead",
    requiredApprovers: ["sre_lead", "security_lead"],
    allowList: ["automated_remediation_bot"],
  });

  const allowedCheck = service.evaluateExecution({
    scope: "platform",
    mode: "deploy",
    actorId: "automated_remediation_bot",
  });
  assert.equal(allowedCheck.blocked, false, "allowed actor should bypass block");
  assert.ok(allowedCheck.reasonCodes.includes("panic.allow_list_bypass"));
});

test("PlatformPanicService resume clears activation", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    reasonCode: "security.compromise",
    activeIncidents: 1,
    issuedBy: "sre_lead",
    requiredApprovers: ["sre_lead", "security_lead"],
  });

  assert.ok(service.getActive("platform"), "activation should exist before resume");

  service.resume("platform", {
    scope: "platform",
    approvedBy: ["sre_lead", "security_lead"],
    approvedRoles: ["platform_admin", "security_team"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  });

  assert.strictEqual(service.getActive("platform"), null, "activation should be cleared after resume");
});

test("PlatformPanicService listActive returns all active activations", () => {
  const service = new PlatformPanicService();
  service.activate({
    scope: "platform",
    reasonCode: "security.compromise",
    activeIncidents: 1,
    issuedBy: "sre_lead",
    requiredApprovers: ["sre_lead", "security_lead"],
  });
  service.activate({
    scope: "region",
    reasonCode: "capacity.exceeded",
    activeIncidents: 2,
    issuedBy: "sre_lead",
    requiredApprovers: ["sre_lead", "capacity_manager"],
  });

  const active = service.listActive();
  assert.equal(active.length, 2, "should have 2 active activations");
});
