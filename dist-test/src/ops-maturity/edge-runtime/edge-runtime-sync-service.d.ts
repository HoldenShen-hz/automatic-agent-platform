import { type OfflineExecutionRecord } from "./edge-executor/index.js";
import { type LocalModelProfile } from "./local-model/index.js";
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
export declare class EdgeRuntimeSyncService {
    executeOffline(profile: EdgeRuntimeProfile, models: readonly LocalModelProfile[], request: OfflineExecutionRequest): EdgeExecutionReceipt;
    buildSyncEnvelope(profile: EdgeRuntimeProfile, record: OfflineExecutionRecord, payloadDigest: string, priority?: number, dataClassification?: SyncEnvelope["dataClassification"], createdAt?: string): SyncEnvelope;
    sync(profile: EdgeRuntimeProfile, envelopes: readonly SyncEnvelope[], cloudPayloadDigests: Readonly<Record<string, string>>): EdgeSyncReceipt;
}
