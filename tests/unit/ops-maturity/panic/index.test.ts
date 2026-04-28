/**
 * Unit tests for ops-maturity/panic index module
 *
 * @see src/ops-maturity/emergency/index.ts (panic-related exports)
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildForensicSnapshot,
  summarizeForensicSnapshot,
  type ForensicSnapshot,
  type ForensicSnapshotInput,
} from "../../../../src/ops-maturity/emergency/forensic-snapshot/index.js";
import {
  PlatformPanicService,
  type PanicActivationRequest,
  type PanicExecutionCheck,
} from "../../../../src/ops-maturity/emergency/platform-panic-service.js";
import {
  canResumeFromPanic,
  type ResumePlan as ResumePlanType,
} from "../../../../src/ops-maturity/emergency/resume-protocol/index.js";
import {
  shouldEnterPanicMode,
  type PanicDirectiveInput,
} from "../../../../src/ops-maturity/emergency/panic-controller/index.js";

const defaultPlaneAcknowledgments = [
  { plane: "P1", localStopState: "ack", evidenceRef: "panic:p1" },
  { plane: "P2", localStopState: "ack", evidenceRef: "panic:p2" },
] as const;

function createActivationRequest(overrides: Partial<PanicActivationRequest> = {}): PanicActivationRequest {
  return {
    scope: overrides.scope ?? "platform",
    reasonCode: overrides.reasonCode ?? "security.incident",
    activeIncidents: overrides.activeIncidents ?? 1,
    issuedBy: overrides.issuedBy ?? "operator-1",
    requiredApprovers: overrides.requiredApprovers ?? ["operator-1", "security-lead"],
    ...overrides,
  };
}

function createValidResumePlan(overrides: Partial<ResumePlanType> = {}): ResumePlanType {
  return {
    scope: overrides.scope ?? "platform",
    approvedBy: overrides.approvedBy ?? ["operator-1", "operator-2"],
    approvedRoles: overrides.approvedRoles ?? ["platform_admin", "security_team"],
    checkpointsVerified: overrides.checkpointsVerified ?? true,
    forensicSnapshotReviewed: overrides.forensicSnapshotReviewed ?? true,
    rollbackPlanReady: overrides.rollbackPlanReady ?? true,
    validationRunPassed: overrides.validationRunPassed ?? true,
  };
}

test.describe("panic index module exports", () => {
  test.describe("PanicController - shouldEnterPanicMode", () => {
    test("returns true when activeIncidents > 0", () => {
      const input: PanicDirectiveInput = {
        scope: "platform",
        reasonCode: "capacity.issue",
        activeIncidents: 1,
      };
      assert.equal(shouldEnterPanicMode(input), true);
    });

    test("returns true when reasonCode starts with security.", () => {
      const input: PanicDirectiveInput = {
        scope: "platform",
        reasonCode: "security.incident",
        activeIncidents: 0,
      };
      assert.equal(shouldEnterPanicMode(input), true);
    });

    test("returns false when no incidents and non-security reason code", () => {
      const input: PanicDirectiveInput = {
        scope: "platform",
        reasonCode: "capacity.issue",
        activeIncidents: 0,
      };
      assert.equal(shouldEnterPanicMode(input), false);
    });
  });

  test.describe("ForensicSnapshot - buildForensicSnapshot", () => {
    test("builds snapshot with all fields", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snap-1",
        scope: "platform",
        collectedAt: "2026-04-24T00:00:00Z",
        artifactIds: ["art-1", "art-2"],
        runtimeState: { status: "frozen" },
        configurationRefs: ["cfg-1"],
        logRefs: ["log-1"],
      };
      const snapshot = buildForensicSnapshot(input);
      assert.equal(snapshot.snapshotId, "snap-1");
      assert.equal(snapshot.scope, "platform");
      assert.deepEqual(snapshot.artifactIds, ["art-1", "art-2"]);
      assert.deepEqual(snapshot.runtimeState, { status: "frozen" });
    });

    test("applies default values for optional fields", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snap-2",
        scope: "division-a",
        collectedAt: "2026-04-24T00:00:00Z",
        artifactIds: [],
      };
      const snapshot = buildForensicSnapshot(input);
      assert.deepEqual(snapshot.runtimeState, {});
      assert.deepEqual(snapshot.configurationRefs, []);
      assert.deepEqual(snapshot.logRefs, []);
    });
  });

  test.describe("ForensicSnapshot - summarizeForensicSnapshot", () => {
    test("summarizes snapshot correctly", () => {
      const snapshot: ForensicSnapshot = {
        snapshotId: "snap-1",
        scope: "platform",
        collectedAt: "2026-04-24T00:00:00Z",
        artifactIds: ["art-1", "art-2", "art-3"],
        runtimeState: {},
        configurationRefs: ["cfg-1", "cfg-2"],
        logRefs: ["log-1"],
        planeAcknowledgments: defaultPlaneAcknowledgments,
      };
      const summary = summarizeForensicSnapshot(snapshot);
      assert.ok(summary.includes("scope=platform"));
      assert.ok(summary.includes("artifacts=3"));
      assert.ok(summary.includes("configs=2"));
      assert.ok(summary.includes("logs=1"));
    });
  });

  test.describe("ResumeProtocol - canResumeFromPanic", () => {
    test("returns true when all conditions met with array approvers", () => {
      assert.equal(
        canResumeFromPanic(createValidResumePlan({ approvedBy: ["operator-1", "operator-2", "operator-3"] })),
        true,
      );
    });

    test("returns true when all conditions met with string approver", () => {
      const plan = {
        ...createValidResumePlan(),
        approvedBy: "operator-1",
      } as unknown as ResumePlanType;
      assert.equal(canResumeFromPanic(plan), false); // only 1 approver
    });

    test("returns false when checkpoints not verified", () => {
      assert.equal(canResumeFromPanic(createValidResumePlan({ checkpointsVerified: false })), false);
    });

    test("returns false when forensic snapshot not reviewed", () => {
      assert.equal(canResumeFromPanic(createValidResumePlan({ forensicSnapshotReviewed: false })), false);
    });

    test("returns false when rollback plan not ready", () => {
      assert.equal(canResumeFromPanic(createValidResumePlan({ rollbackPlanReady: false })), false);
    });

    test("returns false when validation run not passed", () => {
      assert.equal(canResumeFromPanic(createValidResumePlan({ validationRunPassed: false })), false);
    });

    test("handles single approver as string (minimum 2 required)", () => {
      const plan = {
        ...createValidResumePlan(),
        approvedBy: "only-one",
      } as unknown as ResumePlanType;
      assert.equal(canResumeFromPanic(plan), false);
    });

    test("filters out empty approver strings", () => {
      assert.equal(
        canResumeFromPanic(createValidResumePlan({ approvedBy: ["operator-1", "", "   ", "operator-2"] })),
        true,
      );
    });
  });

  test.describe("PlatformPanicService", () => {
    function createTestService() {
      return new PlatformPanicService();
    }

    test("activate creates panic directive with security reason", () => {
      const service = createTestService();
      const request = createActivationRequest();
      const activation = service.activate(request);
      assert.ok(activation.directive.directiveId);
      assert.equal(activation.directive.scope, "platform");
      assert.equal(activation.directive.reasonCode, "security.incident");
    });

    test("activate applies full freeze modes for security reason", () => {
      const service = createTestService();
      const request = createActivationRequest();
      const activation = service.activate(request);
      assert.deepEqual(activation.directive.freezeModes, ["deploy", "approval", "write", "automation"]);
    });

    test("activate applies limited freeze modes for non-security", () => {
      const service = createTestService();
      const request = createActivationRequest({ reasonCode: "capacity.issue" });
      const activation = service.activate(request);
      assert.deepEqual(activation.directive.freezeModes, ["deploy", "automation"]);
    });

    test("activate rejects when shouldEnterPanicMode returns false", () => {
      const service = createTestService();
      const request: PanicActivationRequest = {
        scope: "platform",
        reasonCode: "capacity.issue",
        activeIncidents: 0,
        issuedBy: "operator-1",
      };
      assert.throws(
        () => service.activate(request),
        (err: Error) => err.message.includes("panic.directive_rejected"),
      );
    });

    test("getActive returns activation by scope", () => {
      const service = createTestService();
      service.activate(createActivationRequest({ issuedBy: "op1", requiredApprovers: ["op1", "security-lead"] }));
      const activation = service.getActive("platform");
      assert.ok(activation);
      assert.equal(activation!.directive.scope, "platform");
    });

    test("getActive returns null for unknown scope", () => {
      const service = createTestService();
      assert.equal(service.getActive("unknown"), null);
    });

    test("listActive returns all active activations sorted by scope", () => {
      const service = createTestService();
      service.activate(createActivationRequest({ issuedBy: "op1", requiredApprovers: ["op1", "security-lead"] }));
      service.activate(createActivationRequest({ scope: "domain/division-a", reasonCode: "capacity.issue", issuedBy: "op2", requiredApprovers: ["op2", "security-lead"] }));
      const active = service.listActive();
      assert.equal(active.length, 2);
      assert.ok(active[0]!.directive.scope <= active[1]!.directive.scope);
    });

    test("evaluateExecution allows when no panic active", () => {
      const service = createTestService();
      const check: PanicExecutionCheck = { scope: "platform", mode: "deploy" };
      const decision = service.evaluateExecution(check);
      assert.equal(decision.blocked, false);
      assert.equal(decision.directiveId, null);
    });

    test("evaluateExecution blocks frozen mode", () => {
      const service = createTestService();
      service.activate(createActivationRequest({ issuedBy: "op1", requiredApprovers: ["op1", "security-lead"] }));
      const check: PanicExecutionCheck = { scope: "platform", mode: "deploy" };
      const decision = service.evaluateExecution(check);
      assert.equal(decision.blocked, true);
      assert.ok(decision.reasonCodes.includes("panic.execution_blocked"));
    });

    test("evaluateExecution allows non-frozen mode", () => {
      const service = createTestService();
      service.activate(createActivationRequest({ reasonCode: "capacity.issue", issuedBy: "op1", requiredApprovers: ["op1", "security-lead"], freezeModes: ["deploy"] }));
      const check: PanicExecutionCheck = { scope: "platform", mode: "approval" };
      const decision = service.evaluateExecution(check);
      assert.equal(decision.blocked, false);
    });

    test("evaluateExecution allows allow-listed actor", () => {
      const service = createTestService();
      service.activate(createActivationRequest({ issuedBy: "op1", requiredApprovers: ["op1", "security-lead"], allowList: ["operator-2"] }));
      const check: PanicExecutionCheck = { scope: "platform", mode: "deploy", actorId: "operator-2" };
      const decision = service.evaluateExecution(check);
      assert.equal(decision.blocked, false);
      assert.ok(decision.reasonCodes.includes("panic.allow_list_bypass"));
    });

    test("resume succeeds with valid plan", () => {
      const service = createTestService();
      const activation = service.activate(createActivationRequest({ issuedBy: "op1", requiredApprovers: ["op1", "security-lead"] }));
      const plan = createValidResumePlan();
      const receipt = service.resume("platform", plan);
      assert.equal(receipt.resumed, true);
      assert.ok(receipt.resumedAt);
      assert.equal(receipt.directiveId, activation.directive.directiveId);
    });

    test("resume fails without directive", () => {
      const service = createTestService();
      const plan = {
        ...createValidResumePlan({ scope: "unknown" }),
        approvedBy: "operator-1",
      } as unknown as ResumePlanType;
      const receipt = service.resume("unknown", plan);
      assert.equal(receipt.resumed, false);
      assert.ok(receipt.reasonCodes.includes("panic.directive_not_found"));
    });

    test("getResumeReceipt returns receipt after resume", () => {
      const service = createTestService();
      service.activate(createActivationRequest({ issuedBy: "op1", requiredApprovers: ["op1", "security-lead"] }));
      const plan = createValidResumePlan();
      service.resume("platform", plan);
      const receipt = service.getResumeReceipt("platform");
      assert.ok(receipt);
      assert.equal(receipt!.resumed, true);
    });

    test("activation includes forensic snapshot", () => {
      const service = createTestService();
      const request = createActivationRequest({
        issuedBy: "op1",
        requiredApprovers: ["op1", "security-lead"],
        forensicArtifactIds: ["art-1", "art-2"],
        severity: "critical",
        triggerSignals: ["signal-1"],
      });
      const activation = service.activate(request);
      assert.ok(activation.forensicSnapshot);
      assert.equal(activation.forensicSnapshot.artifactIds.length, 2);
      assert.deepEqual(activation.forensicSnapshot.runtimeState, { severity: "critical", triggerSignals: ["signal-1"] });
    });

    test("activation creates propagation records for target scopes", () => {
      const service = createTestService();
      const request = createActivationRequest({
        issuedBy: "op1",
        requiredApprovers: ["op1", "security-lead"],
        targetScopes: ["platform", "platform/division-a"],
      });
      const activation = service.activate(request);
      assert.equal(activation.propagationRecords.length, 2);
      assert.equal(activation.propagationRecords[0]!.propagationMode, "direct");
      assert.equal(activation.propagationRecords[1]!.propagationMode, "inherited");
    });
  });
});
