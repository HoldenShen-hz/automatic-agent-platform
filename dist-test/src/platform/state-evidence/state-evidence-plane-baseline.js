export const STATE_EVIDENCE_CAPABILITY_BASELINES = Object.freeze([
    { capabilityId: "artifacts", entryModule: "src/platform/state-evidence/artifacts/index.ts", description: "Artifact persistence and lineage baselines.", baselineServices: ["ArtifactStoreService"] },
    { capabilityId: "audit", entryModule: "src/platform/state-evidence/audit/index.ts", description: "Audit evidence and integrity baselines.", baselineServices: ["AuditTrailService"] },
    { capabilityId: "checkpoints", entryModule: "src/platform/state-evidence/checkpoints/index.ts", description: "Checkpoint and pause/resume state baselines.", baselineServices: ["CheckpointStoreService"] },
    { capabilityId: "dlq", entryModule: "src/platform/state-evidence/dlq/index.ts", description: "Dead letter queue and retry orchestration baselines.", baselineServices: ["DlqService"] },
    { capabilityId: "events", entryModule: "src/platform/state-evidence/events/index.ts", description: "Typed events, event bus, and outbox-linked event baselines.", baselineServices: ["TypedEventPublisher"] },
    { capabilityId: "incident", entryModule: "src/platform/state-evidence/incident/index.ts", description: "Incident evidence and incident record baselines.", baselineServices: ["IncidentRepository"] },
    { capabilityId: "knowledge", entryModule: "src/platform/state-evidence/knowledge/index.ts", description: "Knowledge namespaces, indexing, and federated retrieval baselines.", baselineServices: ["KnowledgePlaneService"] },
    { capabilityId: "memory", entryModule: "src/platform/state-evidence/memory/index.ts", description: "Execution memory and retrieval baselines.", baselineServices: ["MemoryStoreService"] },
    { capabilityId: "projections", entryModule: "src/platform/state-evidence/projections/index.ts", description: "Projection rebuild and materialized state baselines.", baselineServices: ["ProjectionRebuilder"] },
    { capabilityId: "truth", entryModule: "src/platform/state-evidence/truth/index.ts", description: "Authoritative truth, repositories, and persistence baselines.", baselineServices: ["AuthoritativeTaskStore"] },
]);
export function listStateEvidenceCapabilityBaselines() {
    return STATE_EVIDENCE_CAPABILITY_BASELINES;
}
export function resolveStateEvidenceCapabilityBaseline(capabilityId) {
    const baseline = STATE_EVIDENCE_CAPABILITY_BASELINES.find((item) => item.capabilityId === capabilityId);
    if (baseline == null) {
        throw new Error(`state_evidence_capability.not_found:${capabilityId}`);
    }
    return baseline;
}
//# sourceMappingURL=state-evidence-plane-baseline.js.map