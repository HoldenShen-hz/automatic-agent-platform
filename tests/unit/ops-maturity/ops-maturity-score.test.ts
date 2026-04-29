import assert from "node:assert/strict";
import test from "node:test";

import { OpsMaturityScoreService } from "../../../src/ops-maturity/ops-maturity-score.js";

test("assess calculates overall score with weighted dimensions", () => {
  const service = new OpsMaturityScoreService();
  const result = service.assess({
    driftScore: 80,
    complianceScore: 90,
    costScore: 70,
    explainabilityScore: 85,
  });

  // weighted: drift*0.2 + compliance*0.3 + cost*0.25 + explainability*0.25
  // = 80*0.2 + 90*0.3 + 70*0.25 + 85*0.25 = 16 + 27 + 17.5 + 21.25 = 81.75
  assert.equal(result.overallScore, 81.75);
  assert.equal(result.dimensions.drift, 80);
  assert.equal(result.dimensions.compliance, 90);
  assert.equal(result.dimensions.cost, 70);
  assert.equal(result.dimensions.explainability, 85);
});

test("assess clamps dimension scores to 0-100 range", () => {
  const service = new OpsMaturityScoreService();

  const underflow = service.assess({
    driftScore: -10,
    complianceScore: -50,
    costScore: 50,
    explainabilityScore: 50,
  });
  assert.equal(underflow.dimensions.drift, 0);
  assert.equal(underflow.dimensions.compliance, 0);

  const overflow = service.assess({
    driftScore: 150,
    complianceScore: 110,
    costScore: 50,
    explainabilityScore: 50,
  });
  assert.equal(overflow.dimensions.drift, 100);
  assert.equal(overflow.dimensions.compliance, 100);
});

test("assess generates risk flags when dimensions fall below thresholds", () => {
  const service = new OpsMaturityScoreService();

  const critical = service.assess({
    driftScore: 40,
    complianceScore: 55,
    costScore: 45,
    explainabilityScore: 40,
  });

  assert.ok(critical.riskFlags.includes("drift_critical"), "drift < 50 triggers drift_critical");
  assert.ok(critical.riskFlags.includes("compliance_gap"), "compliance < 60 triggers compliance_gap");
  assert.ok(critical.riskFlags.includes("cost_overrun"), "cost < 50 triggers cost_overrun");
  assert.ok(critical.riskFlags.includes("explainability_insufficient"), "explainability < 50 triggers explainability_insufficient");
});

test("assess does not add risk flags when dimensions meet thresholds", () => {
  const service = new OpsMaturityScoreService();

  const healthy = service.assess({
    driftScore: 80,
    complianceScore: 80,
    costScore: 80,
    explainabilityScore: 80,
  });

  assert.equal(healthy.riskFlags.length, 0);
});

test("assess includes input risk flags in output", () => {
  const service = new OpsMaturityScoreService();

  const result = service.assess({
    driftScore: 80,
    complianceScore: 80,
    costScore: 80,
    explainabilityScore: 80,
    riskFlags: ["custom_flag", "another_flag"],
  });

  assert.ok(result.riskFlags.includes("custom_flag"));
  assert.ok(result.riskFlags.includes("another_flag"));
});

test("assess stores score in history keyed by agentId", () => {
  const service = new OpsMaturityScoreService();

  service.assess({
    driftScore: 70,
    complianceScore: 70,
    costScore: 70,
    explainabilityScore: 70,
    agentId: "agent_123",
  });

  const history = service.getScoreHistory("agent_123");
  assert.equal(history.length, 1);
  assert.equal(history[0].dimensions.drift, 70);
});

test("assess stores score in history keyed by domainId when no agentId", () => {
  const service = new OpsMaturityScoreService();

  service.assess({
    driftScore: 60,
    complianceScore: 60,
    costScore: 60,
    explainabilityScore: 60,
    domainId: "domain_456",
  });

  const history = service.getScoreHistory("domain_456");
  assert.equal(history.length, 1);
});

test("assess uses global key when neither agentId nor domainId provided", () => {
  const service = new OpsMaturityScoreService();

  service.assess({
    driftScore: 50,
    complianceScore: 50,
    costScore: 50,
    explainabilityScore: 50,
  });

  const history = service.getScoreHistory("global");
  assert.equal(history.length, 1);
});

test("getLatestScore returns most recent score for a key", () => {
  const service = new OpsMaturityScoreService();

  service.assess({
    driftScore: 50,
    complianceScore: 50,
    costScore: 50,
    explainabilityScore: 50,
    agentId: "agent_789",
  });

  service.assess({
    driftScore: 80,
    complianceScore: 80,
    costScore: 80,
    explainabilityScore: 80,
    agentId: "agent_789",
  });

  const latest = service.getLatestScore("agent_789");
  assert.ok(latest != null);
  assert.equal(latest.overallScore, 80);
});

test("getLatestScore returns null for unknown key", () => {
  const service = new OpsMaturityScoreService();
  assert.equal(service.getLatestScore("unknown_key"), null);
});

test("getDimensionDetails returns correct factors for low drift score", () => {
  const service = new OpsMaturityScoreService();

  const score = service.assess({
    driftScore: 30,
    complianceScore: 80,
    costScore: 80,
    explainabilityScore: 80,
  });

  const details = service.getDimensionDetails(score);
  const driftDetail = details.find((d) => d.dimension === "drift");

  assert.ok(driftDetail != null);
  assert.equal(driftDetail.score, 30);
  assert.ok(driftDetail.contributingFactors.includes("divergence_detected"));
  assert.ok(driftDetail.contributingFactors.includes("anti_gaming_possible"));
  assert.ok(driftDetail.recommendedActions.includes("immediate_rebalance_required"));
  assert.ok(driftDetail.recommendedActions.includes("monitor_agent_behavior"));
});

test("getDimensionDetails returns correct factors for healthy drift score", () => {
  const service = new OpsMaturityScoreService();

  const score = service.assess({
    driftScore: 70,
    complianceScore: 80,
    costScore: 80,
    explainabilityScore: 80,
  });

  const details = service.getDimensionDetails(score);
  const driftDetail = details.find((d) => d.dimension === "drift");

  assert.ok(driftDetail != null);
  assert.equal(driftDetail.score, 70);
  assert.ok(driftDetail.contributingFactors.includes("drift_within_tolerance"));
  assert.ok(driftDetail.recommendedActions.includes("continue_monitoring"));
});

test("getDimensionDetails returns correct factors for low compliance score", () => {
  const service = new OpsMaturityScoreService();

  const score = service.assess({
    driftScore: 80,
    complianceScore: 40,
    costScore: 80,
    explainabilityScore: 80,
  });

  const details = service.getDimensionDetails(score);
  const complianceDetail = details.find((d) => d.dimension === "compliance");

  assert.ok(complianceDetail != null);
  assert.ok(complianceDetail.contributingFactors.includes("control_gaps_found"));
  assert.ok(complianceDetail.contributingFactors.includes("evidence_insufficient"));
  assert.ok(complianceDetail.recommendedActions.includes("address_control_gaps"));
  assert.ok(complianceDetail.recommendedActions.includes("improve_evidence_collection"));
});

test("getDimensionDetails returns correct factors for healthy compliance score", () => {
  const service = new OpsMaturityScoreService();

  const score = service.assess({
    driftScore: 80,
    complianceScore: 75,
    costScore: 80,
    explainabilityScore: 80,
  });

  const details = service.getDimensionDetails(score);
  const complianceDetail = details.find((d) => d.dimension === "compliance");

  assert.ok(complianceDetail != null);
  assert.ok(complianceDetail.contributingFactors.includes("compliance_satisfied"));
  assert.ok(complianceDetail.recommendedActions.includes("maintain_evidence_pipeline"));
});

test("getDimensionDetails returns correct factors for low cost score", () => {
  const service = new OpsMaturityScoreService();

  const score = service.assess({
    driftScore: 80,
    complianceScore: 80,
    costScore: 30,
    explainabilityScore: 80,
  });

  const details = service.getDimensionDetails(score);
  const costDetail = details.find((d) => d.dimension === "cost");

  assert.ok(costDetail != null);
  assert.ok(costDetail.contributingFactors.includes("budget_overrun"));
  assert.ok(costDetail.contributingFactors.includes("optimization_needed"));
  assert.ok(costDetail.recommendedActions.includes("optimize_resource_usage"));
  assert.ok(costDetail.recommendedActions.includes("review_pricing_model"));
});

test("getDimensionDetails returns correct factors for healthy cost score", () => {
  const service = new OpsMaturityScoreService();

  const score = service.assess({
    driftScore: 80,
    complianceScore: 80,
    costScore: 70,
    explainabilityScore: 80,
  });

  const details = service.getDimensionDetails(score);
  const costDetail = details.find((d) => d.dimension === "cost");

  assert.ok(costDetail != null);
  assert.ok(costDetail.contributingFactors.includes("cost_optimal"));
  assert.ok(costDetail.recommendedActions.includes("cost_controls_effective"));
});

test("getDimensionDetails returns correct factors for low explainability score", () => {
  const service = new OpsMaturityScoreService();

  const score = service.assess({
    driftScore: 80,
    complianceScore: 80,
    costScore: 80,
    explainabilityScore: 35,
  });

  const details = service.getDimensionDetails(score);
  const explainDetail = details.find((d) => d.dimension === "explainability");

  assert.ok(explainDetail != null);
  assert.ok(explainDetail.contributingFactors.includes("rationale_insufficient"));
  assert.ok(explainDetail.contributingFactors.includes("audit_trail_incomplete"));
  assert.ok(explainDetail.recommendedActions.includes("improve_stage_rationale"));
  assert.ok(explainDetail.recommendedActions.includes("enhance_audit_trail"));
});

test("getDimensionDetails returns correct factors for healthy explainability score", () => {
  const service = new OpsMaturityScoreService();

  const score = service.assess({
    driftScore: 80,
    complianceScore: 80,
    costScore: 80,
    explainabilityScore: 75,
  });

  const details = service.getDimensionDetails(score);
  const explainDetail = details.find((d) => d.dimension === "explainability");

  assert.ok(explainDetail != null);
  assert.ok(explainDetail.contributingFactors.includes("explainability_satisfied"));
  assert.ok(explainDetail.recommendedActions.includes("explainability_meets_requirements"));
});

test("assess sets assessedAt and nextAssessmentDueAt timestamps", () => {
  const service = new OpsMaturityScoreService();
  const before = new Date().toISOString();

  const result = service.assess({
    driftScore: 70,
    complianceScore: 70,
    costScore: 70,
    explainabilityScore: 70,
  });

  const after = new Date().toISOString();
  assert.ok(result.assessedAt >= before);
  assert.ok(result.assessedAt <= after);

  // nextAssessmentDueAt should be approximately 24 hours later
  const assessedTime = new Date(result.assessedAt).getTime();
  const nextDueTime = new Date(result.nextAssessmentDueAt).getTime();
  const diffMs = nextDueTime - assessedTime;
  // Allow 1 second tolerance
  assert.ok(diffMs >= 24 * 60 * 60 * 1000 - 1000);
  assert.ok(diffMs <= 24 * 60 * 60 * 1000 + 1000);
});

test("assess includes agentId and domainId in result when provided", () => {
  const service = new OpsMaturityScoreService();

  const result = service.assess({
    driftScore: 70,
    complianceScore: 70,
    costScore: 70,
    explainabilityScore: 70,
    agentId: "test_agent",
    domainId: "test_domain",
  });

  assert.equal(result.agentId, "test_agent");
  assert.equal(result.domainId, "test_domain");
});

test("assess generates unique scoreId for each assessment", () => {
  const service = new OpsMaturityScoreService();

  const result1 = service.assess({
    driftScore: 70,
    complianceScore: 70,
    costScore: 70,
    explainabilityScore: 70,
  });

  const result2 = service.assess({
    driftScore: 70,
    complianceScore: 70,
    costScore: 70,
    explainabilityScore: 70,
  });

  assert.notEqual(result1.scoreId, result2.scoreId);
});

test("score aggregation from sub-components - multiple agents tracked separately", () => {
  const service = new OpsMaturityScoreService();

  service.assess({
    driftScore: 60,
    complianceScore: 60,
    costScore: 60,
    explainabilityScore: 60,
    agentId: "agent_a",
  });

  service.assess({
    driftScore: 90,
    complianceScore: 90,
    costScore: 90,
    explainabilityScore: 90,
    agentId: "agent_b",
  });

  const historyA = service.getScoreHistory("agent_a");
  const historyB = service.getScoreHistory("agent_b");
  const latestA = service.getLatestScore("agent_a");
  const latestB = service.getLatestScore("agent_b");

  assert.equal(historyA.length, 1);
  assert.equal(historyB.length, 1);
  assert.ok(latestA != null && latestA.overallScore < latestB.overallScore);
});

test("overallScore is rounded to 2 decimal places", () => {
  const service = new OpsMaturityScoreService();

  const result = service.assess({
    driftScore: 33,
    complianceScore: 33,
    costScore: 33,
    explainabilityScore: 33,
  });

  // 33*0.2 + 33*0.3 + 33*0.25 + 33*0.25 = 6.6 + 9.9 + 8.25 + 8.25 = 33
  assert.equal(result.overallScore, 33);

  const result2 = service.assess({
    driftScore: 77,
    complianceScore: 88,
    costScore: 55,
    explainabilityScore: 91,
  });

  // 77*0.2 + 88*0.3 + 55*0.25 + 91*0.25 = 15.4 + 26.4 + 13.75 + 22.75 = 78.3
  assert.equal(result2.overallScore, 78.3);
});
