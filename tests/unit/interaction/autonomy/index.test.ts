import assert from "node:assert/strict";
import test from "node:test";

import { ProgressiveAutonomyService, type AgentTrustProfile } from "../../../../src/interaction/autonomy/index.js";

function makeProfile(overrides: Partial<AgentTrustProfile> = {}): AgentTrustProfile {
  return {
    agentId: "agent_1",
    domainId: "engineering_ops",
    overallTrustLevel: "trusted",
    lastEvaluation: "2026-04-19T00:00:00.000Z",
    capabilityScores: [
      {
        capabilityId: "deploy",
        currentAutonomy: "semi_auto",
        trustScore: 90,
        totalExecutions: 520,
        successfulExecutions: 516,
        failedExecutions: 1,
        humanOverrides: 2,
        incidents: 0,
        lastIncidentAgeDays: 120,
      },
    ],
    ...overrides,
  };
}

test("ProgressiveAutonomyService promotes highly reliable capability to full_auto", () => {
  const service = new ProgressiveAutonomyService();
  const evaluation = service.evaluateProfile(makeProfile());

  assert.equal(evaluation.decision.level, "full_auto");
  assert.equal(evaluation.decision.trustLevel, "fully_trusted");
  assert.equal(evaluation.capabilityLevels.deploy, "full_auto");
  assert.equal(evaluation.changeEvents[0]?.eventType, "agent.autonomy.promoted");
});

test("ProgressiveAutonomyService demotes risky capability to suggestion", () => {
  const service = new ProgressiveAutonomyService();
  const evaluation = service.evaluateProfile(makeProfile({
    capabilityScores: [
      {
        capabilityId: "deploy",
        currentAutonomy: "semi_auto",
        trustScore: 40,
        totalExecutions: 60,
        successfulExecutions: 50,
        failedExecutions: 5,
        humanOverrides: 8,
        incidents: 1,
        lastIncidentAgeDays: 1,
      },
    ],
  }));

  assert.equal(evaluation.decision.level, "suggestion");
  assert.equal(evaluation.changeEvents[0]?.eventType, "agent.autonomy.demoted");
});

test("ProgressiveAutonomyService returns untrusted suggestion for unknown subject", async () => {
  const service = new ProgressiveAutonomyService();
  const decision = await service.evaluate("missing_agent");

  assert.equal(decision.level, "suggestion");
  assert.equal(decision.trustLevel, "untrusted");
});
