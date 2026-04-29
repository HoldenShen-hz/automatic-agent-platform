import assert from "node:assert/strict";
import test from "node:test";

import { OpsMaturityScoreService, type OpsMaturityAssessmentInput } from "../../../src/ops-maturity/ops-maturity-score.js";

test("OpsMaturityScoreService assess returns score with all dimensions", async () => {
  const service = new OpsMaturityScoreService();
  const input: OpsMaturityAssessmentInput = {
    driftScore: 80,
    complianceScore: 90,
    costScore: 70,
    explainabilityScore: 85,
  };

  const score = service.assess(input);

  assert.ok(score.scoreId.startsWith("maturity_score:"));
  assert.equal(score.dimensions.drift, 80);
  assert.equal(score.dimensions.compliance, 90);
  assert.equal(score.dimensions.cost, 70);
  assert.equal(score.dimensions.explainability, 85);
  assert.ok(score.overallScore > 0);
  assert.ok(Array.isArray(score.riskFlags));
  assert.ok(score.assessedAt.length > 0);
  assert.ok(score.nextAssessmentDueAt.length > 0);
});

test("OpsMaturityScoreService assess clamps scores to 0-100 range", async () => {
  const service = new OpsMaturityScoreService();
  const input: OpsMaturityAssessmentInput = {
    driftScore: 150,
    complianceScore: -20,
    costScore: 50,
    explainabilityScore: 50,
  };

  const score = service.assess(input);

  assert.equal(score.dimensions.drift, 100);
  assert.equal(score.dimensions.compliance, 0);
  assert.equal(score.dimensions.cost, 50);
});

test("OpsMaturityScoreService assess calculates weighted overall score", async () => {
  const service = new OpsMaturityScoreService();
  const input: OpsMaturityAssessmentInput = {
    driftScore: 100,
    complianceScore: 100,
    costScore: 100,
    explainabilityScore: 100,
  };

  const score = service.assess(input);

  // Weighted: drift*0.2 + compliance*0.3 + cost*0.25 + explainability*0.25
  // = 100*0.2 + 100*0.3 + 100*0.25 + 100*0.25 = 20 + 30 + 25 + 25 = 100
  assert.equal(score.overallScore, 100);
});

test("OpsMaturityScoreService assess adds risk flags for low scores", async () => {
  const service = new OpsMaturityScoreService();
  const input: OpsMaturityAssessmentInput = {
    driftScore: 40,
    complianceScore: 50,
    costScore: 40,
    explainabilityScore: 40,
    riskFlags: ["existing_flag"],
  };

  const score = service.assess(input);

  assert.ok(score.riskFlags.includes("existing_flag"));
  assert.ok(score.riskFlags.includes("drift_critical"));
  assert.ok(score.riskFlags.includes("compliance_gap"));
  assert.ok(score.riskFlags.includes("cost_overrun"));
  assert.ok(score.riskFlags.includes("explainability_insufficient"));
});

test("OpsMaturityScoreService getLatestScore returns most recent score", async () => {
  const service = new OpsMaturityScoreService();
  service.assess({ driftScore: 70, complianceScore: 70, costScore: 70, explainabilityScore: 70 });
  service.assess({ driftScore: 80, complianceScore: 80, costScore: 80, explainabilityScore: 80 });

  const latest = service.getLatestScore("global");

  assert.ok(latest != null);
  assert.equal(latest!.dimensions.drift, 80);
});

test("OpsMaturityScoreService getLatestScore returns null for unknown key", async () => {
  const service = new OpsMaturityScoreService();

  const latest = service.getLatestScore("unknown");

  assert.equal(latest, null);
});

test("OpsMaturityScoreService getScoreHistory returns all scores for key", async () => {
  const service = new OpsMaturityScoreService();
  service.assess({ driftScore: 70, complianceScore: 70, costScore: 70, explainabilityScore: 70, agentId: "agent1" });
  service.assess({ driftScore: 80, complianceScore: 80, costScore: 80, explainabilityScore: 80, agentId: "agent1" });

  const history = service.getScoreHistory("agent1");

  assert.equal(history.length, 2);
});

test("OpsMaturityScoreService getDimensionDetails returns details for each dimension", async () => {
  const service = new OpsMaturityScoreService();
  const score = service.assess({
    driftScore: 40,
    complianceScore: 50,
    costScore: 40,
    explainabilityScore: 40,
  });

  const details = service.getDimensionDetails(score);

  assert.equal(details.length, 4);
  const drift = details.find((d) => d.dimension === "drift");
  assert.ok(drift != null);
  assert.ok(drift.contributingFactors.length > 0);
  assert.ok(drift.recommendedActions.length > 0);
});

test("OpsMaturityScoreService assess uses agentId or domainId as key", async () => {
  const service = new OpsMaturityScoreService();
  service.assess({ driftScore: 70, complianceScore: 70, costScore: 70, explainabilityScore: 70, agentId: "agent_x" });
  service.assess({ driftScore: 80, complianceScore: 80, costScore: 80, explainabilityScore: 80, domainId: "domain_y" });

  const agentScore = service.getLatestScore("agent_x");
  const domainScore = service.getLatestScore("domain_y");
  const globalScore = service.getLatestScore("global");

  assert.ok(agentScore != null);
  assert.equal(agentScore!.dimensions.drift, 70);
  assert.ok(domainScore != null);
  assert.equal(domainScore!.dimensions.drift, 80);
  assert.ok(globalScore != null);
});
