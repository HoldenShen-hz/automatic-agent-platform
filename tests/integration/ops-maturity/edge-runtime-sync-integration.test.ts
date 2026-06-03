import assert from "node:assert/strict";
import test from "node:test";

import { EdgeRuntimeSyncService } from "../../../src/ops-maturity/edge-runtime/edge-runtime-sync-service.js";

function recentIso(offsetMs = 60_000): string {
  return new Date(Date.now() - offsetMs).toISOString();
}

test("integration: offline execute reconnects through explicit sync ordering and policy enforcement", () => {
  const service = new EdgeRuntimeSyncService();
  const createdAt = recentIso(5 * 60_000);
  const profile = {
    edgeNodeId: "edge_store_1",
    deviceId: "device_store_1",
    deviceAttestation: { attestedAt: recentIso(), status: "valid" as const },
    capabilities: ["text", "sync"],
    connectivityMode: "intermittent" as const,
    maxLocalRetentionHours: 12,
    offlineMaxDuration: 60 * 24 * 60 * 60 * 1000,
    keyLease: "lease_store_1",
    allowedModels: ["local-text"],
    syncPolicy: {
      allowRestrictedDataUpload: false,
      requireOrdering: true,
    },
    riskLevel: "low" as const,
  };

  const execution = service.executeOffline(
    profile,
    [{ modelId: "local-text", modalities: ["text"] }],
    {
      edgeNodeId: "edge_store_1",
      taskId: "task_inventory_1",
      modality: "text",
      createdAt,
      riskScore: 0.2,
      taskType: "summarize",
    },
  );
  const safeEnvelope = service.buildSyncEnvelope(
    profile,
    execution.record,
    "digest:safe",
    2,
    "internal",
    recentIso(4 * 60_000),
  );
  const restrictedEnvelope = service.buildSyncEnvelope(
    profile,
    execution.record,
    "digest:restricted",
    3,
    "restricted",
    recentIso(3 * 60_000),
  );

  const receipt = service.sync(profile, [safeEnvelope, restrictedEnvelope], {});
  assert.deepEqual(receipt.acceptedEnvelopeIds, [safeEnvelope.envelopeId]);
  assert.deepEqual(receipt.rejectedEnvelopeIds, [restrictedEnvelope.envelopeId]);
  assert.ok(receipt.decisions.some((item) => item.rationale === "edge.sync_policy_restricted_data_denied"));
});
