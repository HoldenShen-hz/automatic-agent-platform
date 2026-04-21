/**
 * Unit tests for PlatformPanicService
 *
 * @see src/ops-maturity/emergency/platform-panic-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  PlatformPanicService,
  type PanicActivationRequest,
  type PanicExecutionCheck,
} from "../../../../src/ops-maturity/emergency/platform-panic-service.js";

function createTestService() {
  return new PlatformPanicService();
}

test("PlatformPanicService.activate creates panic directive", () => {
  const service = createTestService();
  const request: PanicActivationRequest = {
    scope: "platform",
    reasonCode: "security.incident",
    activeIncidents: 1,
    issuedBy: "operator-1",
  };

  const activation = service.activate(request);

  assert.ok(activation.directive.directiveId);
  assert.equal(activation.directive.scope, "platform");
  assert.equal(activation.directive.reasonCode, "security.incident");
  assert.equal(activation.directive.issuedBy, "operator-1");
  assert.ok(activation.directive.freezeModes.length > 0);
});

test("PlatformPanicService.activate applies default freeze modes based on reason code", () => {
  const service = createTestService();
  const request: PanicActivationRequest = {
    scope: "platform",
    reasonCode: "security.incident",
    activeIncidents: 1,
    issuedBy: "operator-1",
  };

  const activation = service.activate(request);

  assert.deepEqual(activation.directive.freezeModes, ["deploy", "approval", "write", "automation"]);
});

test("PlatformPanicService.activate applies limited freeze modes for non-security", () => {
  const service = createTestService();
  const request: PanicActivationRequest = {
    scope: "platform",
    reasonCode: "capacity.issue",
    activeIncidents: 1,
    issuedBy: "operator-1",
  };

  const activation = service.activate(request);

  assert.deepEqual(activation.directive.freezeModes, ["deploy", "automation"]);
});

test("PlatformPanicService.activate accepts custom freeze modes", () => {
  const service = createTestService();
  const request: PanicActivationRequest = {
    scope: "platform",
    reasonCode: "capacity.issue",
    activeIncidents: 1,
    issuedBy: "operator-1",
    freezeModes: ["deploy", "write"],
  };

  const activation = service.activate(request);

  assert.deepEqual(activation.directive.freezeModes, ["deploy", "write"]);
});

test("PlatformPanicService.activate rejects when shouldEnterPanicMode returns false", () => {
  const service = createTestService();
  const request: PanicActivationRequest = {
    scope: "platform",
    reasonCode: "capacity.issue",
    activeIncidents: 0, // no incidents
    issuedBy: "operator-1",
  };

  assert.throws(
    () => service.activate(request),
    (err: Error) => err.message.includes("panic.directive_rejected"),
  );
});

test("PlatformPanicService.getActive returns activation by scope", () => {
  const service = createTestService();
  const request: PanicActivationRequest = {
    scope: "platform",
    reasonCode: "security.incident",
    activeIncidents: 1,
    issuedBy: "operator-1",
  };
  service.activate(request);

  const activation = service.getActive("platform");

  assert.ok(activation);
  assert.equal(activation!.directive.scope, "platform");
});

test("PlatformPanicService.getActive returns null for unknown scope", () => {
  const service = createTestService();

  const activation = service.getActive("unknown-scope");

  assert.equal(activation, null);
});

test("PlatformPanicService.listActive returns all active activations", () => {
  const service = createTestService();
  service.activate({ scope: "platform", reasonCode: "security.incident", activeIncidents: 1, issuedBy: "op1" });
  service.activate({ scope: "division-a", reasonCode: "capacity.issue", activeIncidents: 1, issuedBy: "op2" });

  const active = service.listActive();

  assert.equal(active.length, 2);
});

test("PlatformPanicService.evaluateExecution allows when no panic active", () => {
  const service = createTestService();
  const check: PanicExecutionCheck = {
    scope: "platform",
    mode: "deploy",
  };

  const decision = service.evaluateExecution(check);

  assert.equal(decision.blocked, false);
  assert.equal(decision.directiveId, null);
});

test("PlatformPanicService.evaluateExecution blocks frozen mode", () => {
  const service = createTestService();
  service.activate({ scope: "platform", reasonCode: "security.incident", activeIncidents: 1, issuedBy: "op1" });
  const check: PanicExecutionCheck = {
    scope: "platform",
    mode: "deploy",
  };

  const decision = service.evaluateExecution(check);

  assert.equal(decision.blocked, true);
  assert.ok(decision.directiveId);
  assert.ok(decision.reasonCodes.includes("panic.execution_blocked"));
});

test("PlatformPanicService.evaluateExecution allows non-frozen mode", () => {
  const service = createTestService();
  service.activate({ scope: "platform", reasonCode: "capacity.issue", activeIncidents: 1, issuedBy: "op1", freezeModes: ["deploy"] });
  const check: PanicExecutionCheck = {
    scope: "platform",
    mode: "approval", // not frozen
  };

  const decision = service.evaluateExecution(check);

  assert.equal(decision.blocked, false);
  assert.equal(decision.reasonCodes.includes("panic.mode_not_frozen"), true);
});

test("PlatformPanicService.evaluateExecution allows allow-listed actor", () => {
  const service = createTestService();
  service.activate({ scope: "platform", reasonCode: "security.incident", activeIncidents: 1, issuedBy: "op1", allowList: ["operator-2"] });
  const check: PanicExecutionCheck = {
    scope: "platform",
    mode: "deploy",
    actorId: "operator-2", // in allow list
  };

  const decision = service.evaluateExecution(check);

  assert.equal(decision.blocked, false);
  assert.equal(decision.reasonCodes.includes("panic.allow_list_bypass"), true);
});

test("PlatformPanicService.resume succeeds with valid plan", () => {
  const service = createTestService();
  const activation = service.activate({ scope: "platform", reasonCode: "security.incident", activeIncidents: 1, issuedBy: "op1" });
  const originalDirectiveId = activation.directive.directiveId;
  const plan = {
    scope: "platform",
    approvedBy: "operator-1",
    checkpointsVerified: true,
  } as any;

  const receipt = service.resume("platform", plan);

  assert.equal(receipt.resumed, true);
  assert.ok(receipt.resumedAt);
  assert.equal(receipt.directiveId, originalDirectiveId);
});

test("PlatformPanicService.resume fails without checkpoints", () => {
  const service = createTestService();
  service.activate({ scope: "platform", reasonCode: "security.incident", activeIncidents: 1, issuedBy: "op1" });
  const plan = {
    scope: "platform",
    approvedBy: "operator-1",
    checkpointsVerified: false,
  } as any;

  const receipt = service.resume("platform", plan);

  assert.equal(receipt.resumed, false);
  assert.equal(receipt.resumedAt, null);
  assert.ok(receipt.reasonCodes.includes("panic.resume_checkpoints_incomplete"));
});

test("PlatformPanicService.resume fails without directive", () => {
  const service = createTestService();
  const plan = {
    scope: "unknown",
    approvedBy: "operator-1",
    checkpointsVerified: true,
  } as any;

  const receipt = service.resume("unknown", plan);

  assert.equal(receipt.resumed, false);
  assert.equal(receipt.reasonCodes.includes("panic.directive_not_found"), true);
});

test("PlatformPanicService.getResumeReceipt returns receipt after resume", () => {
  const service = createTestService();
  service.activate({ scope: "platform", reasonCode: "security.incident", activeIncidents: 1, issuedBy: "op1" });
  const plan = {
    scope: "platform",
    approvedBy: "operator-1",
    checkpointsVerified: true,
  } as any;
  service.resume("platform", plan);

  const receipt = service.getResumeReceipt("platform");

  assert.ok(receipt);
  assert.equal(receipt!.resumed, true);
});
