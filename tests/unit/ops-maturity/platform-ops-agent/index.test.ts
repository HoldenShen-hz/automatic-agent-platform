import assert from "node:assert/strict";
import test from "node:test";

import * as platformOpsAgent from "../../../../src/ops-maturity/platform-ops-agent/index.js";

test("platform-ops-agent index exports PlatformOpsAgentService", () => {
  assert.ok(platformOpsAgent);
  assert.equal(typeof platformOpsAgent.PlatformOpsAgentService, "function");
});

test("platform-ops-agent index exports RunbookAutomationService", () => {
  assert.equal(typeof platformOpsAgent.RunbookAutomationService, "function");
});

test("platform-ops-agent index exports SelfHealingService", () => {
  assert.equal(typeof platformOpsAgent.SelfHealingService, "function");
});

test("platform-ops-agent index exports OpsHealthMonitorService", () => {
  assert.equal(typeof platformOpsAgent.OpsHealthMonitorService, "function");
});

test("platform-ops-agent index exports IncidentDiagnoserService", () => {
  assert.equal(typeof platformOpsAgent.IncidentDiagnoserService, "function");
});

test("platform-ops-agent index exports OpsCapacityPredictorService", () => {
  assert.equal(typeof platformOpsAgent.OpsCapacityPredictorService, "function");
});

test("platform-ops-agent index exports ConfigOptimizerService", () => {
  assert.equal(typeof platformOpsAgent.ConfigOptimizerService, "function");
});

test("platform-ops-agent index exports DeveloperAssistantService", () => {
  assert.equal(typeof platformOpsAgent.DeveloperAssistantService, "function");
});

test("platform-ops-agent index exports all interface types", () => {
  assert.ok(platformOpsAgent.OpsAgentDefinition);
  assert.ok(platformOpsAgent.OpsProposal);
  assert.ok(platformOpsAgent.OpsProposalInput);
  assert.ok(platformOpsAgent.OpsActionType);
  assert.ok(platformOpsAgent.OpsMaturityLevel);
  assert.ok(platformOpsAgent.OpsRiskLevel);
  assert.ok(platformOpsAgent.OpsApprovalStatus);
  assert.ok(platformOpsAgent.OpsDataBoundary);
  assert.ok(platformOpsAgent.OpsNodeAttemptReceipt);
  assert.ok(platformOpsAgent.OpsExecutionReceipt);
  assert.ok(platformOpsAgent.AutomatedRunbook);
  assert.ok(platformOpsAgent.RunbookStepResult);
  assert.ok(platformOpsAgent.AutomatedRunbookExecution);
  assert.ok(platformOpsAgent.RunbookExecutionContext);
  assert.ok(platformOpsAgent.SelfHealingAction);
  assert.ok(platformOpsAgent.SelfHealingReceipt);
  assert.ok(platformOpsAgent.VerificationResult);
  assert.ok(platformOpsAgent.ComponentHealthState);
  assert.ok(platformOpsAgent.HealingPolicy);
  assert.ok(platformOpsAgent.OpsHealthProbe);
  assert.ok(platformOpsAgent.OpsHealthMetrics);
  assert.ok(platformOpsAgent.OpsHealthAlert);
  assert.ok(platformOpsAgent.OpsHealthSnapshot);
  assert.ok(platformOpsAgent.IncidentDiagnosis);
  assert.ok(platformOpsAgent.CapacitySample);
  assert.ok(platformOpsAgent.CapacityPrediction);
  assert.ok(platformOpsAgent.CapacityRiskAssessment);
  assert.ok(platformOpsAgent.CapacityTrend);
  assert.ok(platformOpsAgent.CapacityThreshold);
  assert.ok(platformOpsAgent.ConfigOptimizationInput);
  assert.ok(platformOpsAgent.ConfigOptimizationResult);
  assert.ok(platformOpsAgent.DeveloperAssistRecommendation);
});

test("platform-ops-agent index exports helper functions", () => {
  assert.equal(typeof platformOpsAgent.summarizeOpsHealth, "function");
  assert.equal(typeof platformOpsAgent.findUnhealthyComponents, "function");
  assert.equal(typeof platformOpsAgent.calculateHealthMetrics, "function");
  assert.equal(typeof platformOpsAgent.groupProbesByStatus, "function");
  assert.equal(typeof platformOpsAgent.analyzeLatencyTrends, "function");
  assert.equal(typeof platformOpsAgent.hasLatencyAnomalies, "function");
  assert.equal(typeof platformOpsAgent.generateHealthSummary, "function");
  assert.equal(typeof platformOpsAgent.classifyOpsIncident, "function");
  assert.equal(typeof platformOpsAgent.summarizeIncidentDiagnosis, "function");
  assert.equal(typeof platformOpsAgent.predictOpsCapacityRisk, "function");
  assert.equal(typeof platformOpsAgent.predictCapacityRiskWithHistory, "function");
  assert.equal(typeof platformOpsAgent.estimateCapacityHeadroom, "function");
  assert.equal(typeof platformOpsAgent.calculateCapacityPrediction, "function");
  assert.equal(typeof platformOpsAgent.projectFutureCapacity, "function");
  assert.equal(typeof platformOpsAgent.buildConfigOptimizationSuggestion, "function");
  assert.equal(typeof platformOpsAgent.estimateConfigOptimizationSavings, "function");
  assert.equal(typeof platformOpsAgent.summarizeDeveloperAssistSuggestion, "function");
  assert.equal(typeof platformOpsAgent.buildDeveloperAssistChecklist, "function");
});

test("platform-ops-agent index exports can be used to create instances", () => {
  const opsAgentService = new platformOpsAgent.PlatformOpsAgentService({
    agentId: "test_agent",
    specialty: "infrastructure",
    allowedActionTypes: ["scale_capacity", "tune_config", "investigate_incident", "developer_assist", "restart_service", "failover"],
    requiredApprovals: [],
    maxAutonomyLevel: "trusted_automation",
    evidenceRequirements: [],
  });
  assert.ok(opsAgentService);

  const runbookService = new platformOpsAgent.RunbookAutomationService();
  assert.ok(runbookService);

  const selfHealingService = new platformOpsAgent.SelfHealingService();
  assert.ok(selfHealingService);

  const healthMonitorService = new platformOpsAgent.OpsHealthMonitorService();
  assert.ok(healthMonitorService);

  const incidentDiagnoserService = new platformOpsAgent.IncidentDiagnoserService();
  assert.ok(incidentDiagnoserService);

  const capacityPredictorService = new platformOpsAgent.OpsCapacityPredictorService();
  assert.ok(capacityPredictorService);

  const configOptimizerService = new platformOpsAgent.ConfigOptimizerService();
  assert.ok(configOptimizerService);

  const developerAssistantService = new platformOpsAgent.DeveloperAssistantService();
  assert.ok(developerAssistantService);
});

test("platform-ops-agent OpsExecutionReceipt is an alias for OpsNodeAttemptReceipt", () => {
  assert.equal(platformOpsAgent.OpsExecutionReceipt, platformOpsAgent.OpsNodeAttemptReceipt);
});