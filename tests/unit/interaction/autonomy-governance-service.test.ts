import assert from "node:assert/strict";
import test from "node:test";

import { AutonomyGovernanceService } from "../../../src/interaction/autonomy/autonomy-governance-service.js";

test("AutonomyGovernanceService promotes trusted capabilities and adjusts weaker ones", () => {
  const service = new AutonomyGovernanceService();
  const snapshot = service.evaluateProfile({
    agentId: "agent_a",
    domainId: "coding",
    overallTrustLevel: "supervised",
    lastEvaluation: "2026-04-20T00:00:00.000Z",
    capabilityScores: [
      {
        capabilityId: "release",
        currentAutonomy: "supervised",
        trustScore: 0,
        totalExecutions: 250,
        successfulExecutions: 247,
        failedExecutions: 1,
        humanOverrides: 3,
        incidents: 0,
        lastIncidentAgeDays: 90,
      },
      {
        capabilityId: "cleanup",
        currentAutonomy: "full_auto",
        trustScore: 0,
        totalExecutions: 20,
        successfulExecutions: 10,
        failedExecutions: 5,
        humanOverrides: 8,
        incidents: 1,
        lastIncidentAgeDays: 1,
      },
    ],
  });

  const release = snapshot.decisions.find((item) => item.capabilityId === "release");
  const cleanup = snapshot.decisions.find((item) => item.capabilityId === "cleanup");
  assert.equal(release?.recommendedLevel, "semi_auto");
  assert.equal(release?.promoted, true);
  assert.equal(cleanup?.recommendedLevel, "suggestion");
  assert.equal(cleanup?.promoted, false);
});
