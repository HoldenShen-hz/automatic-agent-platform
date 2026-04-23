export type ComplianceCapabilityId = "crypto-shredding" | "data-residency" | "encryption" | "erasure" | "lineage";
export interface ComplianceCapabilityBaseline {
    readonly capabilityId: ComplianceCapabilityId;
    readonly entryModule: string;
    readonly description: string;
    readonly baselineServices: readonly string[];
}
export declare const COMPLIANCE_CAPABILITY_BASELINES: readonly ComplianceCapabilityBaseline[];
export declare function listComplianceCapabilityBaselines(): readonly ComplianceCapabilityBaseline[];
export declare function resolveComplianceCapabilityBaseline(capabilityId: ComplianceCapabilityId): ComplianceCapabilityBaseline;
