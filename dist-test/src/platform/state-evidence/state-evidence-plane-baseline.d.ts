export type StateEvidenceCapabilityId = "artifacts" | "audit" | "checkpoints" | "dlq" | "events" | "incident" | "knowledge" | "memory" | "projections" | "truth";
export interface StateEvidenceCapabilityBaseline {
    readonly capabilityId: StateEvidenceCapabilityId;
    readonly entryModule: string;
    readonly description: string;
    readonly baselineServices: readonly string[];
}
export declare const STATE_EVIDENCE_CAPABILITY_BASELINES: readonly StateEvidenceCapabilityBaseline[];
export declare function listStateEvidenceCapabilityBaselines(): readonly StateEvidenceCapabilityBaseline[];
export declare function resolveStateEvidenceCapabilityBaseline(capabilityId: StateEvidenceCapabilityId): StateEvidenceCapabilityBaseline;
