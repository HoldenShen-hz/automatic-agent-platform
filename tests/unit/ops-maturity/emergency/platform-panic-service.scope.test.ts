/**
 * Unit tests for PlatformPanicService scope inheritance and propagation
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

test.describe("PlatformPanicService scope inheritance", () => {
  test("evaluateExecution resolves child scopes via inheritance", () => {
    const service = createTestService();
    service.activate({
      scope: "platform",
      reasonCode: "security.incident",
      activeIncidents: 1,
      issuedBy: "op1",
    });
    const check: PanicExecutionCheck = {
      scope: "platform/division-a/team-1",
      mode: "deploy",
    };

    const decision = service.evaluateExecution(check);

    assert.equal(decision.blocked, true);
    assert.ok(decision.directiveId);
  });

  test("evaluateExecution resolves parent scope directly", () => {
    const service = createTestService();
    service.activate({
      scope: "platform/division-a",
      reasonCode: "security.incident",
      activeIncidents: 1,
      issuedBy: "op1",
    });
    const check: PanicExecutionCheck = {
      scope: "platform/division-a",
      mode: "deploy",
    };

    const decision = service.evaluateExecution(check);

    assert.equal(decision.blocked, true);
  });

  test("evaluateExecution prefers more specific scope activation", () => {
    const service = createTestService();
    service.activate({
      scope: "platform",
      reasonCode: "capacity.issue",
      activeIncidents: 1,
      issuedBy: "op1",
      freezeModes: ["deploy"],
    });
    service.activate({
      scope: "platform/division-a",
      reasonCode: "security.incident",
      activeIncidents: 1,
      issuedBy: "op1",
      freezeModes: ["deploy", "automation"],
    });
    const check: PanicExecutionCheck = {
      scope: "platform/division-a",
      mode: "automation",
    };

    const decision = service.evaluateExecution(check);

    // Should use the more specific "platform/division-a" directive
    assert.equal(decision.blocked, true);
    assert.ok(decision.reasonCodes.includes("panic.execution_blocked"));
  });

  test("resume removes activation and allows subsequent execution", () => {
    const service = createTestService();
    service.activate({
      scope: "platform",
      reasonCode: "security.incident",
      activeIncidents: 1,
      issuedBy: "op1",
    });
    const plan = {
      scope: "platform",
      approvedBy: ["operator-1", "operator-2"],
      checkpointsVerified: true,
      forensicSnapshotReviewed: true,
      rollbackPlanReady: true,
      validationRunPassed: true,
    };
    service.resume("platform", plan);

    const decision = service.evaluateExecution({ scope: "platform", mode: "deploy" });
    assert.equal(decision.blocked, false);
    assert.equal(decision.directiveId, null);
  });

  test("activate overwrites existing activation for same scope", () => {
    const service = createTestService();
    const activation1 = service.activate({
      scope: "platform",
      reasonCode: "security.incident",
      activeIncidents: 1,
      issuedBy: "op1",
    });
    const originalDirectiveId = activation1.directive.directiveId;

    const activation2 = service.activate({
      scope: "platform",
      reasonCode: "security.vulnerability",
      activeIncidents: 1,
      issuedBy: "op2",
    });

    assert.notEqual(activation2.directive.directiveId, originalDirectiveId);
    assert.equal(activation2.directive.reasonCode, "security.vulnerability");
    assert.equal(activation2.directive.issuedBy, "op2");

    const active = service.getActive("platform");
    assert.equal(active?.directive.reasonCode, "security.vulnerability");
  });

  test("listActive sorts by scope alphabetically", () => {
    const service = createTestService();
    service.activate({ scope: "zebra", reasonCode: "security.incident", activeIncidents: 1, issuedBy: "op1" });
    service.activate({ scope: "alpha", reasonCode: "security.incident", activeIncidents: 1, issuedBy: "op1" });
    service.activate({ scope: "middle", reasonCode: "security.incident", activeIncidents: 1, issuedBy: "op1" });

    const active = service.listActive();

    assert.equal(active[0]?.directive.scope, "alpha");
    assert.equal(active[1]?.directive.scope, "middle");
    assert.equal(active[2]?.directive.scope, "zebra");
  });

  test("targetScopes creates propagation records for multiple scopes", () => {
    const service = createTestService();
    const activation = service.activate({
      scope: "platform",
      reasonCode: "security.incident",
      activeIncidents: 1,
      issuedBy: "op1",
      targetScopes: ["platform", "platform/division-a", "platform/division-b"],
    });

    assert.equal(activation.propagationRecords.length, 3);
    const direct = activation.propagationRecords.find((r) => r.targetScope === "platform");
    const inherited1 = activation.propagationRecords.find((r) => r.targetScope === "platform/division-a");
    const inherited2 = activation.propagationRecords.find((r) => r.targetScope === "platform/division-b");

    assert.equal(direct?.propagationMode, "direct");
    assert.equal(inherited1?.propagationMode, "inherited");
    assert.equal(inherited2?.propagationMode, "inherited");
  });

  test("evaluateExecution blocks frozen mode even when panic is active", () => {
    const service = createTestService();
    service.activate({
      scope: "platform",
      reasonCode: "security.incident",
      activeIncidents: 1,
      issuedBy: "op1",
      freezeModes: ["deploy", "approval", "write", "automation"],
    });
    const check: PanicExecutionCheck = {
      scope: "platform",
      mode: "automation",
    };

    const decision = service.evaluateExecution(check);

    assert.equal(decision.blocked, true);
  });

  test("resume fails when canResumeFromPanic returns false", () => {
    const service = createTestService();
    service.activate({
      scope: "platform",
      reasonCode: "security.incident",
      activeIncidents: 1,
      issuedBy: "op1",
    });
    const plan = {
      scope: "platform",
      approvedBy: ["only-one-approver"], // only one approver, not two
      checkpointsVerified: true,
      forensicSnapshotReviewed: true,
      rollbackPlanReady: true,
      validationRunPassed: true,
    };

    const receipt = service.resume("platform", plan);

    assert.equal(receipt.resumed, false);
    assert.ok(receipt.reasonCodes.includes("panic.resume_checkpoints_incomplete"));
  });

  test("getResumeReceipt returns null when no resume has occurred", () => {
    const service = createTestService();

    const receipt = service.getResumeReceipt("platform");

    assert.equal(receipt, null);
  });

  test("resume with string approver instead of array", () => {
    const service = createTestService();
    service.activate({
      scope: "platform",
      reasonCode: "security.incident",
      activeIncidents: 1,
      issuedBy: "op1",
    });
    const plan = {
      scope: "platform",
      approvedBy: "single-string-approver",
      checkpointsVerified: true,
      forensicSnapshotReviewed: true,
      rollbackPlanReady: true,
      validationRunPassed: true,
    };

    const receipt = service.resume("platform", plan);

    // Single string approver should fail since we need 2 approvers
    assert.equal(receipt.resumed, false);
  });

  test("resume with empty approvers array", () => {
    const service = createTestService();
    service.activate({
      scope: "platform",
      reasonCode: "security.incident",
      activeIncidents: 1,
      issuedBy: "op1",
    });
    const plan = {
      scope: "platform",
      approvedBy: [],
      checkpointsVerified: true,
      forensicSnapshotReviewed: true,
      rollbackPlanReady: true,
      validationRunPassed: true,
    };

    const receipt = service.resume("platform", plan);

    assert.equal(receipt.resumed, false);
  });

  test("resume with whitespace-only approvers", () => {
    const service = createTestService();
    service.activate({
      scope: "platform",
      reasonCode: "security.incident",
      activeIncidents: 1,
      issuedBy: "op1",
    });
    const plan = {
      scope: "platform",
      approvedBy: ["   ", "   "],
      checkpointsVerified: true,
      forensicSnapshotReviewed: true,
      rollbackPlanReady: true,
      validationRunPassed: true,
    };

    const receipt = service.resume("platform", plan);

    assert.equal(receipt.resumed, false);
  });

  test("evaluateExecution with allowList bypass still records directiveId", () => {
    const service = createTestService();
    service.activate({
      scope: "platform",
      reasonCode: "security.incident",
      activeIncidents: 1,
      issuedBy: "op1",
      allowList: ["bypass-actor"],
    });
    const check: PanicExecutionCheck = {
      scope: "platform",
      mode: "deploy",
      actorId: "bypass-actor",
    };

    const decision = service.evaluateExecution(check);

    assert.equal(decision.blocked, false);
    assert.equal(decision.reasonCodes.includes("panic.allow_list_bypass"), true);
  });

  test("activate rejects when activeIncidents is zero and reasonCode is not security prefix", () => {
    const service = createTestService();
    const request: PanicActivationRequest = {
      scope: "platform",
      reasonCode: "deploy.failed",
      activeIncidents: 0,
      issuedBy: "op1",
    };

    assert.throws(
      () => service.activate(request),
      (err: Error) => err.message.includes("panic.directive_rejected"),
    );
  });

  test("activate stores forensicArtifactIds in activation", () => {
    const service = createTestService();
    const activation = service.activate({
      scope: "platform",
      reasonCode: "security.incident",
      activeIncidents: 1,
      issuedBy: "op1",
      forensicArtifactIds: ["artifact-1", "artifact-2", "artifact-3"],
    });

    assert.equal(activation.forensicSnapshot.artifactIds.length, 3);
    assert.deepEqual(activation.forensicSnapshot.artifactIds, ["artifact-1", "artifact-2", "artifact-3"]);
  });

  test("activate stores severity and triggerSignals in forensicSnapshot", () => {
    const service = createTestService();
    const activation = service.activate({
      scope: "platform",
      reasonCode: "security.incident",
      activeIncidents: 1,
      issuedBy: "op1",
      severity: "critical",
      triggerSignals: ["signal-1", "signal-2"],
    });

    assert.equal(activation.forensicSnapshot.runtimeState["severity"], "critical");
    assert.deepEqual(activation.forensicSnapshot.runtimeState["triggerSignals"], ["signal-1", "signal-2"]);
  });
});
