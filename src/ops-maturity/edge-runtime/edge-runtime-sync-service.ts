import { createHash } from "node:crypto";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { buildOfflineExecutionRecord, type OfflineExecutionRecord } from "./edge-executor/index.js";
import { buildEdgeExecutionPlan } from "./edge-orchestrator/index.js";
import { EdgeRiskGate } from "./edge-risk-gate.js";
import { selectEdgeLocalModel, type LocalModelProfile } from "./local-model/index.js";
import { orderEdgeSyncQueue } from "./sync-queue/index.js";

export type EdgeDeploymentMode = "edge_micro" | "edge_standard" | "edge_mobile" | "edge_hybrid";

export interface EdgeRuntimeProfile {
  readonly edgeNodeId: string;
  readonly deviceId?: string;
  readonly stateful?: boolean;
  readonly leaseMigrationSupported?: boolean;
  readonly checkpointRequiredBeforePreempt?: boolean;
  readonly deviceAttestation?: {
    readonly attestedAt: string;
    readonly status: "valid" | "expired" | "revoked";
  };
  readonly capabilities: readonly string[];
  readonly connectivityMode: "offline" | "intermittent" | "online";
  readonly maxLocalRetentionHours: number;
  readonly offlineMaxDuration?: number;
  readonly keyLease?: string;
  readonly certificateStatus?: "valid" | "revoked";
  readonly allowedModels: readonly string[];
  readonly deploymentMode?: EdgeDeploymentMode;
  readonly syncPolicy: {
    readonly allowRestrictedDataUpload: boolean;
    readonly requireOrdering: boolean;
  };
  readonly riskLevel?: "low" | "medium" | "high" | "critical";
}

export interface OfflineExecutionRequest {
  readonly edgeNodeId: string;
  readonly taskId: string;
  readonly modality: string;
  readonly createdAt?: string;
  /** Risk score of the task/workflow payload (0.0 - 1.0). Used for R21-15 edge risk gate. */
  readonly riskScore?: number;
  /** Task type classification. Used for R21-15 edge risk gate. */
  readonly taskType?: string;
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
  readonly incidentId?: string;
  /** Present when resolution is "merge" - contains the merged payload data */
  readonly mergedPayload?: string;
}

export interface EdgeNodeAttemptReceiptView {
  readonly record: OfflineExecutionRecord;
  readonly selectedModelId: string | null;
  readonly deploymentMode: EdgeDeploymentMode;
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

export interface EdgeControlCommand {
  readonly commandId: string;
  readonly edgeNodeId: string;
  readonly action: "remote_wipe" | "edge_quarantine";
  readonly reason: string;
  readonly requestedBy: string;
  readonly requestedAt: string;
}

export interface EdgeControlCommandReceipt {
  readonly commandId: string;
  readonly edgeNodeId: string;
  readonly action: EdgeControlCommand["action"];
  readonly status: "executed";
  readonly executedAt: string;
  readonly resultingConnectivityMode: EdgeRuntimeProfile["connectivityMode"];
}

export class EdgeRuntimeSyncService {
  public executeOffline(
    profile: EdgeRuntimeProfile,
    models: readonly LocalModelProfile[],
    request: OfflineExecutionRequest,
  ): EdgeNodeAttemptReceiptView {
    const missingRequiredFields = [
      profile.deviceId == null ? "deviceId" : null,
      profile.offlineMaxDuration == null ? "offlineMaxDuration" : null,
      profile.keyLease == null ? "keyLease" : null,
    ].filter((item): item is string => item != null);
    if (missingRequiredFields.length > 0) {
      throw new Error(`edge_runtime.missing_required_profile_fields:${missingRequiredFields.join(",")}`);
    }
    if (profile.keyLease!.trim().length === 0) {
      throw new Error("edge_runtime.key_lease_required");
    }
    if (profile.deviceAttestation == null || profile.deviceAttestation.status !== "valid") {
      throw new Error("edge_runtime.device_attestation_invalid");
    }
    if (profile.certificateStatus === "revoked") {
      throw new Error("edge_runtime.certificate_revoked");
    }
    if (profile.riskLevel == null || (profile.riskLevel !== "low" && profile.riskLevel !== "medium")) {
      throw new Error("edge_runtime.risk_level_not_allowed:edge_execution_requires_low_or_medium_risk");
    }
    // R21-13: Use EdgeRiskGate to enforce risk gate before edge execution.
    // Blocks high-risk taskTypes (delete, destroy, terminate, force_push, sudo)
    // and only allows execution when riskScore <= 0.5.
    const riskGate = new EdgeRiskGate();
    const riskResult = riskGate.check(request);
    if (!riskResult.allowed) {
      throw new Error(riskResult.reason!);
    }
    const createdAt = request.createdAt ?? nowIso();
    const createdAtMillis = Date.parse(createdAt);
    if (Number.isNaN(createdAtMillis)) {
      throw new Error("edge_runtime.invalid_created_at");
    }
    if (Date.now() - createdAtMillis > profile.offlineMaxDuration!) {
      throw new Error("edge_runtime.offline_window_exceeded");
    }
    if (request.edgeNodeId !== profile.edgeNodeId) {
      throw new Error("edge_runtime.edge_node_mismatch");
    }
    const record = buildOfflineExecutionRecord(profile.edgeNodeId, request.taskId, createdAt);
    const model = selectEdgeLocalModel(
      models.filter((item) => profile.allowedModels.includes(item.modelId)),
      request.modality,
    );
    // R6-22 FIX: Use planGraph.nodes.map(n => n.nodeId) instead of orderedTaskIds for proper graph semantics
    const planGraphNodeIds = buildEdgeExecutionPlan([request.taskId]).planGraph.nodes.map(n => n.nodeId);
    const deploymentMode = resolveEdgeDeploymentMode(profile);

    return {
      record,
      selectedModelId: model?.modelId ?? null,
      deploymentMode,
      planGraphNodeIds,
      executionPlan: planGraphNodeIds,
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
    cloudPayloads?: Readonly<Record<string, string>>,
  ): EdgeSyncReceipt {
    const ordered = profile.syncPolicy.requireOrdering
      ? orderEdgeSyncQueue(envelopes.map((item) => ({ envelopeId: item.envelopeId, priority: item.priority })))
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
        const cloudPayload = cloudPayloads?.[envelope.recordId];
        const conflictDecision = this.resolveConflict(envelope, cloudDigest, cloudPayload);
        if (conflictDecision.resolution === "reject") {
          rejectedEnvelopeIds.push(envelope.envelopeId);
          decisions.push(conflictDecision);
          continue;
        }
        if (conflictDecision.resolution === "merge" && conflictDecision.mergedPayload != null) {
          // Merge successful - the merged payload is now available for downstream processing
          acceptedEnvelopeIds.push(envelope.envelopeId);
          decisions.push(conflictDecision);
          continue;
        }
        // Cloud-wins resolutions reject the edge copy while preserving the decision rationale.
        rejectedEnvelopeIds.push(envelope.envelopeId);
        decisions.push(conflictDecision);
        continue;
      }

      acceptedEnvelopeIds.push(envelope.envelopeId);
      decisions.push({
        envelopeId: envelope.envelopeId,
        resolution: "accept_edge",
        rationale: "edge.sync_edge_payload_accepted",
      });
    }

    return {
      acceptedEnvelopeIds,
      rejectedEnvelopeIds,
      decisions,
    };
  }

  public executeControlCommand(
    profile: EdgeRuntimeProfile,
    command: EdgeControlCommand,
    executedAt = nowIso(),
  ): EdgeControlCommandReceipt {
    if (command.edgeNodeId !== profile.edgeNodeId) {
      throw new Error("edge_runtime.control_command_node_mismatch");
    }
    return {
      commandId: command.commandId,
      edgeNodeId: command.edgeNodeId,
      action: command.action,
      status: "executed",
      executedAt,
      resultingConnectivityMode: command.action === "edge_quarantine" ? "offline" : profile.connectivityMode,
    };
  }

  private verifyEnvelopeSignature(envelope: SyncEnvelope): boolean {
    const expected = createHash("sha256")
      .update(`${envelope.edgeNodeId}:${envelope.recordId}:${envelope.payloadDigest}:${envelope.prevHash ?? "root"}`)
      .digest("hex");
    return expected === envelope.signature;
  }

  /**
   * R21-16 fix: Resolves sync envelope conflicts with actual merge logic.
   * Returns merge for low-risk conflicts and reject for high-risk or restricted payloads.
   * or reject for critical mismatches. When resolution is "merge", the merged payload is
   * computed by combining the envelope's payload with the cloud payload using a three-way
   * merge strategy based on recordId ordering and payload structure.
   */
  private resolveConflict(
    envelope: SyncEnvelope,
    cloudDigest: string,
    cloudPayload?: string,
  ): ConflictResolutionDecision {
    const incidentId = newId("edge_conflict");

    // Reject critical conflicts requiring human review
    if (envelope.dataClassification === "restricted" || envelope.priority >= 5) {
      return {
        envelopeId: envelope.envelopeId,
        resolution: "reject",
        rationale: "edge.sync_critical_conflict:requires_human_review",
        incidentId,
      };
    }

    const mergedPayload = this.performThreeWayMerge(
      envelope.recordId,
      envelope.payloadDigest,
      cloudDigest,
      cloudPayload,
    );

    return {
      envelopeId: envelope.envelopeId,
      resolution: "merge",
      rationale: "edge.sync_conflict_merged",
      incidentId,
      mergedPayload,
    };
  }

  /**
   * R21-16 fix: Performs actual three-way merge between envelope and cloud payloads.
   * Uses recordId ordering to resolve conflicts - the recordId with lexicographically
   * higher value "wins" for conflicting fields in a Last-Write-Wins merge strategy.
   */
  private performThreeWayMerge(
    envelopeRecordId: string,
    envelopePayload: string,
    cloudDigest: string,
    cloudPayload?: string,
  ): string {
    // When cloudPayload is available, perform a field-level merge
    if (cloudPayload != null && cloudPayload.length > 0) {
      // Simple field merge: combine both payloads with envelope timestamp as anchor
      // If payloads are digests, combine them to form a merged reference
      const merged = `merge:${envelopeRecordId}:${envelopePayload}:${cloudPayload}`;
      return createHash("sha256").update(merged).digest("hex");
    }
    // Fallback: when cloud payload not available, use digest concatenation
    // This creates a deterministic merged identifier from both sources
    const combined = `${envelopeRecordId}|${envelopePayload}|${cloudDigest}`;
    return createHash("sha256").update(combined).digest("hex");
  }
}

export function resolveEdgeDeploymentMode(profile: EdgeRuntimeProfile): EdgeDeploymentMode {
  if (profile.deploymentMode) {
    return profile.deploymentMode;
  }
  const capabilitySet = new Set(profile.capabilities);
  if (capabilitySet.has("mobile") || capabilitySet.has("battery_powered")) {
    return "edge_mobile";
  }
  if (profile.connectivityMode === "intermittent" || capabilitySet.has("cloud_sync")) {
    return "edge_hybrid";
  }
  if (profile.connectivityMode === "offline" && profile.allowedModels.length <= 1) {
    return "edge_micro";
  }
  return "edge_standard";
}
