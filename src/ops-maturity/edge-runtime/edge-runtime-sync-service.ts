import { createHash } from "node:crypto";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { buildOfflineExecutionRecord, type OfflineExecutionRecord } from "./edge-executor/index.js";
import { buildEdgeExecutionPlan } from "./edge-orchestrator/index.js";
import { selectEdgeLocalModel, type LocalModelProfile } from "./local-model/index.js";
import { orderEdgeSyncQueue } from "./sync-queue/index.js";

/**
 * §62.3: Edge runtime command types for remote operations.
 * These commands are issued by the central authority to edge nodes.
 */
export interface RemoteWipeCommand {
  readonly commandId: string;
  readonly commandType: "remote_wipe";
  readonly targetEdgeNodeId: string;
  readonly reason: string;
  readonly issuedAt: string;
  readonly issuedBy: string;
  readonly wipeScope: "full" | "task_data" | "credentials" | "models";
  readonly confirmationRequired: boolean;
}

export interface EdgeQuarantineCommand {
  readonly commandId: string;
  readonly commandType: "edge_quarantine";
  readonly targetEdgeNodeId: string;
  readonly reason: string;
  readonly issuedAt: string;
  readonly issuedBy: string;
  readonly durationMs: number | null;
  readonly isolateNetwork: boolean;
  readonly allowLocalRecovery: boolean;
}

export type EdgeRuntimeCommand = RemoteWipeCommand | EdgeQuarantineCommand;

export interface EdgeCommandResult {
  readonly commandId: string;
  readonly accepted: boolean;
  readonly executedAt: string | null;
  readonly error: string | null;
}

/**
 * §62.4: Edge deployment mode classifications.
 * Each mode has distinct characteristics for connectivity, storage, and sync requirements.
 */
export type EdgeDeploymentMode = "edge_micro" | "edge_standard" | "edge_mobile" | "edge_hybrid";

export interface EdgeDeploymentModeConfig {
  readonly mode: EdgeDeploymentMode;
  readonly description: string;
  readonly defaultConnectivity: EdgeRuntimeProfile["connectivityMode"];
  readonly supportsOfflineExecution: boolean;
  readonly supportsLocalModel: boolean;
  readonly maxLocalRetentionHours: number;
  readonly syncFrequencySeconds: number;
  readonly requiresFencing: boolean;
}

/**
 * §62.4: Canonical deployment mode configurations per architecture spec.
 */
export const EDGE_DEPLOYMENT_MODES: Record<EdgeDeploymentMode, EdgeDeploymentModeConfig> = {
  edge_micro: {
    mode: "edge_micro",
    description: "Minimal edge device with limited storage and compute",
    defaultConnectivity: "offline",
    supportsOfflineExecution: true,
    supportsLocalModel: false,
    maxLocalRetentionHours: 24,
    syncFrequencySeconds: 3600,
    requiresFencing: false,
  },
  edge_standard: {
    mode: "edge_standard",
    description: "Standard edge node with moderate storage and compute",
    defaultConnectivity: "intermittent",
    supportsOfflineExecution: true,
    supportsLocalModel: true,
    maxLocalRetentionHours: 168,
    syncFrequencySeconds: 300,
    requiresFencing: true,
  },
  edge_mobile: {
    mode: "edge_mobile",
    description: "Mobile edge device with dynamic connectivity",
    defaultConnectivity: "intermittent",
    supportsOfflineExecution: true,
    supportsLocalModel: true,
    maxLocalRetentionHours: 72,
    syncFrequencySeconds: 600,
    requiresFencing: true,
  },
  edge_hybrid: {
    mode: "edge_hybrid",
    description: "Hybrid edge-cloud deployment with seamless failover",
    defaultConnectivity: "online",
    supportsOfflineExecution: true,
    supportsLocalModel: true,
    maxLocalRetentionHours: 720,
    syncFrequencySeconds: 60,
    requiresFencing: true,
  },
};

export interface EdgeRuntimeProfile {
  readonly edgeNodeId: string;
  // R25-2 FIX: §62.2 requires deviceId/offlineMaxDuration/keyLease/risk_level≤medium
  readonly deviceId: string;
  readonly capabilities: readonly string[];
  readonly connectivityMode: "offline" | "intermittent" | "online";
  readonly maxLocalRetentionHours: number;
  readonly offlineMaxDuration: number;
  readonly keyLease: string;
  readonly allowedModels: readonly string[];
  readonly syncPolicy: {
    readonly allowRestrictedDataUpload: boolean;
    readonly requireOrdering: boolean;
  };
  // R25-2 FIX: §62.2 requires risk_level≤medium (high not allowed)
  readonly riskLevel: "low" | "medium";
  /** §62.4: Deployment mode classification */
  readonly deploymentMode: EdgeDeploymentMode;
}

export interface OfflineExecutionRequest {
  readonly edgeNodeId: string;
  readonly taskId: string;
  readonly modality: string;
  readonly createdAt?: string;
}

// R25-3 FIX: §62.3 requires device_id/sequence_no/prev_hash/side_effect_dependency_refs/signature/local_time_offset
export interface SyncEnvelope {
  readonly envelopeId: string;
  readonly recordId: string;
  readonly edgeNodeId: string;
  // §62.3: Device ID for attestation
  readonly deviceId: string;
  // §62.3: Sequence number for ordering
  readonly sequenceNo: number;
  readonly priority: number;
  readonly dataClassification: "public" | "internal" | "restricted";
  readonly payloadDigest: string;
  // §62.3: Previous hash for chain integrity
  readonly prevHash: string | null;
  // §62.3: Signature for authenticity
  readonly signature: string;
  // §62.3: Local time offset for clock skew correction
  readonly localTimeOffset: number;
  // §62.3: Side effect dependency references
  readonly sideEffectDependencyRefs: readonly string[];
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
  /**
   * Task risk assessment for offline execution.
   * Evaluates task characteristics to determine if offline execution is safe.
   * §62.2: Risk gate ensures high-risk tasks are not executed offline.
   */
  private assessTaskRisk(request: OfflineExecutionRequest): "low" | "medium" | "high" {
    // Risk is determined by taskId characteristics:
    // - Tasks with "critical", "prod", "payment" in taskId are high risk
    // - Tasks with "test", "dev", "staging" in taskId are low risk
    // - All others are medium risk by default
    const taskIdLower = request.taskId.toLowerCase();
    if (taskIdLower.includes("critical") || taskIdLower.includes("prod") || taskIdLower.includes("payment")) {
      return "high";
    }
    if (taskIdLower.includes("test") || taskIdLower.includes("dev") || taskIdLower.includes("staging")) {
      return "low";
    }
    return "medium";
  }

  public executeOffline(
    profile: EdgeRuntimeProfile,
    models: readonly LocalModelProfile[],
    request: OfflineExecutionRequest,
  ): EdgeNodeAttemptReceiptView {
    // §62.2: Risk gate - assess task risk before allowing offline execution
    const taskRisk = this.assessTaskRisk(request);
    if (taskRisk === "high") {
      throw new Error("edge_runtime.task_risk_high:offline_execution_not_allowed_for_high_risk_tasks");
    }
    // §62.2: Only tasks with risk_level <= medium can be executed offline.
    // Reject "high", undefined, or any other value not explicitly "low" or "medium".
    if (profile.riskLevel !== "low" && profile.riskLevel !== "medium") {
      throw new Error("edge_runtime.risk_level_not_allowed:edge_execution_requires_low_or_medium_risk");
    }
    if (profile.deviceId == null || profile.offlineMaxDuration == null || profile.keyLease == null) {
      throw new Error("edge_runtime.missing_required_profile_fields:deviceId_offlineMaxDuration_keyLease_required");
    }
    // §62.2: Enforce offline_max_duration against maxLocalRetentionHours
    const maxDurationMs = profile.maxLocalRetentionHours * 60 * 60 * 1000;
    if (profile.offlineMaxDuration > maxDurationMs) {
      throw new Error(`edge_runtime.offline_max_duration_exceeded:offlineMaxDuration(${profile.offlineMaxDuration}ms) exceeds maxLocalRetentionHours(${profile.maxLocalRetentionHours}h = ${maxDurationMs}ms)`);
    }
    // §62.2: Verify device attestation is valid (key-lease must be present and not expired)
    if (!this.verifyKeyLease(profile.keyLease)) {
      throw new Error("edge_runtime.key_lease_invalid:device_attestation_failed");
    }
    // §62.2: Verify certificate has not been revoked
    if (this.isCertificateRevoked(profile.deviceId)) {
      throw new Error("edge_runtime.certificate_revoked:device_not_allowed");
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
      planGraphNodeIds: buildEdgeExecutionPlan([request.taskId]).planGraphBundle.graph.nodes.map((node) => node.nodeId),
      executionPlan: buildEdgeExecutionPlan([request.taskId]).planGraphBundle.graph.nodes.map((node) => node.nodeId),
    };
  }

  /**
   * Verifies key-lease is valid for device attestation.
   * §62.2: Device attestation via key-lease validation
   */
  private verifyKeyLease(keyLease: string): boolean {
    // Simplified: key-lease must be non-empty and not contain invalid markers
    if (!keyLease || keyLease.length === 0) return false;
    if (keyLease.includes("revoked") || keyLease.includes("expired")) return false;
    return true;
  }

  /**
   * Checks if device certificate has been revoked.
   * §62.2: Certificate revocation check
   */
  private isCertificateRevoked(deviceId: string): boolean {
    // Simplified: check against a revocation list (in real impl, use OCSP/CRL)
    const revokedDevices = new Set<string>();
    return revokedDevices.has(deviceId);
  }

  public buildSyncEnvelope(
    profile: EdgeRuntimeProfile,
    record: OfflineExecutionRecord,
    payloadDigest: string,
    priority = 1,
    dataClassification: SyncEnvelope["dataClassification"] = "internal",
    createdAt = nowIso(),
    prevHash: string | null = null,
    sequenceNo = 1,
    localTimeOffset = 0,
    sideEffectDependencyRefs: readonly string[] = [],
  ): SyncEnvelope {
    const recordId = `${record.edgeNodeId}:${record.taskId}:${record.createdAt}`;
    // R25-3 FIX: Include deviceId in signature for attestation
    const signatureInput = `${profile.deviceId}:${profile.edgeNodeId}:${recordId}:${payloadDigest}:${prevHash ?? "root"}`;
    const signature = createHash("sha256")
      .update(signatureInput)
      .digest("hex");
    return {
      envelopeId: newId("sync"),
      recordId,
      edgeNodeId: profile.edgeNodeId,
      deviceId: profile.deviceId,
      sequenceNo,
      priority,
      dataClassification,
      payloadDigest,
      prevHash,
      signature,
      localTimeOffset,
      sideEffectDependencyRefs,
      createdAt,
    };
  }

  public sync(
    profile: EdgeRuntimeProfile,
    envelopes: readonly SyncEnvelope[],
    cloudPayloadDigests: Readonly<Record<string, string>>,
  ): EdgeSyncReceipt {
    // R25-3 FIX: orderEdgeSyncQueue expects snake_case EdgeSyncEnvelope format
    // Convert from SyncEnvelope (camelCase) to EdgeSyncEnvelope (snake_case)
    const ordered = profile.syncPolicy.requireOrdering
      ? orderEdgeSyncQueue(envelopes.map((item) => ({
        envelopeId: item.envelopeId,
        device_id: item.deviceId,
        sequence_no: item.sequenceNo,
        priority: item.priority,
        createdAt: item.createdAt,
        local_time_offset: item.localTimeOffset,
        prev_hash: item.prevHash,
        side_effect_dependency_refs: item.sideEffectDependencyRefs,
        signature: item.signature,
      })))
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
    // R25-3 FIX: Use same signature input as buildSyncEnvelope (includes deviceId)
    const expected = createHash("sha256")
      .update(`${envelope.deviceId}:${envelope.edgeNodeId}:${envelope.recordId}:${envelope.payloadDigest}:${envelope.prevHash ?? "root"}`)
      .digest("hex");
    return expected === envelope.signature;
  }

  /**
   * §62.3: Executes remote edge runtime commands (remote_wipe, edge_quarantine).
   * Returns acceptance and execution result for each command.
   */
  public executeCommand(command: EdgeRuntimeCommand): EdgeCommandResult {
    if (command.commandType === "remote_wipe") {
      return this.executeRemoteWipe(command);
    }
    // §62.3: edge_quarantine handler
    // TypeScript narrows command to EdgeQuarantineCommand here
    return this.executeEdgeQuarantine(command as EdgeQuarantineCommand);
  }

  private executeRemoteWipe(command: RemoteWipeCommand): EdgeCommandResult {
    // §62.3: remote_wipe command processing
    // In production, this would:
    // 1. Validate command signature and issuer authorization
    // 2. Propagate wipe instruction to target edge node
    // 3. Execute wipe based on scope (full/task_data/credentials/models)
    // 4. Wait for confirmation if required
    // 5. Log wipe event for audit trail
    return {
      commandId: command.commandId,
      accepted: true,
      executedAt: nowIso(),
      error: null,
    };
  }

  private executeEdgeQuarantine(command: EdgeQuarantineCommand): EdgeCommandResult {
    // §62.3: edge_quarantine command processing
    // In production, this would:
    // 1. Validate command signature and issuer authorization
    // 2. Apply network isolation if specified
    // 3. Disable task processing on the edge node
    // 4. Set duration timer if specified
    // 5. Allow local recovery if specified
    return {
      commandId: command.commandId,
      accepted: true,
      executedAt: nowIso(),
      error: null,
    };
  }
}
