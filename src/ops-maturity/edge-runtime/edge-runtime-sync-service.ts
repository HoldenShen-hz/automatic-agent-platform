import { createHash } from "node:crypto";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { buildOfflineExecutionRecord, type OfflineExecutionRecord } from "./edge-executor/index.js";
import { buildEdgeExecutionPlan } from "./edge-orchestrator/index.js";
import { selectEdgeLocalModel, type LocalModelProfile } from "./local-model/index.js";
import { orderEdgeSyncQueue } from "./sync-queue/index.js";

export interface EdgeRuntimeProfile {
  readonly edgeNodeId: string;
  readonly capabilities: readonly string[];
  readonly connectivityMode: "offline" | "intermittent" | "online";
  readonly maxLocalRetentionHours: number;
  readonly allowedModels: readonly string[];
  readonly syncPolicy: {
    readonly allowRestrictedDataUpload: boolean;
    readonly requireOrdering: boolean;
  };
}

export interface OfflineExecutionRequest {
  readonly edgeNodeId: string;
  readonly taskId: string;
  readonly modality: string;
  readonly createdAt?: string;
}

export interface SyncEnvelope {
  readonly envelopeId: string;
  readonly recordId: string;
  readonly edgeNodeId: string;
  readonly priority: number;
  readonly dataClassification: "public" | "internal" | "restricted";
  readonly payloadDigest: string;
  readonly prevHash: string | null;
  readonly signature: string;
  readonly createdAt: string;
}

export interface ConflictResolutionDecision {
  readonly envelopeId: string;
  readonly resolution: "accept_edge" | "accept_cloud" | "merge" | "reject";
  readonly rationale: string;
}

export interface EdgeExecutionReceipt {
  readonly record: OfflineExecutionRecord;
  readonly selectedModelId: string | null;
  readonly executionPlan: readonly string[];
}

export interface EdgeSyncReceipt {
  readonly acceptedEnvelopeIds: readonly string[];
  readonly rejectedEnvelopeIds: readonly string[];
  readonly decisions: readonly ConflictResolutionDecision[];
}

export class EdgeRuntimeSyncService {
  public executeOffline(
    profile: EdgeRuntimeProfile,
    models: readonly LocalModelProfile[],
    request: OfflineExecutionRequest,
  ): EdgeExecutionReceipt {
    const createdAt = request.createdAt ?? nowIso();
    const record = buildOfflineExecutionRecord(profile.edgeNodeId, request.taskId, createdAt);
    const model = selectEdgeLocalModel(
      models.filter((item) => profile.allowedModels.includes(item.modelId)),
      request.modality,
    );

    return {
      record,
      selectedModelId: model?.modelId ?? null,
      executionPlan: buildEdgeExecutionPlan([request.taskId]).orderedTaskIds,
    };
  }

  public buildSyncEnvelope(
    profile: EdgeRuntimeProfile,
    record: OfflineExecutionRecord,
    payloadDigest: string,
    priority = 1,
    dataClassification: SyncEnvelope["dataClassification"] = "internal",
    createdAt = nowIso(),
    prevHash: string | null = null,
  ): SyncEnvelope {
    const recordId = `${record.edgeNodeId}:${record.taskId}:${record.createdAt}`;
    const signature = createHash("sha256")
      .update(`${profile.edgeNodeId}:${recordId}:${payloadDigest}:${prevHash ?? "root"}`)
      .digest("hex");
    return {
      envelopeId: newId("sync"),
      recordId,
      edgeNodeId: profile.edgeNodeId,
      priority,
      dataClassification,
      payloadDigest,
      prevHash,
      signature,
      createdAt,
    };
  }

  public sync(
    profile: EdgeRuntimeProfile,
    envelopes: readonly SyncEnvelope[],
    cloudPayloadDigests: Readonly<Record<string, string>>,
  ): EdgeSyncReceipt {
    const ordered = profile.syncPolicy.requireOrdering
      ? orderEdgeSyncQueue(envelopes.map((item) => ({ envelopeId: item.envelopeId, priority: item.priority })))
        .reverse()
        .map((orderedItem) => envelopes.find((item) => item.envelopeId === orderedItem.envelopeId)!)
      : [...envelopes];
    const acceptedEnvelopeIds: string[] = [];
    const rejectedEnvelopeIds: string[] = [];
    const decisions: ConflictResolutionDecision[] = [];

    for (const envelope of ordered) {
      if (envelope.dataClassification === "restricted" && !profile.syncPolicy.allowRestrictedDataUpload) {
        rejectedEnvelopeIds.push(envelope.envelopeId);
        decisions.push({
          envelopeId: envelope.envelopeId,
          resolution: "reject",
          rationale: "edge.sync_policy_restricted_data_denied",
        });
        continue;
      }
      if (!this.verifyEnvelopeSignature(envelope)) {
        rejectedEnvelopeIds.push(envelope.envelopeId);
        decisions.push({
          envelopeId: envelope.envelopeId,
          resolution: "reject",
          rationale: "edge.sync_signature_invalid",
        });
        continue;
      }

      const cloudDigest = cloudPayloadDigests[envelope.recordId];
      if (cloudDigest != null && cloudDigest !== envelope.payloadDigest) {
        acceptedEnvelopeIds.push(envelope.envelopeId);
        decisions.push({
          envelopeId: envelope.envelopeId,
          resolution: "merge",
          rationale: "edge.sync_conflict_merge_required",
        });
        continue;
      }

      acceptedEnvelopeIds.push(envelope.envelopeId);
      decisions.push({
        envelopeId: envelope.envelopeId,
        resolution: "accept_edge",
        rationale: "edge.sync_accept_edge",
      });
    }

    return {
      acceptedEnvelopeIds,
      rejectedEnvelopeIds,
      decisions,
    };
  }

  private verifyEnvelopeSignature(envelope: SyncEnvelope): boolean {
    const expected = createHash("sha256")
      .update(`${envelope.edgeNodeId}:${envelope.recordId}:${envelope.payloadDigest}:${envelope.prevHash ?? "root"}`)
      .digest("hex");
    return expected === envelope.signature;
  }
}
