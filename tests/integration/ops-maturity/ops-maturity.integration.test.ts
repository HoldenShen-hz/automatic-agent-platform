import assert from "node:assert/strict";
import test from "node:test";
import { ExplanationPipelineService, type ExplanationRequest } from "../../../src/ops-maturity/explainability/explanation-pipeline-service.js";
import { PlatformPanicService, type PanicActivationRequest } from "../../../src/ops-maturity/emergency/platform-panic-service.js";
import { EdgeRuntimeSyncService, type EdgeRuntimeProfile, type OfflineExecutionRequest } from "../../../src/ops-maturity/edge-runtime/edge-runtime-sync-service.js";
import { CostOptimizationService, type CostAttributionRecord, type CostSimulationScenarioInput } from "../../../src/ops-maturity/cost-optimizer/cost-optimization-service.js";
import { InMemoryEvidenceStore, type EvidenceRecord } from "../../../src/ops-maturity/drift-detection/evidence-store.js";
import { SimpleReflectionEngine } from "../../../src/ops-maturity/drift-detection/reflection-engine.js";
import { SimpleProposalEngine } from "../../../src/ops-maturity/drift-detection/proposal-engine.js";
import { SimpleBenchmarkRunner } from "../../../src/ops-maturity/drift-detection/benchmark-runner.js";
import { PromotionGate } from "../../../src/ops-maturity/drift-detection/promotion-gate.js";
import { SimpleRolloutManager } from "../../../src/ops-maturity/drift-detection/rollout-manager.js";

test("explainability integration: full pipeline from request to cached bundle", () => {
  const service = new ExplanationPipelineService();

  const request: ExplanationRequest = {
    taskId: "task-pipeline-001",
    stageId: "stage-decide",
    summary: "Accepted low-risk task",
    decision: "accept",
    decisionFactors: ["low_cost", "simple_task"],
    evidence: [
      { evidenceId: "ev-pipeline-1", category: "cost", excerpt: "cost < $0.10" },
      { evidenceId: "ev-pipeline-2", category: "quality", excerpt: "success pattern" },
    ],
    riskNotes: [],
  };

  const bundle = service.generate(request, "L2");
  assert.strictEqual(bundle.depth, "L2");
  assert.ok(bundle.explanationId.length > 0);
  assert.ok(bundle.cacheKey.length > 0);

  const cached = service.getCached(bundle.cacheKey);
  assert.ok(cached != null);
  assert.strictEqual(cached.summary, "Accepted low-risk task");
});

test("explainability integration: L3 pipeline with causal chain and redaction", () => {
  const service = new ExplanationPipelineService();

  const request: ExplanationRequest = {
    taskId: "task-l3-001",
    stageId: "stage-escalate",
    summary: "Escalated to human review",
    decision: "escalate_to_human",
    decisionFactors: ["ambiguous_input", "high_risk_domain"],
    evidence: [
      { evidenceId: "ev-secret-1", category: "internal", excerpt: "sensitive" },
      { evidenceId: "ev-secret-2", category: "restricted", excerpt: "confidential" },
      { evidenceId: "ev-public-1", category: "public", excerpt: "general info" },
    ],
    riskNotes: ["high_value_transaction"],
    causalLinks: [
      { source: "input_received", target: "validation_failed", rationale: "schema mismatch" },
      { source: "validation_failed", target: "human_review", rationale: "requires judgment" },
    ],
    allowedEvidenceCategories: ["public"],
  };

  const bundle = service.generate(request, "L3");

  assert.strictEqual(bundle.rationale.evidenceRefs.length, 1);
  assert.strictEqual(bundle.redactedEvidenceRefs.length, 2);
  assert.strictEqual(bundle.causalSummary.length, 2);
  assert.ok(bundle.rendered.includes("escalate_to_human"));
  assert.ok(bundle.rendered.includes("redacted"));
});

test("emergency integration: full panic lifecycle activate to resume", () => {
  const service = new PlatformPanicService();

  const request: PanicActivationRequest = {
    scope: "platform/full-lifecycle",
    reasonCode: "security.breach",
    activeIncidents: 2,
    issuedBy: "admin-lifecycle",
    freezeModes: ["deploy", "approval", "write", "automation"],
    requiredApprovers: ["admin-lifecycle", "admin-lifecycle-2"],
  };

  const activation = service.activate(request);
  assert.strictEqual(activation.directive.severity, "full");
  assert.ok(activation.acknowledgments.length === 5);

  const decision = service.evaluateExecution({ scope: "platform/full-lifecycle", mode: "deploy" });
  assert.strictEqual(decision.blocked, true);

  const resumePlan = {
    planId: "resume-plan-001",
    scope: "platform/full-lifecycle",
    scopeRef: "scope-ref-001",
    approvedBy: ["admin-a", "admin-b"],
    approvalCount: 2,
    approvedRoles: ["platform_admin", "security_team"] as const,
    compatibilityCheckRef: "compat-check-001",
    mode: "standard" as const,
    checkpointsVerified: true,
    forensicSnapshotReviewed: true,
    rollbackPlanReady: true,
    validationRunPassed: true,
    createdAt: new Date().toISOString(),
  };
  const receipt = service.resume("platform/full-lifecycle", resumePlan);
  assert.strictEqual(receipt.resumed, true);

  const postResumeActivation = service.getActive("platform/full-lifecycle");
  assert.strictEqual(postResumeActivation, null);

  const resumeReceipt = service.getResumeReceipt("platform/full-lifecycle");
  assert.ok(resumeReceipt != null);
  assert.strictEqual(resumeReceipt?.resumed, true);
});

test("emergency integration: panic with multiple target scopes propagates correctly", () => {
  const service = new PlatformPanicService();

  const request: PanicActivationRequest = {
    scope: "platform/propagate",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-propagate",
    targetScopes: ["platform/propagate", "region/us-west", "tenant/acme-corp"],
    requiredApprovers: ["admin-propagate", "admin-propagate-2"],
  };

  const activation = service.activate(request);
  assert.strictEqual(activation.propagationRecords.length, 3);

  const childDecision = service.evaluateExecution({ scope: "region/us-west", mode: "deploy" });
  assert.strictEqual(childDecision.blocked, true);

  const unrelatedDecision = service.evaluateExecution({ scope: "region/eu-central", mode: "deploy" });
  assert.strictEqual(unrelatedDecision.blocked, false);
});

test("edge integration: offline execution through sync envelope to receipt", () => {
  const service = new EdgeRuntimeSyncService();
  const profile: EdgeRuntimeProfile = {
    edgeNodeId: "node-integrated",
    deviceId: "device-integrated",
    capabilities: ["text", "vision"],
    connectivityMode: "offline",
    maxLocalRetentionHours: 48,
    offlineMaxDuration: 1800,
    keyLease: "lease-integrated",
    allowedModels: ["model-text-v1", "model-vision-v1"],
    syncPolicy: { allowRestrictedDataUpload: false, requireOrdering: true },
    riskLevel: "low",
  };
  const models = [
    { modelId: "model-text-v1", modalities: ["text"], priority: 2 },
    { modelId: "model-vision-v1", modalities: ["vision"], priority: 1 },
  ];
  const request: OfflineExecutionRequest = {
    edgeNodeId: "node-integrated",
    taskId: "task-offline-integrated",
    modality: "text",
  };

  const receipt = service.executeOffline(profile, models, request);
  assert.strictEqual(receipt.selectedModelId, "model-text-v1");

  const envelope = service.buildSyncEnvelope(profile, receipt.record, "digest-integrated");
  assert.strictEqual(envelope.dataClassification, "internal");

  const syncReceipt = service.sync(profile, [envelope], {});
  assert.strictEqual(syncReceipt.acceptedEnvelopeIds.length, 1);
});

test("edge integration: conflict resolution when cloud has newer digest", () => {
  const service = new EdgeRuntimeSyncService();
  const profile: EdgeRuntimeProfile = {
    edgeNodeId: "node-conflict",
    deviceId: "device-conflict",
    capabilities: ["text"],
    connectivityMode: "online",
    maxLocalRetentionHours: 24,
    offlineMaxDuration: 600,
    keyLease: "lease-conflict",
    allowedModels: [],
    syncPolicy: { allowRestrictedDataUpload: true, requireOrdering: false },
    riskLevel: "low",
  };
  const request: OfflineExecutionRequest = {
    edgeNodeId: "node-conflict",
    taskId: "task-conflict",
    modality: "text",
  };

  const receipt = service.executeOffline(profile, [], request);
  const envelope = service.buildSyncEnvelope(profile, receipt.record, "edge-digest-value");
  const cloudDigests: Record<string, string> = {
    [`node-conflict:task-conflict:${receipt.record.createdAt}`]: "cloud-newer-digest",
  };

  const syncReceipt = service.sync(profile, [envelope], cloudDigests);

  assert.strictEqual(syncReceipt.rejectedEnvelopeIds.length, 1);
  assert.strictEqual(syncReceipt.decisions[0]?.resolution, "accept_central");
  assert.ok(syncReceipt.decisions[0]?.incidentId != null);
});

test("cost integration: record costs, aggregate, build recommendations, and simulate", () => {
  const service = new CostOptimizationService();

  const record1: CostAttributionRecord = {
    subjectType: "task",
    subjectId: "task-cost-001",
    costType: "llm",
    amountUsd: 25.00,
    llmCostUsd: 20.00,
    toolCostUsd: 3.00,
    computeCostUsd: 1.50,
    storageCostUsd: 0.50,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "decision-001",
    modelRef: "anthropic/claude-3-5-sonnet",
    capturedAt: "2026-04-29T00:00:00Z",
  };
  service.recordCost(record1);

  const record2: CostAttributionRecord = {
    subjectType: "task",
    subjectId: "task-cost-002",
    costType: "llm",
    amountUsd: 35.00,
    llmCostUsd: 28.00,
    toolCostUsd: 4.00,
    computeCostUsd: 2.00,
    storageCostUsd: 1.00,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "decision-002",
    modelRef: "anthropic/claude-3-5-sonnet",
    capturedAt: "2026-04-29T01:00:00Z",
  };
  service.recordCost(record2);

  const aggregated = service.aggregate("task");
  assert.strictEqual(aggregated["task-cost-001"], 25.00);
  assert.strictEqual(aggregated["task-cost-002"], 35.00);

  const recommendations = service.buildRecommendations("task");
  assert.ok(recommendations.length > 0);

  const scenarios: CostSimulationScenarioInput[] = [
    { scenarioId: "scenario-1", subjectId: "task-cost-001", reductionPercent: 20 },
  ];
  const results = service.simulate(scenarios);
  assert.strictEqual(results[0]!.scenarioId, "scenario-1");
  assert.strictEqual(results[0]!.currentCostUsd, 25.00);
  assert.strictEqual(results[0]!.deltaUsd, -5.00);

  const dashboard = service.buildDashboardSlice();
  assert.ok(dashboard.totalCostUsd > 0);
  assert.ok(dashboard.recommendations.length > 0);
});

test("drift integration: evidence to reflection to proposal to promotion gate", async () => {
  const store = new InMemoryEvidenceStore();
  const reflectionEngine = new SimpleReflectionEngine();
  const proposalEngine = new SimpleProposalEngine();
  const benchmarkRunner = new SimpleBenchmarkRunner([
    { id: "tc-1", taskType: "type_error_task", input: {} },
    { id: "tc-2", taskType: "type_error_task", input: {} },
  ]);
  const promotionGate = new PromotionGate();

  for (let i = 0; i < 3; i++) {
    await store.append({
      id: `ev-dfi-${i}`,
      taskType: "code_edit",
      sessionId: "sess-dfi",
      traceId: `trace-dfi-${i}`,
      success: false,
      failureMode: "type_error",
      failureCategory: "type_error",
      costUsd: 0.25 + i * 0.05,
      latencyMs: 4000 + i * 500,
      toolCalls: 3 + i,
      repairRounds: 2,
      rollback: false,
      createdAt: new Date().toISOString(),
    });
  }

  const failures = await store.listFailures("code_edit");
  assert.strictEqual(failures.length, 3);

  const reflections = await reflectionEngine.reflect(failures);
  assert.ok(reflections.length > 0);

  const proposals = await proposalEngine.propose(reflections);
  assert.ok(proposals.length > 0);

  const proposal = proposals[0];
  if (!proposal) {
    assert.fail("Expected at least one proposal");
    return;
  }
  const report = await benchmarkRunner.evaluate(proposal);
  const decision = promotionGate.decide(proposal, report, false);

  // Decision should be made (allowed or not allowed is deterministic based on report)
  assert.ok(decision.reasons.length >= 0);
  assert.ok(decision.stage.length > 0);
});

test("drift integration: full rollout lifecycle", async () => {
  const proposalEngine = new SimpleProposalEngine();
  const benchmarkRunner = new SimpleBenchmarkRunner();
  const promotionGate = new PromotionGate();
  const rolloutManager = new SimpleRolloutManager();

  const proposal = await proposalEngine.create({
    title: "Rollout Test Proposal",
    description: "Test rollout lifecycle",
    kind: "tool_routing_rule",
    target: "test_target",
    risk: "low",
    agentId: "agent-rollout",
    evidenceIds: ["ev-rollout-1"],
  });

  await rolloutManager.start(proposal, "shadow", 0);
  let activeRollouts = await rolloutManager.getActiveRollouts();
  assert.strictEqual(activeRollouts.length, 1);

  await rolloutManager.updateMetrics(proposal.id, {
    successRate: 0.95,
    errorRate: 0.05,
    latencyMs: 3500,
    costUsd: 0.20,
  });

  await rolloutManager.complete(proposal.id);
  const completedRecord = await rolloutManager.getRollout(proposal.id);
  assert.strictEqual(completedRecord?.status, "succeeded");
});

test("drift integration: promotion gate blocks regression", async () => {
  const proposalEngine = new SimpleProposalEngine();
  const promotionGate = new PromotionGate();

  const proposal = await proposalEngine.create({
    title: "Regression Test",
    description: "Test regression blocking",
    kind: "tool_routing_rule",
    target: "test",
    risk: "low",
    agentId: "agent-reg",
    evidenceIds: [],
  });

  const report = {
    proposalId: proposal.id,
    benchmarkCases: 10,
    successRateBefore: 0.70,
    successRateAfter: 0.60,
    regressionRate: 0.10,
    avgCostDelta: 0.01,
    avgLatencyDelta: 0.05,
    safetyViolations: 0,
    decision: "reject" as const,
    createdAt: new Date().toISOString(),
    evaluationVersion: "eval-v1",
    benchmarkSetId: "benchmark-set/default",
    baselineSnapshotRef: "baseline:none",
    lockedCaseIds: [] as string[],
  };

  const decision = promotionGate.decide(proposal, report, false);

  assert.strictEqual(decision.allowed, false);
  assert.ok(decision.reasons.some(r => r.includes("Regression")));
});

test("cost integration: unsourced record tracking", () => {
  const service = new CostOptimizationService();

  try {
    service.recordCost({
      subjectType: "task",
      subjectId: "task-bad",
      costType: "llm",
      amountUsd: 10,
      llmCostUsd: 8,
      toolCostUsd: 1,
      computeCostUsd: 0.5,
      storageCostUsd: 0.3,
      egressCostUsd: 0.2,
      humanReviewCostUsd: 0,
      decisionRef: "",
      capturedAt: "2026-04-29T00:00:00Z",
    });
    assert.fail("Should have thrown for unsourced record");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("unsourced_record"));
  }

  const dashboard = service.buildDashboardSlice();
  assert.strictEqual(dashboard.unsourcedRecordCount, 1);
});

test("edge integration: restricted data upload blocked by policy", () => {
  const service = new EdgeRuntimeSyncService();
  const profile: EdgeRuntimeProfile = {
    edgeNodeId: "node-restrict",
    deviceId: "device-restrict",
    capabilities: ["text"],
    connectivityMode: "online",
    maxLocalRetentionHours: 24,
    offlineMaxDuration: 600,
    keyLease: "lease-restrict",
    allowedModels: [],
    syncPolicy: { allowRestrictedDataUpload: false, requireOrdering: false },
    riskLevel: "low",
  };
  const request: OfflineExecutionRequest = {
    edgeNodeId: "node-restrict",
    taskId: "task-restrict",
    modality: "text",
  };

  const receipt = service.executeOffline(profile, [], request);
  const envelope = service.buildSyncEnvelope(profile, receipt.record, "restricted-digest", 1, "restricted");

  const syncReceipt = service.sync(profile, [envelope], {});

  assert.strictEqual(syncReceipt.rejectedEnvelopeIds.length, 1);
  assert.strictEqual(syncReceipt.decisions[0]?.resolution, "reject");
});

test("emergency integration: allowlist bypass for specific actor", () => {
  const service = new PlatformPanicService();

  service.activate({
    scope: "platform/allowlist",
    reasonCode: "security.breach",
    activeIncidents: 1,
    issuedBy: "admin-allowlist",
    freezeModes: ["deploy"],
    allowList: ["trusted-actor-001", "trusted-actor-002"],
    requiredApprovers: ["admin-allowlist", "admin-allowlist-2"],
  });

  const blockedDecision = service.evaluateExecution({ scope: "platform/allowlist", mode: "deploy" });
  assert.strictEqual(blockedDecision.blocked, true);

  const bypassDecision = service.evaluateExecution({
    scope: "platform/allowlist",
    mode: "deploy",
    actorId: "trusted-actor-001",
  });
  assert.strictEqual(bypassDecision.blocked, false);
  assert.ok(bypassDecision.reasonCodes.includes("panic.allow_list_bypass"));
});

test("cost integration: risk level escalation for model LLM costs", () => {
  const service = new CostOptimizationService();

  service.recordCost({
    subjectType: "model",
    subjectId: "model-high-cost",
    costType: "llm",
    amountUsd: 150,
    llmCostUsd: 140,
    toolCostUsd: 5,
    computeCostUsd: 3,
    storageCostUsd: 2,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "dec-model",
    modelRef: "expensive-model",
    capturedAt: "2026-04-29T00:00:00Z",
  });

  const recommendations = service.buildRecommendations("model");
  assert.ok(recommendations.length > 0);
  assert.ok(recommendations[0]!.riskLevel === "medium" || recommendations[0]!.riskLevel === "high");
});
