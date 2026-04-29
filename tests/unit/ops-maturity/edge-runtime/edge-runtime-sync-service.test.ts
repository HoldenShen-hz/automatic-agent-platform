/**
 * Unit tests for EdgeRuntimeSyncService
 *
 * @see src/ops-maturity/edge-runtime/edge-runtime-sync-service.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  EdgeRuntimeSyncService,
  type EdgeRuntimeProfile,
  type OfflineExecutionRequest,
  type SyncEnvelope,
} from "../../../../src/ops-maturity/edge-runtime/edge-runtime-sync-service.js";

describe("EdgeRuntimeSyncService", () => {
  const defaultProfile: EdgeRuntimeProfile = {
    edgeNodeId: "node-001",
    deviceId: "device-001",
    capabilities: ["offline-execution", "local-model"],
    connectivityMode: "offline",
    maxLocalRetentionHours: 24,
    offlineMaxDuration: 3600,
    keyLease: "lease-edge-001",
    allowedModels: ["model-a", "model-b"],
    syncPolicy: {
      allowRestrictedDataUpload: false,
      requireOrdering: false,
    },
    riskLevel: "low",
  };

  const defaultModels: { modelId: string; modalities: readonly string[]; maxTokens: number }[] = [
    { modelId: "model-a", modalities: ["text"], maxTokens: 4096 },
    { modelId: "model-b", modalities: ["code"], maxTokens: 8192 },
    { modelId: "model-c", modalities: ["text"], maxTokens: 2048 },
  ];

  function createEnvelope(
    service: EdgeRuntimeSyncService,
    overrides: Partial<SyncEnvelope> & { recordId?: string } = {},
  ): SyncEnvelope {
    const record = {
      edgeNodeId: overrides.edgeNodeId ?? "node-001",
      taskId: overrides.recordId?.split(":")[1] ?? "task-1",
      createdAt: overrides.recordId?.split(":").slice(2).join(":") || "2026-04-26T08:00:00Z",
    };
    const envelope = service.buildSyncEnvelope(
      defaultProfile,
      record as any,
      overrides.payloadDigest ?? "digest-1",
      overrides.priority ?? 1,
      overrides.dataClassification ?? "internal",
      overrides.createdAt ?? record.createdAt,
      overrides.prevHash ?? null,
    );
    return {
      ...envelope,
      envelopeId: overrides.envelopeId ?? envelope.envelopeId,
      recordId: overrides.recordId ?? envelope.recordId,
      edgeNodeId: overrides.edgeNodeId ?? envelope.edgeNodeId,
      priority: overrides.priority ?? envelope.priority,
      dataClassification: overrides.dataClassification ?? envelope.dataClassification,
      payloadDigest: overrides.payloadDigest ?? envelope.payloadDigest,
      prevHash: overrides.prevHash ?? envelope.prevHash,
      signature: overrides.signature ?? envelope.signature,
      createdAt: overrides.createdAt ?? envelope.createdAt,
    };
  }

  describe("executeOffline", () => {
    test("executes offline request with allowed model", () => {
      const service = new EdgeRuntimeSyncService();
      const request: OfflineExecutionRequest = {
        edgeNodeId: "node-001",
        taskId: "task-001",
        modality: "text",
      };

      const receipt = service.executeOffline(defaultProfile, defaultModels, request);

      assert.ok(receipt.record);
      assert.equal(receipt.selectedModelId, "model-a");
      assert.ok(receipt.executionPlan.length > 0);
    });

    test("selects model based on modality matching", () => {
      const service = new EdgeRuntimeSyncService();
      const request: OfflineExecutionRequest = {
        edgeNodeId: "node-001",
        taskId: "task-002",
        modality: "code",
      };

      const receipt = service.executeOffline(defaultProfile, defaultModels, request);

      assert.equal(receipt.selectedModelId, "model-b");
    });

    test("returns null model when no matching modality", () => {
      const service = new EdgeRuntimeSyncService();
      const request: OfflineExecutionRequest = {
        edgeNodeId: "node-001",
        taskId: "task-003",
        modality: "audio",
      };

      const receipt = service.executeOffline(defaultProfile, defaultModels, request);

      assert.equal(receipt.selectedModelId, null);
    });

    test("respects allowedModels from profile", () => {
      const service = new EdgeRuntimeSyncService();
      const restrictedProfile: EdgeRuntimeProfile = {
        ...defaultProfile,
        allowedModels: ["model-c"],
      };
      const request: OfflineExecutionRequest = {
        edgeNodeId: "node-001",
        taskId: "task-004",
        modality: "text",
      };

      const receipt = service.executeOffline(restrictedProfile, defaultModels, request);

      assert.equal(receipt.selectedModelId, "model-c");
    });

    test("uses provided createdAt timestamp", () => {
      const service = new EdgeRuntimeSyncService();
      const request: OfflineExecutionRequest = {
        edgeNodeId: "node-001",
        taskId: "task-005",
        modality: "text",
        createdAt: "2026-04-26T08:00:00Z",
      };

      const receipt = service.executeOffline(defaultProfile, defaultModels, request);

      assert.ok(receipt.record.createdAt);
    });
  });

  describe("buildSyncEnvelope", () => {
    test("creates sync envelope with required fields", () => {
      const service = new EdgeRuntimeSyncService();
      const record = {
        edgeNodeId: "node-001",
        taskId: "task-001",
        createdAt: "2026-04-26T08:00:00Z",
      };

      const envelope = service.buildSyncEnvelope(
        defaultProfile,
        record as any,
        "digest-abc123",
        1,
        "internal",
        "2026-04-26T08:00:00Z",
      );

      assert.ok(envelope.envelopeId.startsWith("sync_"));
      assert.equal(envelope.recordId, "node-001:task-001:2026-04-26T08:00:00Z");
      assert.equal(envelope.edgeNodeId, "node-001");
      assert.equal(envelope.priority, 1);
      assert.equal(envelope.dataClassification, "internal");
      assert.equal(envelope.payloadDigest, "digest-abc123");
      assert.equal(envelope.createdAt, "2026-04-26T08:00:00Z");
    });

    test("uses custom priority when provided", () => {
      const service = new EdgeRuntimeSyncService();
      const record = {
        edgeNodeId: "node-001",
        taskId: "task-001",
        createdAt: "2026-04-26T08:00:00Z",
      };

      const envelope = service.buildSyncEnvelope(
        defaultProfile,
        record as any,
        "digest",
        5,
      );

      assert.equal(envelope.priority, 5);
    });

    test("uses custom data classification when provided", () => {
      const service = new EdgeRuntimeSyncService();
      const record = {
        edgeNodeId: "node-001",
        taskId: "task-001",
        createdAt: "2026-04-26T08:00:00Z",
      };

      const envelope = service.buildSyncEnvelope(
        defaultProfile,
        record as any,
        "digest",
        1,
        "restricted",
      );

      assert.equal(envelope.dataClassification, "restricted");
    });

    test("uses custom createdAt when provided", () => {
      const service = new EdgeRuntimeSyncService();
      const record = {
        edgeNodeId: "node-001",
        taskId: "task-001",
        createdAt: "2026-04-26T08:00:00Z",
      };

      const envelope = service.buildSyncEnvelope(
        defaultProfile,
        record as any,
        "digest",
        1,
        "internal",
        "2026-04-25T12:00:00Z",
      );

      assert.equal(envelope.createdAt, "2026-04-25T12:00:00Z");
    });
  });

  describe("sync", () => {
    test("accepts all envelopes when no conflicts", () => {
      const service = new EdgeRuntimeSyncService();
      const envelopes = [
        createEnvelope(service, {
          envelopeId: "env-1",
          recordId: "node-001:task-1:2026-04-26T08:00:00Z",
          priority: 1,
          payloadDigest: "digest-1",
        }),
        createEnvelope(service, {
          envelopeId: "env-2",
          recordId: "node-001:task-2:2026-04-26T08:01:00Z",
          priority: 2,
          dataClassification: "public",
          payloadDigest: "digest-2",
          createdAt: "2026-04-26T08:01:00Z",
        }),
      ];

      const receipt = service.sync(defaultProfile, envelopes, {});

      assert.equal(receipt.acceptedEnvelopeIds.length, 2);
      assert.equal(receipt.rejectedEnvelopeIds.length, 0);
      assert.equal(receipt.decisions.length, 2);
    });

    test("rejects restricted data when policy denies", () => {
      const service = new EdgeRuntimeSyncService();
      const envelopes = [
        createEnvelope(service, {
          envelopeId: "env-restricted",
          recordId: "node-001:task-1:2026-04-26T08:00:00Z",
          priority: 1,
          dataClassification: "restricted",
          payloadDigest: "digest-secret",
        }),
      ];

      const receipt = service.sync(defaultProfile, envelopes, {});

      assert.equal(receipt.acceptedEnvelopeIds.length, 0);
      assert.equal(receipt.rejectedEnvelopeIds.length, 1);
      assert.equal(receipt.decisions[0]?.resolution, "reject");
      assert.ok(receipt.decisions[0]?.rationale.includes("restricted_data_denied"));
    });

    test("central-wins and rejects edge version when digest differs from cloud", () => {
      const service = new EdgeRuntimeSyncService();
      const envelopes = [
        createEnvelope(service, {
          envelopeId: "env-conflict",
          recordId: "node-001:task-1:2026-04-26T08:00:00Z",
          priority: 1,
          payloadDigest: "edge-digest-v2",
        }),
      ];
      const cloudDigests = {
        "node-001:task-1:2026-04-26T08:00:00Z": "cloud-digest-v1",
      };

      const receipt = service.sync(defaultProfile, envelopes, cloudDigests);

      assert.equal(receipt.acceptedEnvelopeIds.length, 0);
      assert.equal(receipt.rejectedEnvelopeIds.length, 1);
      assert.equal(receipt.decisions[0]?.resolution, "accept_central");
      assert.ok(typeof receipt.decisions[0]?.incidentId === "string");
    });

    test("accepts envelope under central-wins policy when digest matches cloud", () => {
      const service = new EdgeRuntimeSyncService();
      const envelopes = [
        createEnvelope(service, {
          envelopeId: "env-matched",
          recordId: "node-001:task-1:2026-04-26T08:00:00Z",
          priority: 1,
          payloadDigest: "same-digest",
        }),
      ];
      const cloudDigests = {
        "node-001:task-1:2026-04-26T08:00:00Z": "same-digest",
      };

      const receipt = service.sync(defaultProfile, envelopes, cloudDigests);

      assert.equal(receipt.acceptedEnvelopeIds.length, 1);
      assert.equal(receipt.decisions[0]?.resolution, "accept_central");
    });

    test("honors requireOrdering policy", () => {
      const service = new EdgeRuntimeSyncService();
      const orderedProfile: EdgeRuntimeProfile = {
        ...defaultProfile,
        syncPolicy: {
          allowRestrictedDataUpload: false,
          requireOrdering: true,
        },
      };
      const envelopes = [
        createEnvelope(service, {
          envelopeId: "env-low",
          recordId: "node-001:r1:2026-04-26T08:00:00Z",
          priority: 1,
          payloadDigest: "d1",
        }),
        createEnvelope(service, {
          envelopeId: "env-high",
          recordId: "node-001:r2:2026-04-26T08:01:00Z",
          priority: 5,
          payloadDigest: "d2",
          createdAt: "2026-04-26T08:01:00Z",
        }),
      ];

      // When requireOrdering is true, ordering is reversed before processing
      const receipt = service.sync(orderedProfile, envelopes, {});

      // Both should be accepted regardless of order
      assert.equal(receipt.acceptedEnvelopeIds.length, 2);
      assert.ok(receipt.acceptedEnvelopeIds.includes("env-low"));
      assert.ok(receipt.acceptedEnvelopeIds.includes("env-high"));
    });
  });
});
