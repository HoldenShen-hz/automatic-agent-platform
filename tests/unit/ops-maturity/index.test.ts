/**
 * Unit tests for ops-maturity root barrel index
 *
 * @see src/ops-maturity/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

// Re-exported modules from emergency subdirectory
import {
  PlatformPanicService,
  type PanicActivationRequest,
  type PanicExecutionCheck,
  type PanicFreezeMode,
  type PlatformPanicDirective,
  type PanicPropagationRecord,
  type PanicResumeReceipt,
} from "../../../src/ops-maturity/emergency/platform-panic-service.js";
import {
  buildForensicSnapshot,
  summarizeForensicSnapshot,
  type ForensicSnapshot,
  type ForensicSnapshotInput,
} from "../../../src/ops-maturity/emergency/forensic-snapshot/index.js";
import {
  shouldEnterPanicMode,
  type PanicDirectiveInput,
} from "../../../src/ops-maturity/emergency/panic-controller/index.js";
import {
  canResumeFromPanic,
  type ResumePlan,
} from "../../../src/ops-maturity/emergency/resume-protocol/index.js";

test.describe("ops-maturity root barrel index", () => {
  test.describe("emergency module exports - PanicFreezeMode type", () => {
    test("PanicFreezeMode is a string union type", () => {
      const modes: PanicFreezeMode[] = ["deploy", "approval", "write", "automation"];
      assert.equal(modes.length, 4);
      modes.forEach((mode) => assert.equal(typeof mode, "string"));
    });
  });

  test.describe("PlatformPanicDirective interface", () => {
    test("creates a valid directive structure", () => {
      const directive: PlatformPanicDirective = {
        directiveId: "panic-123",
        scope: "platform",
        reasonCode: "security.incident",
        issuedBy: "operator-1",
        issuedAt: "2026-04-24T00:00:00Z",
        freezeModes: ["deploy", "approval", "write", "automation"],
      };
      assert.equal(directive.directiveId, "panic-123");
      assert.equal(directive.scope, "platform");
      assert.ok(directive.freezeModes.includes("deploy"));
    });

    test("directive can include allowList", () => {
      const directive: PlatformPanicDirective = {
        directiveId: "panic-124",
        scope: "platform",
        reasonCode: "security.incident",
        issuedBy: "operator-1",
        issuedAt: "2026-04-24T00:00:00Z",
        freezeModes: ["deploy"],
        allowList: ["operator-2", "operator-3"],
      };
      assert.ok(directive.allowList);
      assert.equal(directive.allowList.length, 2);
    });
  });

  test.describe("PanicPropagationRecord interface", () => {
    test("creates a valid propagation record", () => {
      const record: PanicPropagationRecord = {
        directiveId: "panic-123",
        targetScope: "platform",
        propagationMode: "direct",
        blockedExecutionModes: ["deploy", "automation"],
        recordedAt: "2026-04-24T00:00:00Z",
      };
      assert.equal(record.propagationMode, "direct");
      assert.equal(record.blockedExecutionModes.length, 2);
    });

    test("inherited propagation mode", () => {
      const record: PanicPropagationRecord = {
        directiveId: "panic-123",
        targetScope: "platform/division-a",
        propagationMode: "inherited",
        blockedExecutionModes: ["deploy", "automation"],
        recordedAt: "2026-04-24T00:00:00Z",
      };
      assert.equal(record.propagationMode, "inherited");
    });
  });

  test.describe("PanicActivationRequest interface", () => {
    test("creates request with minimal fields", () => {
      const request: PanicActivationRequest = {
        scope: "platform",
        reasonCode: "security.incident",
        activeIncidents: 1,
        issuedBy: "operator-1",
      };
      assert.equal(request.scope, "platform");
      assert.equal(request.activeIncidents, 1);
    });

    test("creates request with all optional fields", () => {
      const request: PanicActivationRequest = {
        scope: "platform",
        reasonCode: "security.incident",
        activeIncidents: 1,
        issuedBy: "operator-1",
        issuedAt: "2026-04-24T00:00:00Z",
        freezeModes: ["deploy", "write"],
        allowList: ["operator-2"],
        targetScopes: ["platform", "platform/region-us"],
        forensicArtifactIds: ["art-1"],
        severity: "critical",
        triggerSignals: ["signal-1", "signal-2"],
      };
      assert.ok(request.freezeModes);
      assert.ok(request.allowList);
      assert.ok(request.targetScopes);
      assert.equal(request.targetScopes.length, 2);
    });
  });

  test.describe("PanicExecutionCheck interface", () => {
    test("creates execution check with required fields", () => {
      const check: PanicExecutionCheck = {
        scope: "platform",
        mode: "deploy",
      };
      assert.equal(check.scope, "platform");
      assert.equal(check.mode, "deploy");
    });

    test("creates execution check with optional actorId", () => {
      const check: PanicExecutionCheck = {
        scope: "platform",
        mode: "deploy",
        actorId: "operator-1",
      };
      assert.equal(check.actorId, "operator-1");
    });
  });

  test.describe("PanicResumeReceipt interface", () => {
    test("creates successful receipt", () => {
      const receipt: PanicResumeReceipt = {
        scope: "platform",
        resumed: true,
        resumedAt: "2026-04-24T01:00:00Z",
        directiveId: "panic-123",
        reasonCodes: ["panic.resumed_explicitly"],
      };
      assert.equal(receipt.resumed, true);
      assert.ok(receipt.resumedAt);
    });

    test("creates failed receipt", () => {
      const receipt: PanicResumeReceipt = {
        scope: "platform",
        resumed: false,
        resumedAt: null,
        directiveId: "panic-123",
        reasonCodes: ["panic.resume_checkpoints_incomplete"],
      };
      assert.equal(receipt.resumed, false);
      assert.equal(receipt.resumedAt, null);
    });
  });

  test.describe("shouldEnterPanicMode", () => {
    test("triggers on active incidents", () => {
      const input: PanicDirectiveInput = {
        scope: "platform",
        reasonCode: "capacity.issue",
        activeIncidents: 3,
      };
      assert.equal(shouldEnterPanicMode(input), true);
    });

    test("triggers on security reason codes", () => {
      const input: PanicDirectiveInput = {
        scope: "platform",
        reasonCode: "security.auth.bypass",
        activeIncidents: 0,
      };
      assert.equal(shouldEnterPanicMode(input), true);
    });

    test("does not trigger on non-security with zero incidents", () => {
      const input: PanicDirectiveInput = {
        scope: "platform",
        reasonCode: "deploy.failed",
        activeIncidents: 0,
      };
      assert.equal(shouldEnterPanicMode(input), false);
    });
  });

  test.describe("buildForensicSnapshot", () => {
    test("builds complete snapshot", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snap-001",
        scope: "platform",
        collectedAt: "2026-04-24T00:00:00Z",
        artifactIds: ["art-1", "art-2", "art-3"],
        runtimeState: { cpu: 0.95, memory: 0.85 },
        configurationRefs: ["cfg-1"],
        logRefs: ["log-1", "log-2"],
      };
      const snapshot = buildForensicSnapshot(input);
      assert.equal(snapshot.snapshotId, "snap-001");
      assert.deepEqual(snapshot.runtimeState, { cpu: 0.95, memory: 0.85 });
    });

    test("applies defaults for optional fields", () => {
      const input: ForensicSnapshotInput = {
        snapshotId: "snap-002",
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

  test.describe("summarizeForensicSnapshot", () => {
    test("formats summary correctly", () => {
      const snapshot: ForensicSnapshot = {
        snapshotId: "snap-001",
        scope: "platform",
        collectedAt: "2026-04-24T00:00:00Z",
        artifactIds: ["a1", "a2"],
        runtimeState: {},
        configurationRefs: ["c1"],
        logRefs: ["l1"],
      };
      const summary = summarizeForensicSnapshot(snapshot);
      assert.ok(summary.includes("scope=platform"));
      assert.ok(summary.includes("artifacts=2"));
      assert.ok(summary.includes("configs=1"));
      assert.ok(summary.includes("logs=1"));
    });

    test("handles zero counts", () => {
      const snapshot: ForensicSnapshot = {
        snapshotId: "snap-002",
        scope: "empty",
        collectedAt: "2026-04-24T00:00:00Z",
        artifactIds: [],
        runtimeState: {},
        configurationRefs: [],
        logRefs: [],
      };
      const summary = summarizeForensicSnapshot(snapshot);
      assert.ok(summary.includes("artifacts=0"));
      assert.ok(summary.includes("configs=0"));
      assert.ok(summary.includes("logs=0"));
    });
  });

  test.describe("canResumeFromPanic", () => {
    test("returns true with all conditions met", () => {
      const plan: ResumePlan = {
        scope: "platform",
        approvedBy: ["admin-1", "admin-2"],
        checkpointsVerified: true,
        forensicSnapshotReviewed: true,
        rollbackPlanReady: true,
        validationRunPassed: true,
      };
      assert.equal(canResumeFromPanic(plan), true);
    });

    test("returns false when only one approver", () => {
      const plan: ResumePlan = {
        scope: "platform",
        approvedBy: "only-one",
        checkpointsVerified: true,
        forensicSnapshotReviewed: true,
        rollbackPlanReady: true,
        validationRunPassed: true,
      };
      assert.equal(canResumeFromPanic(plan), false);
    });

    test("returns false when checkpoints not verified", () => {
      const plan: ResumePlan = {
        scope: "platform",
        approvedBy: ["admin-1", "admin-2"],
        checkpointsVerified: false,
        forensicSnapshotReviewed: true,
        rollbackPlanReady: true,
        validationRunPassed: true,
      };
      assert.equal(canResumeFromPanic(plan), false);
    });

    test("returns false when forensic snapshot not reviewed", () => {
      const plan: ResumePlan = {
        scope: "platform",
        approvedBy: ["admin-1", "admin-2"],
        checkpointsVerified: true,
        forensicSnapshotReviewed: false,
        rollbackPlanReady: true,
        validationRunPassed: true,
      };
      assert.equal(canResumeFromPanic(plan), false);
    });

    test("returns false when rollback plan not ready", () => {
      const plan: ResumePlan = {
        scope: "platform",
        approvedBy: ["admin-1", "admin-2"],
        checkpointsVerified: true,
        forensicSnapshotReviewed: true,
        rollbackPlanReady: false,
        validationRunPassed: true,
      };
      assert.equal(canResumeFromPanic(plan), false);
    });

    test("returns false when validation run not passed", () => {
      const plan: ResumePlan = {
        scope: "platform",
        approvedBy: ["admin-1", "admin-2"],
        checkpointsVerified: true,
        forensicSnapshotReviewed: true,
        rollbackPlanReady: true,
        validationRunPassed: false,
      };
      assert.equal(canResumeFromPanic(plan), false);
    });

    test("filters empty approver strings", () => {
      const plan: ResumePlan = {
        scope: "platform",
        approvedBy: ["admin-1", "", "  ", "admin-2"],
        checkpointsVerified: true,
        forensicSnapshotReviewed: true,
        rollbackPlanReady: true,
        validationRunPassed: true,
      };
      assert.equal(canResumeFromPanic(plan), true); // 2 valid approvers
    });

    test("handles single approver in array format", () => {
      const plan: ResumePlan = {
        scope: "platform",
        approvedBy: ["only-one"],
        checkpointsVerified: true,
        forensicSnapshotReviewed: true,
        rollbackPlanReady: true,
        validationRunPassed: true,
      };
      assert.equal(canResumeFromPanic(plan), false);
    });
  });

  test.describe("PlatformPanicService integration", () => {
    function createTestService() {
      return new PlatformPanicService();
    }

    test("full panic lifecycle: activate -> evaluate -> resume", () => {
      const service = createTestService();

      // Activate panic
      const request: PanicActivationRequest = {
        scope: "platform",
        reasonCode: "security.incident",
        activeIncidents: 1,
        issuedBy: "operator-1",
      };
      const activation = service.activate(request);
      assert.ok(activation.directive.directiveId);

      // Evaluate execution - should block
      const blockedCheck: PanicExecutionCheck = { scope: "platform", mode: "deploy" };
      let decision = service.evaluateExecution(blockedCheck);
      assert.equal(decision.blocked, true);

      // Resume with valid plan
      const plan: ResumePlan = {
        scope: "platform",
        approvedBy: ["admin-1", "admin-2"],
        checkpointsVerified: true,
        forensicSnapshotReviewed: true,
        rollbackPlanReady: true,
        validationRunPassed: true,
      };
      const receipt = service.resume("platform", plan);
      assert.equal(receipt.resumed, true);

      // Evaluate execution - should allow after resume
      decision = service.evaluateExecution(blockedCheck);
      assert.equal(decision.blocked, false);
    });

    test("scope matching: direct vs inherited", () => {
      const service = createTestService();

      service.activate({
        scope: "platform",
        reasonCode: "security.incident",
        activeIncidents: 1,
        issuedBy: "operator-1",
        targetScopes: ["platform", "platform/division-a"],
      });

      // Direct scope match
      const directDecision = service.evaluateExecution({ scope: "platform", mode: "deploy" });
      assert.equal(directDecision.blocked, true);

      // Inherited scope match
      const inheritedDecision = service.evaluateExecution({ scope: "platform/division-a", mode: "deploy" });
      assert.equal(inheritedDecision.blocked, true);

      // Non-matching scope
      const otherDecision = service.evaluateExecution({ scope: "other", mode: "deploy" });
      assert.equal(otherDecision.blocked, false);
    });

    test("allow list bypass", () => {
      const service = createTestService();

      service.activate({
        scope: "platform",
        reasonCode: "security.incident",
        activeIncidents: 1,
        issuedBy: "operator-1",
        allowList: ["bypass-operator"],
      });

      const bypassCheck: PanicExecutionCheck = {
        scope: "platform",
        mode: "deploy",
        actorId: "bypass-operator",
      };
      const decision = service.evaluateExecution(bypassCheck);
      assert.equal(decision.blocked, false);
      assert.ok(decision.reasonCodes.includes("panic.allow_list_bypass"));
    });

    test("resume fails with incomplete plan", () => {
      const service = createTestService();

      service.activate({
        scope: "platform",
        reasonCode: "security.incident",
        activeIncidents: 1,
        issuedBy: "operator-1",
      });

      const incompletePlan: ResumePlan = {
        scope: "platform",
        approvedBy: "only-one",
        checkpointsVerified: false,
      } as any;

      const receipt = service.resume("platform", incompletePlan);
      assert.equal(receipt.resumed, false);
      assert.equal(receipt.resumedAt, null);
      assert.ok(receipt.reasonCodes.some((c) => c.includes("incomplete")));
    });

    test("resume fails for unknown scope", () => {
      const service = createTestService();

      const plan: ResumePlan = {
        scope: "unknown",
        approvedBy: ["admin-1", "admin-2"],
        checkpointsVerified: true,
        forensicSnapshotReviewed: true,
        rollbackPlanReady: true,
        validationRunPassed: true,
      };

      const receipt = service.resume("unknown", plan);
      assert.equal(receipt.resumed, false);
      assert.ok(receipt.reasonCodes.includes("panic.directive_not_found"));
    });

    test("listActive returns sorted activations", () => {
      const service = createTestService();

      service.activate({ scope: "platform", reasonCode: "security.incident", activeIncidents: 1, issuedBy: "op1" });
      service.activate({ scope: "division-a", reasonCode: "capacity.issue", activeIncidents: 1, issuedBy: "op1" });
      service.activate({ scope: "division-b", reasonCode: "deploy.failed", activeIncidents: 1, issuedBy: "op1" });

      const active = service.listActive();
      assert.equal(active.length, 3);
      // Verify sorted by scope
      for (let i = 1; i < active.length; i++) {
        assert.ok(active[i - 1]!.directive.scope <= active[i]!.directive.scope);
      }
    });

    test("getResumeReceipt returns null before resume", () => {
      const service = createTestService();
      service.activate({ scope: "platform", reasonCode: "security.incident", activeIncidents: 1, issuedBy: "op1" });
      assert.equal(service.getResumeReceipt("platform"), null);
    });

    test("getResumeReceipt returns receipt after resume", () => {
      const service = createTestService();
      service.activate({ scope: "platform", reasonCode: "security.incident", activeIncidents: 1, issuedBy: "op1" });
      const plan: ResumePlan = {
        scope: "platform",
        approvedBy: ["admin-1", "admin-2"],
        checkpointsVerified: true,
        forensicSnapshotReviewed: true,
        rollbackPlanReady: true,
        validationRunPassed: true,
      };
      service.resume("platform", plan);
      const receipt = service.getResumeReceipt("platform");
      assert.ok(receipt);
      assert.equal(receipt!.resumed, true);
    });
  });
});
