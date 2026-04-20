import assert from "node:assert/strict";
import test from "node:test";

import { EscalationService } from "../../../../../src/platform/orchestration/escalation/index.js";

test("EscalationService requests takeover for high-risk execute stages", () => {
  const service = new EscalationService();
  const decision = service.decide({
    taskId: "task-1",
    executionId: "execution-1",
    tenantId: "tenant-1",
    stage: "execute",
    riskLevel: "high",
    reasonCode: "policy.high_risk",
    estimatedCostUsd: 2,
    affectsProduction: false,
  });

  assert.equal(decision.decision, "takeover");
  assert.equal(decision.requiresOperatorAction, true);
});

test("EscalationService triggers panic stop for critical production changes", () => {
  const service = new EscalationService();
  const decision = service.decide({
    taskId: "task-2",
    executionId: null,
    tenantId: "tenant-1",
    stage: "release",
    riskLevel: "critical",
    reasonCode: "release.critical",
    estimatedCostUsd: 20,
    affectsProduction: true,
  });

  assert.equal(decision.decision, "panic_stop");
});
