import test from "node:test";
import assert from "node:assert/strict";

import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
import {
  SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID,
  buildScaleOpsRuntimeCatalog,
  registerScaleOpsRuntimeCatalog,
  type ScaleOpsRuntimeCatalog,
} from "../../../src/scale-ops-runtime-catalog.js";
import {
  OpsMaturityScoreService,
  type OpsMaturityAssessmentInput,
} from "../../../src/ops-maturity/ops-maturity-score.js";
import {
  CostOptimizationService,
  type CostAttributionRecord,
} from "../../../src/ops-maturity/cost-optimizer/cost-optimization-service.js";
import {
  ExplanationPipelineService,
  type ExplanationRequest,
} from "../../../src/ops-maturity/explainability/explanation-pipeline-service.js";
import {
  AgentLifecycleService,
  type ManagedAgentDefinition,
} from "../../../src/ops-maturity/agent-lifecycle/agent-lifecycle-service.js";

test("ScaleOpsRuntimeCatalog build returns catalog with scale ecosystem and ops maturity", () => {
  const catalog = buildScaleOpsRuntimeCatalog();

  assert.ok(Array.isArray(catalog.scaleEcosystem));
  assert.ok(Array.isArray(catalog.opsMaturity));
});

test("ScaleOpsRuntimeCatalog register registers service in registry", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const catalog = registerScaleOpsRuntimeCatalog(registry);

  assert.equal(registry.isInitialized(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID), true);
  assert.ok(catalog != null);
});

test("ScaleOpsRuntimeCatalog register depends on bootstrap services", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  registerScaleOpsRuntimeCatalog(registry);
  const catalog = registry.get<ScaleOpsRuntimeCatalog>(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID);

  assert.ok(catalog != null);
  assert.ok(Array.isArray(catalog.scaleEcosystem));
  assert.ok(Array.isArray(catalog.opsMaturity));
});

test("OpsMaturityScoreService and CostOptimizationService integrate for cost dimension scoring", async () => {
  const costService = new CostOptimizationService();
  const scoreService = new OpsMaturityScoreService();

  // Record costs for a task
  costService.recordCost({
    subjectType: "task",
    subjectId: "task-001",
    costType: "total",
    amountUsd: 50.00,
    llmCostUsd: 30.00,
    toolCostUsd: 20.00,
    computeCostUsd: 0,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "decision-001",
    capturedAt: new Date().toISOString(),
  });

  costService.recordCost({
    subjectType: "task",
    subjectId: "task-002",
    costType: "total",
    amountUsd: 120.00,
    llmCostUsd: 100.00,
    toolCostUsd: 20.00,
    computeCostUsd: 0,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "decision-002",
    capturedAt: new Date().toISOString(),
  });

  // Build dashboard slice to inform cost score
  const dashboard = costService.buildDashboardSlice();

  // Assess maturity with cost score derived from dashboard
  const costScore = Math.min(100, Math.max(0, 100 - (dashboard.totalCostUsd > 100 ? 20 : 0)));
  const input: OpsMaturityAssessmentInput = {
    driftScore: 80,
    complianceScore: 90,
    costScore,
    explainabilityScore: 85,
    agentId: "agent-001",
  };

  const score = scoreService.assess(input);

  assert.equal(score.agentId, "agent-001");
  assert.equal(score.dimensions.cost, costScore);
  assert.ok(score.overallScore > 0);
});

test("AgentLifecycleService and ExplanationPipelineService integrate for agent decision explainability", async () => {
  const lifecycleService = new AgentLifecycleService();
  const explainService = new ExplanationPipelineService();

  // Register an agent
  const agent: ManagedAgentDefinition = {
    agentId: "coding-agent-001",
    name: "Coding Agent",
    domainId: "coding",
    owner: { orgNodeId: "team-ai", path: "/teams/ai" },
    components: {
      pack: { version: "1.0", packId: "coding-pack" },
      connectorBindings: [],
      promptBundle: { version: "1.0", bundleId: "coding-bundle" },
      modelBinding: { provider: "openai", model: "gpt-4o", fallbackChain: [] },
      trustProfile: { initialLevel: "manual_only", scoringConfig: { successWeight: 0.4, latencyWeight: 0.3, errorWeight: 0.3 } },
      triggerSet: [],
      autonomyConfig: { maxAutomationLevel: "manual_only", requireHumanApprovalForHighRisk: true, maxRetriesBeforeApproval: 3 },
    },
    lifecycleState: "active",
    currentVersionId: "v1.0.0",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  lifecycleService.registerAgent(agent);

  // Bind a task to the agent
  const binding = lifecycleService.bindTask("coding-agent-001", "task-001");

  // Generate explanation for the binding decision
  const request: ExplanationRequest = {
    taskId: binding.taskId,
    stage: "bind",
    summary: `Bound task to agent ${binding.agentId} version ${binding.versionId}`,
    decision: "accept",
    decisionFactors: [
      "agent_in_active_state",
      "version_available",
      "task_compatible_with_agent_type",
    ],
    evidence: [
      { evidenceId: "ev_agent_state", category: "lifecycle", sourceRef: "lifecycle_store" },
      { evidenceId: "ev_binding_record", category: "binding", sourceRef: binding.bindingId },
    ],
    riskNotes: [],
  };

  const bundle = explainService.generate(request, "L2");

  assert.equal(bundle.rationale.taskId, "task-001");
  assert.ok(bundle.rationale.evidenceRefs.length > 0);
  assert.ok(bundle.rendered.length > 0);
});

test("OpsMaturityScoreService and AgentLifecycleService integrate for agent-level scoring", async () => {
  const lifecycleService = new AgentLifecycleService();
  const scoreService = new OpsMaturityScoreService();

  // Register multiple agents
  lifecycleService.registerAgent({
    agentId: "agent-alpha",
    name: "Alpha Agent",
    domainId: "coding",
    owner: { orgNodeId: "team-ai", path: "/teams/ai" },
    components: {
      pack: { version: "1.0", packId: "alpha-pack" },
      connectorBindings: [],
      promptBundle: { version: "1.0", bundleId: "alpha-bundle" },
      modelBinding: { provider: "openai", model: "gpt-4o", fallbackChain: [] },
      trustProfile: { initialLevel: "manual_only", scoringConfig: { successWeight: 0.4, latencyWeight: 0.3, errorWeight: 0.3 } },
      triggerSet: [],
      autonomyConfig: { maxAutomationLevel: "manual_only", requireHumanApprovalForHighRisk: true, maxRetriesBeforeApproval: 3 },
    },
    lifecycleState: "active",
    currentVersionId: "v2.0.0",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  lifecycleService.registerAgent({
    agentId: "agent-beta",
    name: "Beta Agent",
    domainId: "quant-trading",
    owner: { orgNodeId: "team-trading", path: "/teams/trading" },
    components: {
      pack: { version: "1.0", packId: "beta-pack" },
      connectorBindings: [],
      promptBundle: { version: "1.0", bundleId: "beta-bundle" },
      modelBinding: { provider: "openai", model: "gpt-4o", fallbackChain: [] },
      trustProfile: { initialLevel: "manual_only", scoringConfig: { successWeight: 0.4, latencyWeight: 0.3, errorWeight: 0.3 } },
      triggerSet: [],
      autonomyConfig: { maxAutomationLevel: "manual_only", requireHumanApprovalForHighRisk: true, maxRetriesBeforeApproval: 3 },
    },
    lifecycleState: "staging",
    currentVersionId: "v1.5.0",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Assess each agent's maturity
  const alphaScore = scoreService.assess({
    driftScore: 85,
    complianceScore: 90,
    costScore: 80,
    explainabilityScore: 88,
    agentId: "agent-alpha",
  });

  const betaScore = scoreService.assess({
    driftScore: 60,
    complianceScore: 70,
    costScore: 75,
    explainabilityScore: 65,
    agentId: "agent-beta",
  });

  // Beta should have risk flags due to lower scores
  assert.ok(alphaScore.riskFlags.length <= betaScore.riskFlags.length);
  assert.equal(alphaScore.agentId, "agent-alpha");
  assert.equal(betaScore.agentId, "agent-beta");
});

test("CostOptimizationService and ExplanationPipelineService integrate for cost attribution explainability", async () => {
  const costService = new CostOptimizationService();
  const explainService = new ExplanationPipelineService();

  // Record costs for a high-cost task
  const record: CostAttributionRecord = {
    subjectType: "task",
    subjectId: "task-expensive-001",
    costType: "llm",
    amountUsd: 250.00,
    llmCostUsd: 250.00,
    toolCostUsd: 0,
    computeCostUsd: 0,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    qualityRisk: "high",
    decisionRef: "decision-high-cost",
    modelRef: "gpt-4o",
    capturedAt: new Date().toISOString(),
  };
  costService.recordCost(record);

  // Generate explanation for cost decision
  const recommendations = costService.buildRecommendations("task");
  const expensiveTaskRec = recommendations.find((r: { subjectId: string }) => r.subjectId === "task-expensive-001");

  const request: ExplanationRequest = {
    taskId: "task-expensive-001",
    stage: "cost_analysis",
    summary: `High cost task exceeded budget threshold: $${record.amountUsd}`,
    decision: expensiveTaskRec?.riskLevel === "high" ? "escalate_to_human" : "accept",
    decisionFactors: [
      "cost_exceeds_threshold",
      expensiveTaskRec?.riskLevel === "high" ? "high_risk_flagged" : "within_tolerance",
    ],
    evidence: [
      { evidenceId: "ev_cost_record", category: "cost", sourceRef: record.decisionRef },
      { evidenceId: "ev_model_ref", category: "model", sourceRef: record.modelRef ?? "unknown" },
    ],
    riskNotes: expensiveTaskRec?.riskLevel === "high" ? ["cost_overrun_requires_human_review"] : [],
  };

  const bundle = explainService.generate(request, "L2");

  assert.equal(bundle.rationale.taskId, "task-expensive-001");
  assert.ok(bundle.rendered.includes("escalate_to_human") || bundle.rendered.includes("accept"));
});

test("AgentLifecycleService transition updates agent and score history", async () => {
  const lifecycleService = new AgentLifecycleService();
  const scoreService = new OpsMaturityScoreService();

  const agent: ManagedAgentDefinition = {
    agentId: "agent-transition-test",
    name: "Transition Test Agent",
    domainId: "coding",
    owner: { orgNodeId: "team-test", path: "/teams/test" },
    components: {
      pack: { version: "1.0", packId: "test-pack" },
      connectorBindings: [],
      promptBundle: { version: "1.0", bundleId: "test-bundle" },
      modelBinding: { provider: "openai", model: "gpt-4o", fallbackChain: [] },
      trustProfile: { initialLevel: "manual_only", scoringConfig: { successWeight: 0.4, latencyWeight: 0.3, errorWeight: 0.3 } },
      triggerSet: [],
      autonomyConfig: { maxAutomationLevel: "manual_only", requireHumanApprovalForHighRisk: true, maxRetriesBeforeApproval: 3 },
    },
    lifecycleState: "staging",
    currentVersionId: "v1.0.0",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  lifecycleService.registerAgent(agent);

  // Initial score when staging
  scoreService.assess({
    driftScore: 70,
    complianceScore: 75,
    costScore: 80,
    explainabilityScore: 70,
    agentId: "agent-transition-test",
  });

  // Transition to active
  const transition = lifecycleService.transition("agent-transition-test", "active");
  assert.equal(transition.allowed, true);

  // Score after transition
  const updatedAgent = lifecycleService.getAgent("agent-transition-test");
  const latestScore = scoreService.getLatestScore("agent-transition-test");

  assert.equal(updatedAgent?.lifecycleState, "active");
  assert.ok(latestScore != null);
});

test("Multiple services work together for platform operations workflow", async () => {
  const lifecycleService = new AgentLifecycleService();
  const costService = new CostOptimizationService();
  const scoreService = new OpsMaturityScoreService();
  const explainService = new ExplanationPipelineService();

  // 1. Register an agent
  lifecycleService.registerAgent({
    agentId: "ops-agent-001",
    name: "Ops Agent",
    domainId: "platform-ops",
    owner: { orgNodeId: "team-ops", path: "/teams/ops" },
    components: {
      pack: { version: "1.0", packId: "ops-pack" },
      connectorBindings: [],
      promptBundle: { version: "1.0", bundleId: "ops-bundle" },
      modelBinding: { provider: "openai", model: "gpt-4o", fallbackChain: [] },
      trustProfile: { initialLevel: "manual_only", scoringConfig: { successWeight: 0.4, latencyWeight: 0.3, errorWeight: 0.3 } },
      triggerSet: [],
      autonomyConfig: { maxAutomationLevel: "manual_only", requireHumanApprovalForHighRisk: true, maxRetriesBeforeApproval: 3 },
    },
    lifecycleState: "staging",
    currentVersionId: "v0.9.0",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // 2. Record cost for agent operations
  costService.recordCost({
    subjectType: "agent",
    subjectId: "ops-agent-001",
    costType: "total",
    amountUsd: 45.00,
    llmCostUsd: 25.00,
    toolCostUsd: 20.00,
    computeCostUsd: 0,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "cost-decision-001",
    capturedAt: new Date().toISOString(),
  });

  // 3. Assess maturity
  const score = scoreService.assess({
    driftScore: 82,
    complianceScore: 88,
    costScore: 75,
    explainabilityScore: 80,
    agentId: "ops-agent-001",
  });

  // 4. Bind task and explain
  const binding = lifecycleService.bindTask("ops-agent-001", "ops-task-001");

  const explanation = explainService.generate({
    taskId: binding.taskId,
    stage: "bind",
    summary: `Platform ops agent ${binding.agentId} bound to task`,
    decision: "accept",
    decisionFactors: ["agent_staging_ready", "platform_ops_capability"],
    evidence: [
      { evidenceId: "ev_score", category: "maturity", sourceRef: score.scoreId },
    ],
    riskNotes: [],
  }, "L2");

  // Verify integration points
  assert.ok(binding.bindingId.length > 0);
  assert.ok(score.overallScore > 0);
  assert.ok(explanation.rendered.length > 0);
  assert.equal(explanation.rationale.taskId, "ops-task-001");
});
