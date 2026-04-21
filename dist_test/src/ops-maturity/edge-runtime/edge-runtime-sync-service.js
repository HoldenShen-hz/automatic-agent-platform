import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { buildOfflineExecutionRecord } from "./edge-executor/index.js";
import { buildEdgeExecutionPlan } from "./edge-orchestrator/index.js";
import { selectEdgeLocalModel } from "./local-model/index.js";
import { orderEdgeSyncQueue } from "./sync-queue/index.js";
export class EdgeRuntimeSyncService {
    executeOffline(profile, models, request) {
        const createdAt = request.createdAt ?? nowIso();
        const record = buildOfflineExecutionRecord(profile.edgeNodeId, request.taskId, createdAt);
        const model = selectEdgeLocalModel(models.filter((item) => profile.allowedModels.includes(item.modelId)), request.modality);
        return {
            record,
            selectedModelId: model?.modelId ?? null,
            executionPlan: buildEdgeExecutionPlan([request.taskId]),
        };
    }
    buildSyncEnvelope(profile, record, payloadDigest, priority = 1, dataClassification = "internal", createdAt = nowIso()) {
        return {
            envelopeId: newId("sync"),
            recordId: `${record.edgeNodeId}:${record.taskId}:${record.createdAt}`,
            edgeNodeId: profile.edgeNodeId,
            priority,
            dataClassification,
            payloadDigest,
            createdAt,
        };
    }
    sync(profile, envelopes, cloudPayloadDigests) {
        const ordered = profile.syncPolicy.requireOrdering
            ? orderEdgeSyncQueue(envelopes.map((item) => ({ envelopeId: item.envelopeId, priority: item.priority })))
                .reverse()
                .map((orderedItem) => envelopes.find((item) => item.envelopeId === orderedItem.envelopeId))
            : [...envelopes];
        const acceptedEnvelopeIds = [];
        const rejectedEnvelopeIds = [];
        const decisions = [];
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
}
//# sourceMappingURL=edge-runtime-sync-service.js.map