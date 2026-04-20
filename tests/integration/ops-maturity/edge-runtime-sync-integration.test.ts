import assert from "node:assert/strict";
import test from "node:test";

import { EdgeRuntimeSyncService } from "../../../src/ops-maturity/edge-runtime/edge-runtime-sync-service.js";

test("integration: offline execute reconnects through explicit sync ordering and policy enforcement", () => {
  const service = new EdgeRuntimeSyncService();
  const profile = {
    edgeNodeId: "edge_store_1",
    capabilities: ["text", "sync"],
    connectivityMode: "intermittent" as const,
    maxLocalRetentionHours: 12,
    allowedModels: ["local-text"],
    syncPolicy: {
      allowRestrictedDataUpload: false,
      requireOrdering: true,
    },
  };

  const execution = service.executeOffline(
    profile,
    [{ modelId: "local-text", modalities: ["text"] }],
    {
      edgeNodeId: "edge_store_1",
      taskId: "task_inventory_1",
      modality: "text",
      createdAt: "2026-04-20T00:00:00.000Z",
    },
  );
  const safeEnvelope = service.buildSyncEnvelope(
    profile,
    execution.record,
    "digest:safe",
    2,
    "internal",
    "2026-04-20T00:05:00.000Z",
  );
  const restrictedEnvelope = service.buildSyncEnvelope(
    profile,
    execution.record,
    "digest:restricted",
    3,
    "restricted",
    "2026-04-20T00:06:00.000Z",
  );

  const receipt = service.sync(profile, [safeEnvelope, restrictedEnvelope], {});
  assert.deepEqual(receipt.acceptedEnvelopeIds, [safeEnvelope.envelopeId]);
  assert.deepEqual(receipt.rejectedEnvelopeIds, [restrictedEnvelope.envelopeId]);
  assert.ok(receipt.decisions.some((item) => item.rationale === "edge.sync_policy_restricted_data_denied"));
});
