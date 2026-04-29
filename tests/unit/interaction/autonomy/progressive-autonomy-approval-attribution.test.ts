import assert from "node:assert/strict";
import test from "node:test";

import { ProgressiveAutonomyService, type AgentTrustProfile } from "../../../../src/interaction/autonomy/index.js";

test("ProgressiveAutonomyService tags rule-engine promotions with domain_owner instead of auto", () => {
  const service = new ProgressiveAutonomyService();
  const profile: AgentTrustProfile = {
    agentId: "agent-approval-attribution",
    domainId: "engineering_ops",
    overallTrustLevel: "trusted",
    lastEvaluation: "2026-04-19T00:00:00.000Z",
    capabilityScores: [
      {
        capabilityId: "deploy",
        currentAutonomy: "semi_auto",
        trustScore: 90,
        totalExecutions: 520,
        successfulExecutions: 520,
        failedExecutions: 0,
        humanOverrides: 0,
        incidents: 0,
        lastIncidentAgeDays: 120,
        lastIncidentTimestamp: null,
        costOverruns: 0,
        lastExecutionAgeDays: 1,
      },
    ],
  };

  const evaluation = service.evaluateProfile(profile);

  assert.equal(evaluation.changeEvents[0]?.eventType, "agent.autonomy.promoted");
  assert.equal(evaluation.changeEvents[0]?.approvedBy, "domain_owner");
});
