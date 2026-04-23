/**
 * @fileoverview HTTP route payload schemas.
 *
 * Centralizes runtime payload parsing for POST routes via Zod schemas so
 * request validation stays consistent across handlers and tests.
 */
import type { ApprovalDecision } from "../../../control-plane/approval-center/approval-service.js";
import type { ArtifactBundleExtended, ArtifactRecord } from "../../../state-evidence/artifacts/artifact-model.js";
export declare function parseAuthTokenPayload(body: unknown, headerApiKey: string | undefined): {
    apiKey: string;
};
export interface GatewaySendPayload {
    text: string;
    channel?: string;
    query?: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
}
export declare function parseGatewaySendPayload(body: unknown): GatewaySendPayload;
export declare function parseGatewayWebhookPayload(body: unknown): Record<string, unknown>;
export declare function parseApprovalDecisionPayload(approvalId: string, actorId: string, body: unknown): ApprovalDecision;
export interface BillingReconcilePayload {
    gatewayKind: "manual" | "stripe" | "paddle";
    gatewaySessionRef: string;
    status: "pending" | "paid" | "failed" | "cancelled";
    occurredAt?: string;
    failureCode?: string;
}
export declare function parseBillingReconcilePayload(body: unknown): BillingReconcilePayload;
export interface ArtifactBundlePreviewPayload {
    taskId: string;
    domainId: string;
    bundleType: "release_bundle" | "asset_bundle" | "campaign_bundle" | "incident_bundle";
    artifacts: ArtifactRecord[];
}
export declare function parseArtifactBundlePreviewPayload(body: unknown): ArtifactBundlePreviewPayload;
export interface ArtifactBundlePublishPayload {
    bundle: ArtifactBundleExtended;
}
export declare function parseArtifactBundlePublishPayload(body: unknown): ArtifactBundlePublishPayload;
export interface ControlPlaneLoadBalancingSelectionPayload {
    queueName?: string;
    preferredRegion?: string;
    tenantId?: string;
    requestKey?: string;
}
export declare function parseControlPlaneLoadBalancingSelectionPayload(body: unknown): ControlPlaneLoadBalancingSelectionPayload;
export interface CreateTaskPayload {
    title: string;
    divisionId?: string;
    parentId?: string;
    inputJson?: string;
    priority?: "low" | "normal" | "high" | "urgent";
    source?: "user" | "perception" | "system";
}
export interface UpdateTaskPayload {
    title?: string;
    status?: "queued" | "pending" | "in_progress" | "awaiting_decision" | "done" | "failed" | "cancelled";
    priority?: "low" | "normal" | "high" | "urgent";
    outputJson?: string;
}
export declare function parseCreateTaskPayload(body: unknown): CreateTaskPayload;
export declare function parseUpdateTaskPayload(body: unknown): UpdateTaskPayload;
export interface CreateWebhookEndpointPayload {
    endpointId: string;
    source: string;
    allowedEventTypes?: string[];
    algorithm?: "none" | "sha256_hmac";
    signingSecret?: string;
    signatureHeader?: string;
    idempotencyHeader?: string;
    dispatchTargetRef?: string;
    enabled?: boolean;
}
export declare function parseCreateWebhookEndpointPayload(body: unknown): CreateWebhookEndpointPayload;
