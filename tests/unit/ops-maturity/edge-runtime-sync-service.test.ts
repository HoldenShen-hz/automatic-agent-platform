import assert from "node:assert/strict";
import test from "node:test";

import { EdgeRuntimeSyncService } from "../../../src/ops-maturity/edge-runtime/edge-runtime-sync-service.js";

const profile = {
  edgeNodeId: "edge_factory_1",
  deviceId: "device_factory_1",
  capabilities: ["vision", "sync"],
  connectivityMode: "offline" as const,
  maxLocalRetentionHours: 24,
  offlineMaxDuration: 60 * 60 * 1000,
  keyLease: "lease_edge_factory_1",
  deviceAttestation: {
    attestedAt: "2026-04-20T00:00:00.000Z",
    status: "valid" as const,
  },
  allowedModels: ["local-vision"],
  riskLevel: "low" as const,
  syncPolicy: {
    allowRestrictedDataUpload: false,
    requireOrdering: true,
  },
};

test("EdgeRuntimeSyncService executes offline with an allowed local model and explicit sync envelope", () => {
  const service = new EdgeRuntimeSyncService();
  const createdAt = new Date().toISOString();
  const execution = service.executeOffline(
    profile,
    [{ modelId: "local-vision", modalities: ["image", "text"] }],
    {
      edgeNodeId: "edge_factory_1",
      taskId: "task_vision_1",
      modality: "image",
      createdAt,
    },
  );

  assert.equal(execution.record.syncRequired, true);
  assert.equal(execution.selectedModelId, "local-vision");
  assert.deepEqual(execution.executionPlan, ["edge_node_task_vision_1"]);

  const envelope = service.buildSyncEnvelope(
    profile,
    execution.record,
    "digest:vision:1",
    3,
    "internal",
    "2026-04-20T00:05:00.000Z",
  );
  assert.equal(envelope.edgeNodeId, "edge_factory_1");
  assert.equal(envelope.dataClassification, "internal");
});

test("EdgeRuntimeSyncService rejects restricted uploads when sync policy forbids them and resolves conflicts explicitly", () => {
  const service = new EdgeRuntimeSyncService();
  const record = {
    edgeNodeId: "edge_factory_1",
    taskId: "task_sync_1",
    createdAt: "2026-04-20T00:00:00.000Z",
    syncRequired: true,
    status: "queued" as const,
  };

  const restrictedEnvelope = service.buildSyncEnvelope(
    profile,
    record,
    "digest:restricted",
    5,
    "restricted",
    "2026-04-20T00:10:00.000Z",
  );
  const conflictEnvelope = service.buildSyncEnvelope(
    profile,
    record,
    "digest:newer",
    1,
    "internal",
    "2026-04-20T00:11:00.000Z",
  );

  const receipt = service.sync(profile, [restrictedEnvelope, conflictEnvelope], {
    [conflictEnvelope.recordId]: "digest:older",
  });

  assert.deepEqual(receipt.rejectedEnvelopeIds, [restrictedEnvelope.envelopeId]);
  assert.deepEqual(receipt.acceptedEnvelopeIds, [conflictEnvelope.envelopeId]);
  assert.ok(receipt.decisions.some((item) => item.resolution === "merge"));
});
