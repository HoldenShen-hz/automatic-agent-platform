export type GovernanceCapabilityId = "org-model" | "approval-routing" | "sso-scim" | "compliance-engine" | "knowledge-boundary" | "delegated-governance";
export interface GovernanceCapabilityBaseline {
    readonly capabilityId: GovernanceCapabilityId;
    readonly entryModule: string;
    readonly description: string;
    readonly architectureSections: readonly string[];
    readonly baselineServices: readonly string[];
}
export declare const GOVERNANCE_CAPABILITY_BASELINES: readonly GovernanceCapabilityBaseline[];
export declare function listGovernanceCapabilityBaselines(): readonly GovernanceCapabilityBaseline[];
export declare function resolveGovernanceCapabilityBaseline(capabilityId: GovernanceCapabilityId): GovernanceCapabilityBaseline;
