import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { ExplanationPipelineService } from "../../../src/ops-maturity/explainability/explanation-pipeline-service.js";
import { collectExplanationEvidenceIds } from "../../../src/ops-maturity/explainability/evidence-collector/index.js";
import { putExplanationCacheEntry } from "../../../src/ops-maturity/explainability/explanation-cache/index.js";
import { buildCausalChainSummary } from "../../../src/ops-maturity/explainability/causal-chain-builder/index.js";
import { EdgeRuntimeSyncService } from "../../../src/ops-maturity/edge-runtime/edge-runtime-sync-service.js";
import { buildOfflineExecutionRecord, completeOfflineExecution } from "../../../src/ops-maturity/edge-runtime/edge-executor/index.js";
import { buildEdgeExecutionPlan, buildLegacyEdgeExecutionPlan } from "../../../src/ops-maturity/edge-runtime/edge-orchestrator/index.js";
import { selectEdgeLocalModel } from "../../../src/ops-maturity/edge-runtime/local-model/index.js";
import { orderEdgeSyncQueue } from "../../../src/ops-maturity/edge-runtime/sync-queue/index.js";
import { EvolutionMvpService } from "../../../src/ops-maturity/drift-detection/evolution-mvp-service.js";
import { ApprovalService } from "../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { MemoryService } from "../../../src/platform/five-plane-state-evidence/memory/memory-service.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { createTempWorkspace, cleanupPath } from "../../helpers/fs.js";
import { seedTaskAndExecution } from "../../helpers/seed.js";

test("ExplanationPipelineService generates L2 explanation with causal chain and caching", () => {
  const service = new ExplanationPipelineService();
  const request = {
    taskId: "task_explain_001",
    stage: "plan",
    summary: "Selected parallel execution strategy",
    decisionFactors: ["low_latency_requirement", "resource_availability"],
    evidence: [
      { evidenceId: "ev_001", category: "performance", sourceRef: "perf_report_001", excerpt: "latency < 100ms" },
      { evidenceId: "ev_002", category: "resource", sourceRef: "res_avail_001", excerpt: "cpu available" },
    ],
    riskNotes: ["single_point_of_failure_risk"],
    causalLinks: [
      { source: "low_latency_requirement", target: "parallel_strategy", rationale: "parallel reduces total time" },
      { source: "resource_availability", target: "parallel_strategy", rationale: "enough workers to parallelize" },
    ],
  };
  const bundle = service.generate(request, "L2");
  assert.equal(bundle.depth, "L2");
  assert.equal(bundle.rationale.taskId, "task_explain_001");
  assert.equal(bundle.rationale.stageId, "plan");
  assert.equal(bundle.rationale.decision, "accept");
  assert.deepEqual(bundle.rationale.decisionFactors, ["low_latency_requirement", "resource_availability"]);
  assert.deepEqual(bundle.rationale.evidenceRefs, ["ev_001", "ev_002"]);
  assert.deepEqual(bundle.causalSummary, [
    "low_latency_requirement -> parallel_strategy: parallel reduces total time",
    "resource_availability -> parallel_strategy: enough workers to parallelize",
  ]);
  assert.equal(bundle.cacheKey, "task_explain_001:plan:L2");
  assert.ok(bundle.rendered.includes("plan: Selected parallel execution strategy"));
  const cached = service.getCached("task_explain_001:plan:L2");
  assert.equal(cached?.cacheKey, "task_explain_001:plan:L2");
  assert.equal(cached?.summary, "Selected parallel execution strategy");
});

test("ExplanationPipelineService filters evidence by allowed categories", () => {
  const service = new ExplanationPipelineService();
  const request = {
    taskId: "task_explain_002",
    stage: "execute",
    summary: "Executing tool sequence",
    decisionFactors: ["tool_availability"],
    evidence: [
      { evidenceId: "ev_public", category: "public", sourceRef: "src_1" },
      { evidenceId: "ev_internal", category: "internal", sourceRef: "src_2" },
      { evidenceId: "ev_restricted", category: "restricted", sourceRef: "src_3" },
    ],
    riskNotes: [],
  };
  const bundle = service.generate({
    ...request,
    allowedEvidenceCategories: ["public", "internal"],
  }, "L2");
  assert.deepEqual(bundle.rationale.evidenceRefs, ["ev_public", "ev_internal"]);
  assert.deepEqual(bundle.redactedEvidenceRefs, ["ev_restricted"]);
});

test("collectExplanationEvidenceIds extracts IDs from evidence items", () => {
  const evidence = [
    { evidenceId: "ev_1", category: "cat_1" },
    { evidenceId: "ev_2", category: "cat_2" },
    { evidenceId: "ev_3", category: "cat_1" },
  ];
  const ids = collectExplanationEvidenceIds(evidence);
  assert.deepEqual(ids, ["ev_1", "ev_2", "ev_3"]);
});

test("putExplanationCacheEntry stores and retrieves cache entries", () => {
  const cache: Record<string, { cacheKey: string; summary: string; ttlHours: 24 | 0 }> = {};
  const updated = putExplanationCacheEntry(cache, { cacheKey: "key_1", summary: "summary_1", ttlHours: 24 });
  assert.equal(updated["key_1"]?.summary, "summary_1");
  const updated2 = putExplanationCacheEntry(updated, { cacheKey: "key_2", summary: "summary_2", ttlHours: 24 });
  assert.equal(updated2["key_1"]?.summary, "summary_1");
  assert.equal(updated2["key_2"]?.summary, "summary_2");
});

test("buildCausalChainSummary produces readable chain summaries", () => {
  const links = [
    { source: "input_validated", target: "proceed_to_execute", rationale: "input passes all checks" },
    { source: "resource_available", target: "proceed_to_execute", rationale: "workers idle" },
  ];
  const summary = buildCausalChainSummary(links);
  assert.deepEqual(summary, [
    "input_validated -> proceed_to_execute: input passes all checks",
    "resource_available -> proceed_to_execute: workers idle",
  ]);
});

test("EdgeRuntimeSyncService executes offline tasks and builds sync envelopes", () => {
  const service = new EdgeRuntimeSyncService();
  const profile = {
    edgeNodeId: "edge_node_001",
    deviceId: "device_node_001",
    deviceAttestation: { attestedAt: "2026-04-23T00:00:00.000Z", status: "valid" as const },
    capabilities: ["bash", "edit"],
    connectivityMode: "offline" as const,
    maxLocalRetentionHours: 24,
    offlineMaxDuration: 86_400_000,
    keyLease: "lease_node_001",
    allowedModels: ["model_local_001", "model_local_002"],
    syncPolicy: { allowRestrictedDataUpload: false, requireOrdering: true },
    riskLevel: "low" as const,
  };
  const models = [
    { modelId: "model_local_001", modalities: ["text", "code"] as readonly string[], priority: 1 },
    { modelId: "model_local_002", modalities: ["text"] as readonly string[], priority: 2 },
  ];
  const offlineRequest = { edgeNodeId: "edge_node_001", taskId: "task_offline_001", modality: "code" };
  const receipt = service.executeOffline(profile, models, offlineRequest);
  assert.equal(receipt.record.edgeNodeId, "edge_node_001");
  assert.equal(receipt.record.taskId, "task_offline_001");
  assert.equal(receipt.record.syncRequired, true);
  assert.equal(receipt.selectedModelId, "model_local_001");
  assert.deepEqual(receipt.executionPlan, ["edge_node_task_offline_001"]);
  const completedRecord = completeOfflineExecution(receipt.record, "2026-04-23T10:00:00.000Z");
  assert.equal(completedRecord.status, "completed");
  assert.equal(completedRecord.completedAt, "2026-04-23T10:00:00.000Z");
  const envelope = service.buildSyncEnvelope(profile, completedRecord, "digest_payload_123", 2, "internal");
  assert.equal(envelope.edgeNodeId, "edge_node_001");
  assert.equal(envelope.priority, 2);
  assert.equal(envelope.dataClassification, "internal");
  assert.equal(envelope.payloadDigest, "digest_payload_123");
});

test("EdgeRuntimeSyncService rejects restricted data when policy denies", () => {
  const service = new EdgeRuntimeSyncService();
  const profile = {
    edgeNodeId: "edge_node_002",
    capabilities: [],
    connectivityMode: "offline" as const,
    maxLocalRetentionHours: 24,
    allowedModels: [],
    syncPolicy: { allowRestrictedDataUpload: false, requireOrdering: false },
  };
  const restrictedRecord = buildOfflineExecutionRecord("edge_node_002", "task_001", "2026-04-23T00:00:00.000Z");
  const internalRecord = buildOfflineExecutionRecord("edge_node_002", "task_002", "2026-04-23T01:00:00.000Z");
  const envelopes = [
    service.buildSyncEnvelope(profile, restrictedRecord, "digest_r_001", 1, "restricted", "2026-04-23T00:00:00.000Z"),
    service.buildSyncEnvelope(profile, internalRecord, "digest_i_001", 2, "internal", "2026-04-23T01:00:00.000Z"),
  ];
  const cloudDigests: Record<string, string> = {};
  const receipt = service.sync(profile, envelopes, cloudDigests);
  assert.deepEqual(receipt.rejectedEnvelopeIds, [envelopes[0]!.envelopeId]);
  assert.deepEqual(receipt.acceptedEnvelopeIds, [envelopes[1]!.envelopeId]);
  assert.equal(receipt.decisions[0]?.resolution, "reject");
  assert.equal(receipt.decisions[0]?.rationale, "edge.sync_policy_restricted_data_denied");
  assert.equal(receipt.decisions[1]?.resolution, "accept_edge");
});

test("EdgeRuntimeSyncService merges when cloud digest differs from edge digest", () => {
  const service = new EdgeRuntimeSyncService();
  const profile = {
    edgeNodeId: "edge_node_003",
    deviceId: "device_node_003",
    deviceAttestation: { attestedAt: "2026-04-23T00:00:00.000Z", status: "valid" as const },
    capabilities: [],
    connectivityMode: "online" as const,
    maxLocalRetentionHours: 24,
    offlineMaxDuration: 86_400_000,
    keyLease: "lease_node_003",
    allowedModels: [],
    syncPolicy: { allowRestrictedDataUpload: true, requireOrdering: false },
    riskLevel: "low" as const,
  };
  const record = buildOfflineExecutionRecord("edge_node_003", "task_101", "2026-04-23T00:00:00.000Z");
  const envelopes = [
    service.buildSyncEnvelope(profile, record, "edge_digest_v2", 1, "internal", "2026-04-23T00:00:00.000Z"),
  ];
  const cloudDigests = { [envelopes[0]!.recordId]: "cloud_digest_v1" };
  const receipt = service.sync(profile, envelopes, cloudDigests);
  assert.deepEqual(receipt.acceptedEnvelopeIds, [envelopes[0]!.envelopeId]);
  assert.equal(receipt.decisions[0]?.resolution, "merge");
  assert.equal(receipt.decisions[0]?.rationale, "edge.sync_conflict_merged");
});

test("buildEdgeExecutionPlan creates ordered execution plan with priority", () => {
  const plan = buildLegacyEdgeExecutionPlan(["task_1", "task_2", "task_3"], "high");
  assert.deepEqual(plan.orderedTaskIds, ["task_1", "task_2", "task_3"]);
  assert.equal(plan.syncRequired, true);
  assert.equal(plan.priority, "high");
  const planDefault = buildLegacyEdgeExecutionPlan(["task_a"]);
  assert.equal(planDefault.priority, "normal");
});

test("selectEdgeLocalModel selects highest priority model for modality", () => {
  const models = [
    { modelId: "model_text_v1", modalities: ["text", "code"] as readonly string[], priority: 1 },
    { modelId: "model_text_v2", modalities: ["text"] as readonly string[], priority: 3 },
    { modelId: "model_image_v1", modalities: ["image"] as readonly string[], priority: 2 },
  ];
  const selectedText = selectEdgeLocalModel(models, "text");
  assert.equal(selectedText?.modelId, "model_text_v2");
  const selectedCode = selectEdgeLocalModel(models, "code");
  assert.equal(selectedCode?.modelId, "model_text_v1");
  const selectedImage = selectEdgeLocalModel(models, "image");
  assert.equal(selectedImage?.modelId, "model_image_v1");
  const selectedAudio = selectEdgeLocalModel(models, "audio");
  assert.equal(selectedAudio, null);
});

test("orderEdgeSyncQueue orders envelopes by priority ascending", () => {
  const items = [
    { envelopeId: "env_low", priority: 1 },
    { envelopeId: "env_high", priority: 10 },
    { envelopeId: "env_med", priority: 5 },
  ];
  const ordered = orderEdgeSyncQueue(items);
  assert.deepEqual(ordered.map((item: { envelopeId: string }) => item.envelopeId), ["env_high", "env_med", "env_low"]);
});

test("EvolutionMvpService creates budget proposal in pending_approval status", () => {
  const workspace = createTempWorkspace("aa-evolution-");
  const dbPath = join(workspace, "evolution.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);
    const memoryService = new MemoryService(store);
    seedTaskAndExecution(db, store, {
      taskId: "task_budget_001",
      executionId: "exec_budget_001",
    });
    const service = new EvolutionMvpService(db, store, approvalService, memoryService);
    const result = service.proposeBudgetAdjustment({
      taskId: "task_budget_001",
      executionId: "exec_budget_001",
      sourceAgentId: "agent_optimizer",
      scopeType: "division",
      scopeRef: "coding",
      currentPolicy: {
        maxTaskCostUsd: 100,
        maxDailyCostUsd: 1000,
        maxMonthlyCostUsd: 5000,
        warnAtRatio: 0.8,
        mode: "supervised",
      },
      observedAverageCostUsd: 50,
      sampleSize: 20,
      successRate: 0.95,
      proposalReason: "observed lower than expected cost",
    });
    assert.equal(result.proposal.kind, "budget_adjustment");
    assert.equal(result.proposal.scopeType, "division");
    assert.equal(result.proposal.scopeRef, "coding");
    assert.equal(result.proposal.status, "pending_approval");
    assert.ok(result.approval);
    assert.ok(result.logs.length >= 1);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EvolutionMvpService resolves budget policy with base when no active override", () => {
  const workspace = createTempWorkspace("aa-evolution-resolve-");
  const dbPath = join(workspace, "evolution_resolve.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);
    const memoryService = new MemoryService(store);
    seedTaskAndExecution(db, store, {
      taskId: "task_budget_resolve_001",
      executionId: "exec_budget_resolve_001",
    });
    const service = new EvolutionMvpService(db, store, approvalService, memoryService);
    const basePolicy = {
      maxTaskCostUsd: 100,
      maxDailyCostUsd: 1000,
      maxMonthlyCostUsd: 5000,
      warnAtRatio: 0.8,
      mode: "supervised" as const,
    };
    const resolved = service.resolveBudgetPolicy(basePolicy, "division", "coding");
    assert.equal(resolved.policy.maxMonthlyCostUsd, 5000);
    assert.equal(resolved.sourceProposalId, null);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("buildOfflineExecutionRecord creates record with queued status", () => {
  const record = buildOfflineExecutionRecord("edge_001", "task_001", "2026-04-23T10:00:00.000Z");
  assert.equal(record.edgeNodeId, "edge_001");
  assert.equal(record.taskId, "task_001");
  assert.equal(record.createdAt, "2026-04-23T10:00:00.000Z");
  assert.equal(record.syncRequired, true);
  assert.equal(record.status, "queued");
});
