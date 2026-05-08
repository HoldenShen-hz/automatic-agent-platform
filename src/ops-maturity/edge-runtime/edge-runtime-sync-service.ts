import { createHash } from "node:crypto";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { buildOfflineExecutionRecord, type OfflineExecutionRecord } from "./edge-executor/index.js";
import { buildEdgeExecutionPlan } from "./edge-orchestrator/index.js";
import { selectEdgeLocalModel, type LocalModelProfile } from "./local-model/index.js";
import { orderEdgeSyncQueue } from "./sync-queue/index.js";

export interface EdgeRuntimeProfile {
  readonly edgeNodeId: string;
  readonly deviceId?: string;
  readonly capabilities: readonly string[];
  readonly connectivityMode: "offline" | "intermittent" | "online";
  readonly maxLocalRetentionHours: number;
  readonly offlineMaxDuration?: number;
  readonly keyLease?: string;
  readonly allowedModels: readonly string[];
  readonly syncPolicy: {
    readonly allowRestrictedDataUpload: boolean;
    readonly requireOrdering: boolean;
  };
  readonly riskLevel?: "low" | "medium";
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
  readonly resolution: "accept_central" | "accept_cloud" | "merge" | "reject";
  readonly rationale: string;
  readonly incidentId?: string;
}

export interface EdgeNodeAttemptReceiptView {
  readonly record: OfflineExecutionRecord;
  readonly selectedModelId: string | null;
  readonly planGraphNodeIds: readonly string[];
  /** @deprecated compatibility alias; use planGraphNodeIds */
  readonly executionPlan: readonly string[];
}

/** @deprecated compatibility export; use EdgeNodeAttemptReceiptView */
export type EdgeExecutionReceipt = EdgeNodeAttemptReceiptView;

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
  ): EdgeNodeAttemptReceiptView {
    if (profile.riskLevel === "medium" || (profile.riskLevel != null && profile.riskLevel !== "low")) {
      throw new Error("edge_runtime.risk_level_not_allowed:edge_execution_requires_low_risk");
    }
    const createdAt = request.createdAt ?? nowIso();
    const record = buildOfflineExecutionRecord(profile.edgeNodeId, request.taskId, createdAt);
    const model = selectEdgeLocalModel(
      models.filter((item) => profile.allowedModels.includes(item.modelId)),
      request.modality,
    );

    return {
      record,
      selectedModelId: model?.modelId ?? null,
      planGraphNodeIds: buildEdgeExecutionPlan([request.taskId]).orderedTaskIds,
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
        // Central wins policy: reject edge version, generate incident for human review
        const incidentId = newId("edge_conflict");
        rejectedEnvelopeIds.push(envelope.envelopeId);
        decisions.push({
          envelopeId: envelope.envelopeId,
          resolution: "accept_central",
          rationale: "edge.sync_central_wins_policy:conflict_requires_human_review",
          incidentId,
        });
        continue;
      }

      acceptedEnvelopeIds.push(envelope.envelopeId);
      decisions.push({
        envelopeId: envelope.envelopeId,
        resolution: "accept_central",
        rationale: "edge.sync_central_wins_policy:accepted",
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
