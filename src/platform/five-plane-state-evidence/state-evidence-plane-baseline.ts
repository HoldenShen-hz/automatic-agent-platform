export type StateEvidenceCapabilityId =
  | "artifacts"
  | "audit"
  | "checkpoints"
  | "dlq"
  | "events"
  | "incident"
  | "knowledge"
  | "memory"
  | "projections"
  | "truth";

export interface StateEvidenceCapabilityBaseline {
  readonly capabilityId: StateEvidenceCapabilityId;
  readonly entryModule: string;
  readonly description: string;
  readonly baselineServices: readonly string[];
}

export const STATE_EVIDENCE_CAPABILITY_BASELINES: readonly StateEvidenceCapabilityBaseline[] = Object.freeze([
  { capabilityId: "artifacts", entryModule: "src/platform/five-plane-state-evidence/artifacts/index.ts", description: "Artifact persistence and lineage baselines.", baselineServices: ["ArtifactStore"] },
  { capabilityId: "audit", entryModule: "src/platform/five-plane-state-evidence/audit/index.ts", description: "Audit evidence and integrity baselines.", baselineServices: ["AuditTrailService"] },
  { capabilityId: "checkpoints", entryModule: "src/platform/five-plane-state-evidence/checkpoints/index.ts", description: "Checkpoint and pause/resume state baselines.", baselineServices: ["wrapWorkflowStepCheckpoint"] },
  { capabilityId: "dlq", entryModule: "src/platform/five-plane-state-evidence/dlq/index.ts", description: "Dead letter queue and retry orchestration baselines.", baselineServices: ["DeadLetterQueueService"] },
  { capabilityId: "events", entryModule: "src/platform/five-plane-state-evidence/events/index.ts", description: "Typed events, event bus, and outbox-linked event baselines.", baselineServices: ["TypedEventBusPublisher"] },
  { capabilityId: "incident", entryModule: "src/platform/five-plane-state-evidence/incident/index.ts", description: "Incident evidence and incident record baselines.", baselineServices: ["IncidentCaseService"] },
  { capabilityId: "knowledge", entryModule: "src/platform/five-plane-state-evidence/knowledge/index.ts", description: "Knowledge namespaces, indexing, and federated retrieval baselines.", baselineServices: ["KnowledgePlaneService"] },
  { capabilityId: "memory", entryModule: "src/platform/five-plane-state-evidence/memory/index.ts", description: "Execution memory and retrieval baselines.", baselineServices: ["MemoryService"] },
  { capabilityId: "projections", entryModule: "src/platform/five-plane-state-evidence/projections/index.ts", description: "Projection rebuild and materialized state baselines.", baselineServices: ["ProjectionRebuildService"] },
  { capabilityId: "truth", entryModule: "src/platform/five-plane-state-evidence/truth/index.ts", description: "Authoritative truth, repositories, and persistence baselines.", baselineServices: ["AuthoritativeTaskStore"] },
]);

export function listStateEvidenceCapabilityBaselines(): readonly StateEvidenceCapabilityBaseline[] {
  return STATE_EVIDENCE_CAPABILITY_BASELINES;
}

export function resolveStateEvidenceCapabilityBaseline(capabilityId: StateEvidenceCapabilityId): StateEvidenceCapabilityBaseline {
  const baseline = STATE_EVIDENCE_CAPABILITY_BASELINES.find((item) => item.capabilityId === capabilityId);
  if (baseline == null) {
    throw new Error(`state_evidence_capability.not_found:${capabilityId}`);
  }
  return baseline;
}
