import assert from "node:assert/strict";
import test from "node:test";

import { ProgressiveAutonomyService } from "../../../../src/interaction/autonomy/index.js";

test("ProgressiveAutonomyService caps full_auto promotion for high-risk domains", () => {
  const service = new ProgressiveAutonomyService();
  const evaluation = service.evaluateProfile({
    agentId: "quant-agent-1",
    domainId: "quant-trading",
    overallTrustLevel: "trusted",
    lastEvaluation: "2026-04-27T00:00:00.000Z",
    capabilityScores: [
      {
        capabilityId: "trade_execution",
        currentAutonomy: "semi_auto",
        trustScore: 99,
        totalExecutions: 500,
        successfulExecutions: 500,
        failedExecutions: 0,
        humanOverrides: 0,
        incidents: 0,
        lastIncidentAgeDays: null,
      },
    ],
  });

  assert.equal(evaluation.capabilityLevels.trade_execution, "semi_auto");
  assert.equal(evaluation.decision.level, "semi_auto");
});
