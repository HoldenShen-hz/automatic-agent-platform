import assert from "node:assert/strict";
import test from "node:test";

import { ProgressiveAutonomyService } from "../../../../src/interaction/autonomy/index.js";

test("ProgressiveAutonomyService caps full_auto promotion for high-risk domains to supervised", () => {
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

  assert.equal(evaluation.capabilityLevels.trade_execution, "supervised");
  assert.equal(evaluation.decision.level, "supervised");
});

test("ProgressiveAutonomyService forces critical advisory-only domains to suggestion", () => {
  const service = new ProgressiveAutonomyService();
  const evaluation = service.evaluateProfile({
    agentId: "health-agent-1",
    domainId: "healthcare",
    overallTrustLevel: "trusted",
    lastEvaluation: "2026-04-27T00:00:00.000Z",
    capabilityScores: [
      {
        capabilityId: "clinical_summary",
        currentAutonomy: "semi_auto",
        trustScore: 99,
        totalExecutions: 800,
        successfulExecutions: 800,
        failedExecutions: 0,
        humanOverrides: 0,
        incidents: 0,
        lastIncidentAgeDays: null,
      },
    ],
  });

  assert.equal(evaluation.capabilityLevels.clinical_summary, "suggestion");
  assert.equal(evaluation.decision.level, "suggestion");
});
