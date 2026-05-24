import assert from "node:assert/strict";
import test from "node:test";

import {
  EdgeRuntimeSyncService,
  type EdgeRuntimeProfile,
  type OfflineExecutionRequest,
  type SyncEnvelope,
} from "../../../src/ops-maturity/edge-runtime/edge-runtime-sync-service.js";

function makeTestProfile(overrides: Partial<EdgeRuntimeProfile> = {}): EdgeRuntimeProfile {
  return {
    edgeNodeId: "edge-001",
    deviceId: "device-001",
    deviceAttestation: {
      attestedAt: "2026-04-20T00:00:00.000Z",
      status: "valid",
    },
    capabilities: ["offline", "compute"],
    connectivityMode: "offline",
    maxLocalRetentionHours: 24,
    offlineMaxDuration: 3600000,
    keyLease: "lease-001",
    certificateStatus: "valid",
    allowedModels: ["gpt-4o-mini"],
    riskLevel: "low",
    syncPolicy: {
      allowRestrictedDataUpload: false,
      requireOrdering: true,
    },
    ...overrides,
  };
}

test("EdgeRuntimeSyncService executeOffline creates execution record", async () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeTestProfile();
  const request: OfflineExecutionRequest = {
    edgeNodeId: "edge-001",
    taskId: "task-001",
    modality: "text",
    riskScore: 0.2,
    taskType: "summarize",
  };

  const receipt = service.executeOffline(profile, [], request);

  assert.ok(receipt.record != null);
  assert.equal(receipt.record.edgeNodeId, "edge-001");
  assert.equal(receipt.record.taskId, "task-001");
  assert.ok(receipt.planGraphNodeIds.length > 0);
});

test("EdgeRuntimeSyncService executeOffline rejects high risk profile", async () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeTestProfile({ riskLevel: "high" });
  const request: OfflineExecutionRequest = {
    edgeNodeId: "edge-001",
    taskId: "task-001",
    modality: "text",
    riskScore: 0.2,
    taskType: "summarize",
  };

  assert.throws(
    () => service.executeOffline(profile, [], request),
    (err: Error) => err.message.includes("risk_level_not_allowed")
  );
});

test("EdgeRuntimeSyncService executeOffline allows medium risk profile", async () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeTestProfile({ riskLevel: "medium" });
  const request: OfflineExecutionRequest = {
    edgeNodeId: "edge-001",
    taskId: "task-001",
    modality: "text",
    riskScore: 0.2,
    taskType: "summarize",
  };

  const receipt = service.executeOffline(profile, [], request);

  assert.equal(receipt.record.taskId, "task-001");
});

test("EdgeRuntimeSyncService executeOffline rejects profile missing required fields", async () => {
  const service = new EdgeRuntimeSyncService();
  const {
    deviceId: _deviceId,
    offlineMaxDuration: _offlineMaxDuration,
    keyLease: _keyLease,
    ...profile
  } = makeTestProfile();
  const request: OfflineExecutionRequest = {
    edgeNodeId: "edge-001",
    taskId: "task-001",
    modality: "text",
    riskScore: 0.2,
    taskType: "summarize",
  };

  assert.throws(
    () => service.executeOffline(profile, [], request),
    (err: Error) => err.message.includes("missing_required_profile_fields")
  );
});

test("EdgeRuntimeSyncService executeOffline rejects stale offline execution window", async () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeTestProfile({ offlineMaxDuration: 1_000 });
  const request: OfflineExecutionRequest = {
    edgeNodeId: "edge-001",
    taskId: "task-001",
    modality: "text",
    createdAt: "2020-01-01T00:00:00.000Z",
    riskScore: 0.2,
    taskType: "summarize",
  };

  assert.throws(
    () => service.executeOffline(profile, [], request),
    (err: Error) => err.message.includes("offline_window_exceeded")
  );
});

test("EdgeRuntimeSyncService buildSyncEnvelope creates valid envelope", async () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeTestProfile();

  const envelope = service.buildSyncEnvelope(
    profile,
    { edgeNodeId: "edge-001", taskId: "task-001", createdAt: new Date().toISOString(), syncRequired: true, status: "queued" },
    "payload-digest-hash",
    1,
    "internal"
  );

  assert.ok(envelope.envelopeId.startsWith("sync_"));
  assert.equal(envelope.edgeNodeId, "edge-001");
  assert.equal(envelope.priority, 1);
  assert.equal(envelope.dataClassification, "internal");
  assert.ok(envelope.signature.length > 0);
});

test("EdgeRuntimeSyncService sync accepts valid envelopes", async () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeTestProfile();

  const envelope = service.buildSyncEnvelope(
    profile,
    { edgeNodeId: "edge-001", taskId: "task-001", createdAt: new Date().toISOString(), syncRequired: true, status: "queued" },
    "abc123",
    1,
    "internal"
  );

  const receipt = service.sync(profile, [envelope], { [envelope.recordId]: "abc123" });

  assert.ok(receipt.acceptedEnvelopeIds.includes(envelope.envelopeId));
  assert.equal(receipt.rejectedEnvelopeIds.length, 0);
});

test("EdgeRuntimeSyncService sync rejects restricted data when not allowed", async () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeTestProfile({ syncPolicy: { allowRestrictedDataUpload: false, requireOrdering: true } });

  const envelope = service.buildSyncEnvelope(
    profile,
    { edgeNodeId: "edge-001", taskId: "task-001", createdAt: new Date().toISOString(), syncRequired: true, status: "queued" },
    "abc123",
    1,
    "restricted"
  );

  const receipt = service.sync(profile, [envelope], {});

  assert.ok(receipt.rejectedEnvelopeIds.includes(envelope.envelopeId));
  assert.ok(receipt.decisions[0]?.resolution, "reject");
});

test("EdgeRuntimeSyncService sync applies central wins policy on digest mismatch", async () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeTestProfile();

  const envelope = service.buildSyncEnvelope(
    profile,
    { edgeNodeId: "edge-001", taskId: "task-001", createdAt: new Date().toISOString(), syncRequired: true, status: "queued" },
    "abc123",
    1,
    "internal"
  );

  const receipt = service.sync(profile, [envelope], { [envelope.recordId]: "different-digest" });

  assert.ok(receipt.acceptedEnvelopeIds.includes(envelope.envelopeId));
  const decision = receipt.decisions.find((d) => d.envelopeId === envelope.envelopeId);
  assert.ok(decision != null);
  assert.equal(decision?.resolution, "merge");
  assert.ok(decision?.incidentId != null);
  assert.ok(decision?.mergedPayload != null);
});

test("EdgeRuntimeSyncService sync respects ordering when requireOrdering is true", async () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeTestProfile({ syncPolicy: { allowRestrictedDataUpload: false, requireOrdering: true } });

  const envelope1 = service.buildSyncEnvelope(
    profile,
    { edgeNodeId: "edge-001", taskId: "task-001", createdAt: new Date().toISOString(), syncRequired: true, status: "queued" },
    "abc123",
    1,
    "internal"
  );
  const envelope2 = service.buildSyncEnvelope(
    profile,
    { edgeNodeId: "edge-001", taskId: "task-002", createdAt: new Date().toISOString(), syncRequired: true, status: "queued" },
    "def456",
    5,
    "internal"
  );

  const receipt = service.sync(profile, [envelope1, envelope2], { "rec-001": "abc123", "rec-002": "def456" });

  assert.deepEqual(receipt.acceptedEnvelopeIds, [envelope2.envelopeId, envelope1.envelopeId]);
});

test("EdgeRuntimeSyncService sync skips ordering when requireOrdering is false", async () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeTestProfile({ syncPolicy: { allowRestrictedDataUpload: false, requireOrdering: false } });

  const envelope1 = service.buildSyncEnvelope(
    profile,
    { edgeNodeId: "edge-001", taskId: "task-001", createdAt: new Date().toISOString(), syncRequired: true, status: "queued" },
    "abc123",
    1,
    "internal"
  );

  const receipt = service.sync(profile, [envelope1], { "rec-001": "abc123" });

  assert.ok(receipt.acceptedEnvelopeIds.includes(envelope1.envelopeId));
});

test("EdgeRuntimeSyncService executeOffline rejects invalid device attestation", async () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeTestProfile({
    deviceAttestation: {
      attestedAt: "2026-04-20T00:00:00.000Z",
      status: "revoked",
    },
  });

  assert.throws(
    () => service.executeOffline(profile, [], { edgeNodeId: "edge-001", taskId: "task-001", modality: "text" }),
    (err: Error) => err.message.includes("device_attestation_invalid")
  );
});

test("EdgeRuntimeSyncService executeControlCommand handles quarantine and remote wipe", async () => {
  const service = new EdgeRuntimeSyncService();
  const profile = makeTestProfile({ connectivityMode: "online" });

  const quarantineReceipt = service.executeControlCommand(profile, {
    commandId: "cmd-1",
    edgeNodeId: "edge-001",
    action: "edge_quarantine",
    reason: "suspected_compromise",
    requestedBy: "secops",
    requestedAt: "2026-04-20T00:00:00.000Z",
  });
  const wipeReceipt = service.executeControlCommand(profile, {
    commandId: "cmd-2",
    edgeNodeId: "edge-001",
    action: "remote_wipe",
    reason: "device_lost",
    requestedBy: "secops",
    requestedAt: "2026-04-20T00:00:00.000Z",
  });

  assert.equal(quarantineReceipt.resultingConnectivityMode, "offline");
  assert.equal(wipeReceipt.action, "remote_wipe");
});
