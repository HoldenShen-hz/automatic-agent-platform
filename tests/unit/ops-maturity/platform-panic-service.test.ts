import assert from "node:assert/strict";
import test from "node:test";

import { PlatformPanicService } from "../../../src/ops-maturity/emergency/platform-panic-service.js";

test("PlatformPanicService blocks execution until an explicit resume succeeds", () => {
  const service = new PlatformPanicService();
  const activation = service.activate({
    scope: "platform",
    reasonCode: "security.compromise",
    activeIncidents: 1,
    issuedBy: "sre_lead",
    requiredApprovers: ["sre_lead", "security_lead"],
    issuedAt: "2026-04-20T00:00:00.000Z",
    targetScopes: ["platform", "platform/domain:payments"],
    forensicArtifactIds: ["artifact:panic:1"],
    allowList: ["security_bot"],
  });

  assert.equal(activation.propagationRecords.length, 2);
  assert.equal(
    service.evaluateExecution({
      scope: "platform/domain:payments",
      mode: "deploy",
    }).blocked,
    true,
  );
  assert.equal(
    service.evaluateExecution({
      scope: "platform/domain:payments",
      mode: "deploy",
      actorId: "security_bot",
    }).blocked,
    false,
  );

  const rejectedResume = service.resume("platform", {
    scope: "platform",
    approvedBy: "",
    checkpointsVerified: false,
  } as any);
  assert.equal(rejectedResume.resumed, false);

  const acceptedResume = service.resume("platform", {
    scope: "platform",
    approvedBy: ["sre_lead", "security_lead"],
    approvedRoles: ["platform_admin", "security_team"],
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
  }, "2026-04-20T00:20:00.000Z");
  assert.equal(acceptedResume.resumed, true);
  assert.equal(
    service.evaluateExecution({
      scope: "platform/domain:payments",
      mode: "deploy",
    }).blocked,
    false,
  );
});
