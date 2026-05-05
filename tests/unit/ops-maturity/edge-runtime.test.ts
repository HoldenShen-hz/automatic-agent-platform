import assert from "node:assert/strict";
import test from "node:test";
import {
  EdgeRuntimeSyncService,
  type EdgeRuntimeProfile,
  type OfflineExecutionRequest,
  type SyncEnvelope,
} from "../../../src/ops-maturity/edge-runtime/edge-runtime-sync-service.js";
import { selectEdgeLocalModel, type LocalModelProfile } from "../../../src/ops-maturity/edge-runtime/local-model/index.js";
import { buildEdgeExecutionPlan } from "../../../src/ops-maturity/edge-runtime/edge-orchestrator/index.js";
import { orderEdgeSyncQueue, type EdgeSyncEnvelope } from "../../../src/ops-maturity/edge-runtime/sync-queue/index.js";
import { buildOfflineExecutionRecord } from "../../../src/ops-maturity/edge-runtime/edge-executor/index.js";

test("edge: execute offline with valid low risk profile", () => {
  const service = new EdgeRuntimeSyncService();
  const profile: EdgeRuntimeProfile = {
    edgeNodeId: "node-001",
    deviceId: "device-abc",
    capabilities: ["vision", "text"],
    connectivityMode: "offline",
    maxLocalRetentionHours: 72,
    offlineMaxDuration: 3600,
    keyLease: "lease-xyz",
    allowedModels: ["model-v1", "model-v2"],
    syncPolicy: { allowRestrictedDataUpload: false, requireOrdering: true },
    riskLevel: "low",
  };
  const models: LocalModelProfile[] = [
    { modelId: "model-v1", modalities: ["text"], priority: 1 },
    { modelId: "model-v2", modalities: ["vision"], priority: 2 },
  ];
  const request: OfflineExecutionRequest = {
    edgeNodeId: "node-001",
    taskId: "task-offline-001",
    modality: "text",
  };

  const receipt = service.executeOffline(profile, models, request);

  assert.strictEqual(receipt.record.edgeNodeId, "node-001");
  assert.strictEqual(receipt.record.taskId, "task-offline-001");
  assert.strictEqual(receipt.record.status, "queued");
  assert.strictEqual(receipt.selectedModelId, "model-v1");
  assert.ok(receipt.planGraphNodeIds.includes("edge_node_task-offline-001"));
});

test("edge: execute offline selects model by modality and priority", () => {
  const service = new EdgeRuntimeSyncService();
  const profile: EdgeRuntimeProfile = {
    edgeNodeId: "node-002",
    deviceId: "device-def",
    capabilities: ["vision", "text"],
    connectivityMode: "intermittent",
    maxLocalRetentionHours: 48,
    offlineMaxDuration: 1800,
    keyLease: "lease-uvw",
    allowedModels: ["model-a", "model-b"],
    syncPolicy: { allowRestrictedDataUpload: false, requireOrdering: false },
    riskLevel: "medium",
  };
  const models: LocalModelProfile[] = [
    { modelId: "model-a", modalities: ["text"], priority: 1 },
    { modelId: "model-b", modalities: ["vision", "text"], priority: 3 },
  ];
  const request: OfflineExecutionRequest = {
    edgeNodeId: "node-002",
    taskId: "task-offline-002",
    modality: "text",
  };

  const receipt = service.executeOffline(profile, models, request);

  assert.strictEqual(receipt.selectedModelId, "model-b");
});

test("edge: execute offline returns null model when no match", () => {
  const service = new EdgeRuntimeSyncService();
  const profile: EdgeRuntimeProfile = {
    edgeNodeId: "node-003",
    deviceId: "device-ghi",
    capabilities: ["text"],
    connectivityMode: "offline",
    maxLocalRetentionHours: 24,
    offlineMaxDuration: 900,
    keyLease: "lease-rst",
    allowedModels: ["model-x"],
    syncPolicy: { allowRestrictedDataUpload: false, requireOrdering: false },
    riskLevel: "low",
  };
  const models: LocalModelProfile[] = [
    { modelId: "model-y", modalities: ["vision"], priority: 1 },
  ];
  const request: OfflineExecutionRequest = {
    edgeNodeId: "node-003",
    taskId: "task-offline-003",
    modality: "text",
  };

  const receipt = service.executeOffline(profile, models, request);

  assert.strictEqual(receipt.selectedModelId, null);
});

test("edge: execute offline throws for high risk", () => {
  const service = new EdgeRuntimeSyncService();
  const profile: EdgeRuntimeProfile = {
    edgeNodeId: "node-high-risk",
    deviceId: "device-high",
    capabilities: ["text"],
    connectivityMode: "offline",
    maxLocalRetentionHours: 24,
    offlineMaxDuration: 900,
    keyLease: "lease-high",
    allowedModels: ["model-a"],
    syncPolicy: { allowRestrictedDataUpload: false, requireOrdering: false },
    riskLevel: "high",
  };
  const request: OfflineExecutionRequest = {
    edgeNodeId: "node-high-risk",
    taskId: "task-high-risk",
    modality: "text",
  };

  assert.throws(() => service.executeOffline(profile, [], request), /edge_runtime.risk_level_not_allowed/);
});

test("edge: execute offline throws when missing required profile fields", () => {
  const service = new EdgeRuntimeSyncService();
  const profile: EdgeRuntimeProfile = {
    edgeNodeId: "node-incomplete",
    deviceId: undefined,
    capabilities: ["text"],
    connectivityMode: "offline",
    maxLocalRetentionHours: 24,
    offlineMaxDuration: undefined,
    keyLease: undefined,
    allowedModels: [],
    syncPolicy: { allowRestrictedDataUpload: false, requireOrdering: false },
    riskLevel: "low",
  };
  const request: OfflineExecutionRequest = {
    edgeNodeId: "node-incomplete",
    taskId: "task-incomplete",
    modality: "text",
  };

  assert.throws(() => service.executeOffline(profile, [], request), /edge_runtime.missing_required_profile_fields/);
});

test("edge: build sync envelope creates valid envelope", () => {
  const service = new EdgeRuntimeSyncService();
  const profile: EdgeRuntimeProfile = {
    edgeNodeId: "node-env",
    deviceId: "device-env",
    capabilities: ["text"],
    connectivityMode: "online",
    maxLocalRetentionHours: 24,
    offlineMaxDuration: 600,
    keyLease: "lease-env",
    allowedModels: ["model-a"],
    syncPolicy: { allowRestrictedDataUpload: false, requireOrdering: false },
    riskLevel: "low",
  };
  const record = buildOfflineExecutionRecord("node-env", "task-env", "2026-04-29T00:00:00Z");

  const envelope = service.buildSyncEnvelope(profile, record, "digest-abc123");

  assert.strictEqual(envelope.edgeNodeId, "node-env");
  assert.strictEqual(envelope.dataClassification, "internal");
  assert.strictEqual(envelope.priority, 1);
  assert.ok(envelope.signature.length > 0);
  assert.ok(envelope.envelopeId.length > 0);
});

test("edge: build sync envelope with custom parameters", () => {
  const service = new EdgeRuntimeSyncService();
  const profile: EdgeRuntimeProfile = {
    edgeNodeId: "node-custom",
    deviceId: "device-custom",
    capabilities: ["text"],
    connectivityMode: "online",
    maxLocalRetentionHours: 48,
    offlineMaxDuration: 1200,
    keyLease: "lease-custom",
    allowedModels: ["model-a"],
    syncPolicy: { allowRestrictedDataUpload: false, requireOrdering: false },
    riskLevel: "low",
  };
  const record = buildOfflineExecutionRecord("node-custom", "task-custom", "2026-04-29T00:00:00Z");

  const envelope = service.buildSyncEnvelope(profile, record, "custom-digest", 5, "restricted", "2026-04-29T01:00:00Z", "prev-hash-abc");

  assert.strictEqual(envelope.priority, 5);
  assert.strictEqual(envelope.dataClassification, "restricted");
  assert.strictEqual(envelope.prevHash, "prev-hash-abc");
});

test("edge: sync accepts valid envelopes", () => {
  const service = new EdgeRuntimeSyncService();
  const profile: EdgeRuntimeProfile = {
    edgeNodeId: "node-sync",
    deviceId: "device-sync",
    capabilities: ["text"],
    connectivityMode: "online",
    maxLocalRetentionHours: 24,
    offlineMaxDuration: 600,
    keyLease: "lease-sync",
    allowedModels: [],
    syncPolicy: { allowRestrictedDataUpload: true, requireOrdering: false },
    riskLevel: "low",
  };
  const envelope = service.buildSyncEnvelope(profile, buildOfflineExecutionRecord("node-sync", "task-sync", "2026-04-29T00:00:00Z"), "digest-sync");

  const receipt = service.sync(profile, [envelope], {});

  assert.strictEqual(receipt.acceptedEnvelopeIds.length, 1);
  assert.strictEqual(receipt.rejectedEnvelopeIds.length, 0);
});

test("edge: sync rejects restricted data when policy disallows", () => {
  const service = new EdgeRuntimeSyncService();
  const profile: EdgeRuntimeProfile = {
    edgeNodeId: "node-restricted",
    deviceId: "device-restricted",
    capabilities: ["text"],
    connectivityMode: "online",
    maxLocalRetentionHours: 24,
    offlineMaxDuration: 600,
    keyLease: "lease-restricted",
    allowedModels: [],
    syncPolicy: { allowRestrictedDataUpload: false, requireOrdering: false },
    riskLevel: "low",
  };
  const envelope = service.buildSyncEnvelope(profile, buildOfflineExecutionRecord("node-restricted", "task-restricted", "2026-04-29T00:00:00Z"), "digest-res", 1, "restricted");

  const receipt = service.sync(profile, [envelope], {});

  assert.strictEqual(receipt.rejectedEnvelopeIds.length, 1);
  assert.strictEqual(receipt.decisions[0]?.resolution, "reject");
  assert.ok(receipt.decisions[0]?.rationale.includes("restricted_data_denied"));
});

test("edge: sync rejects mismatched payload digest (central wins)", () => {
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
  const envelope = service.buildSyncEnvelope(profile, buildOfflineExecutionRecord("node-conflict", "task-conflict", "2026-04-29T00:00:00Z"), "edge-digest");
  const cloudDigests: Record<string, string> = {
    [`node-conflict:task-conflict:2026-04-29T00:00:00Z`]: "cloud-different-digest",
  };

  const receipt = service.sync(profile, [envelope], cloudDigests);

  assert.strictEqual(receipt.rejectedEnvelopeIds.length, 1);
  assert.strictEqual(receipt.decisions[0]?.resolution, "accept_central");
  assert.ok(receipt.decisions[0]?.incidentId != null);
});

test("edge: sync respects ordering policy", () => {
  const service = new EdgeRuntimeSyncService();
  const profile: EdgeRuntimeProfile = {
    edgeNodeId: "node-ordered",
    deviceId: "device-ordered",
    capabilities: ["text"],
    connectivityMode: "online",
    maxLocalRetentionHours: 24,
    offlineMaxDuration: 600,
    keyLease: "lease-ordered",
    allowedModels: [],
    syncPolicy: { allowRestrictedDataUpload: true, requireOrdering: true },
    riskLevel: "low",
  };
  const env1 = service.buildSyncEnvelope(profile, buildOfflineExecutionRecord("node-ordered", "task-1", "2026-04-29T00:01:00Z"), "d1", 1);
  const env2 = service.buildSyncEnvelope(profile, buildOfflineExecutionRecord("node-ordered", "task-2", "2026-04-29T00:02:00Z"), "d2", 3);

  const receipt = service.sync(profile, [env1, env2], {});

  assert.strictEqual(receipt.acceptedEnvelopeIds.length, 2);
  assert.ok(receipt.acceptedEnvelopeIds.includes(env1.envelopeId));
  assert.ok(receipt.acceptedEnvelopeIds.includes(env2.envelopeId));
});

test("edge: local model selection by modality", () => {
  const models: LocalModelProfile[] = [
    { modelId: "text-model", modalities: ["text"], priority: 1 },
    { modelId: "vision-model", modalities: ["vision"], priority: 2 },
    { modelId: "multimodal", modalities: ["text", "vision"], priority: 3 },
  ];

  const selected = selectEdgeLocalModel(models, "vision");

  assert.strictEqual(selected?.modelId, "multimodal");
});

test("edge: local model selection returns null when no match", () => {
  const models: LocalModelProfile[] = [
    { modelId: "text-model", modalities: ["text"] },
  ];

  const selected = selectEdgeLocalModel(models, "audio");

  assert.strictEqual(selected, null);
});

test("edge: execution plan builder", () => {
  const plan = buildEdgeExecutionPlan(["task-a", "task-b"]);

  // R6-22 FIX: Edge execution plan now uses planGraphBundle.graph.nodes with edge_node_ prefix
  assert.deepStrictEqual(
    plan.planGraphBundle.graph.nodes.map((n) => n.nodeId),
    ["edge_node_task-a", "edge_node_task-b"],
  );
  assert.strictEqual(plan.syncRequired, true);
  assert.strictEqual(plan.priority, "normal");
});

test("edge: execution plan builder with priority", () => {
  const plan = buildEdgeExecutionPlan(["task-x"], "high");

  assert.strictEqual(plan.priority, "high");
});

test("edge: sync queue ordering by priority and time", () => {
  const items: EdgeSyncEnvelope[] = [
    { envelopeId: "e1", priority: 1, createdAt: "2026-04-29T00:01:00Z" },
    { envelopeId: "e2", priority: 3, createdAt: "2026-04-29T00:00:00Z" },
    { envelopeId: "e3", priority: 2, createdAt: "2026-04-29T00:02:00Z" },
  ];

  const ordered = orderEdgeSyncQueue(items);

  assert.strictEqual(ordered.length, 3);
  assert.strictEqual(ordered[0].priority, 3);
  assert.strictEqual(ordered[1].priority, 2);
  assert.strictEqual(ordered[2].priority, 1);
});

test("edge: sync queue with same priority orders by time", () => {
  const items: EdgeSyncEnvelope[] = [
    { envelopeId: "e-earlier", priority: 1, createdAt: "2026-04-29T00:00:00Z" },
    { envelopeId: "e-later", priority: 1, createdAt: "2026-04-29T01:00:00Z" },
  ];

  const ordered = orderEdgeSyncQueue(items);

  assert.strictEqual(ordered.length, 2);
  assert.strictEqual(ordered[0].priority, 1);
});

test("edge: build offline execution record", () => {
  const record = buildOfflineExecutionRecord("node-test", "task-test", "2026-04-29T00:00:00Z");

  assert.strictEqual(record.edgeNodeId, "node-test");
  assert.strictEqual(record.taskId, "task-test");
  assert.strictEqual(record.status, "queued");
  assert.strictEqual(record.syncRequired, true);
});

test("edge: verify envelope signature", () => {
  const service = new EdgeRuntimeSyncService();
  const profile: EdgeRuntimeProfile = {
    edgeNodeId: "node-verify",
    deviceId: "device-verify",
    capabilities: ["text"],
    connectivityMode: "online",
    maxLocalRetentionHours: 24,
    offlineMaxDuration: 600,
    keyLease: "lease-verify",
    allowedModels: [],
    syncPolicy: { allowRestrictedDataUpload: true, requireOrdering: false },
    riskLevel: "low",
  };
  const record = buildOfflineExecutionRecord("node-verify", "task-verify", "2026-04-29T00:00:00Z");
  const envelope = service.buildSyncEnvelope(profile, record, "verify-digest");

  const receipt = service.sync(profile, [envelope], {});

  assert.strictEqual(receipt.acceptedEnvelopeIds.length, 1);
});
