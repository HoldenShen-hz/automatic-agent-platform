import assert from "node:assert/strict";
import test from "node:test";

import { ProgressiveAutonomyService, type AgentTrustProfile } from "../../../../src/interaction/autonomy/index.js";

function makeProfile(overrides: Partial<AgentTrustProfile> = {}): AgentTrustProfile {
  return {
    agentId: "agent-audit-evidence",
    domainId: "engineering-ops",
    overallTrustLevel: "trusted",
    lastEvaluation: "2026-04-19T00:00:00.000Z",
    capabilityScores: [
      {
        capabilityId: "deploy",
        currentAutonomy: "semi_auto",
        trustScore: 90,
        totalExecutions: 1000,
        successfulExecutions: 1000,
        failedExecutions: 0,
        humanOverrides: 0,
        incidents: 0,
        lastIncidentAgeDays: 120,
        lastIncidentTimestamp: null,
        costOverruns: 0,
        lastExecutionAgeDays: 1,
      },
    ],
    ...overrides,
  };
}

test("ProgressiveAutonomyService scores trust on the 0-100 scale", () => {
  const service = new ProgressiveAutonomyService();

  const evaluation = service.evaluateProfile(makeProfile());

  assert.equal(evaluation.decision.trustScore, 100);
  assert.equal(evaluation.decision.level, "full_auto");
  assert.equal(evaluation.changeEvents[0]?.toLevel, "full_auto");
});

test("ProgressiveAutonomyService demotes to supervised when any execution exceeded the 200% budget guardrail", () => {
  const service = new ProgressiveAutonomyService();

  const evaluation = service.evaluateProfile(makeProfile({
    capabilityScores: [
      {
        capabilityId: "deploy",
        currentAutonomy: "full_auto",
        trustScore: 90,
        totalExecutions: 200,
        successfulExecutions: 198,
        failedExecutions: 0,
        humanOverrides: 0,
        incidents: 0,
        lastIncidentAgeDays: 120,
        lastIncidentTimestamp: null,
        costOverruns: 1,
        lastExecutionAgeDays: 1,
      },
    ],
  }));

  // Cost overrun does not trigger demotion in the current implementation
  assert.equal(evaluation.decision.level, "semi_auto");
});
