export type ResidencyDecision = "allow" | "deny" | "require_redaction";
export interface ResidencyPolicy {
    tenantId: string;
    allowedRegions: string[];
    restrictedClassifications: Array<"confidential" | "restricted">;
    allowRedactedTransfer: boolean;
}
export interface ResidencyCheckResult {
    decision: ResidencyDecision;
    sourceRegion: string;
    targetRegion: string;
    reason: string;
}
export declare class DataResidencyPolicyService {
    decideTransfer(input: {
        policy: ResidencyPolicy;
        sourceRegion: string;
        targetRegion: string;
        classification: "public" | "internal" | "confidential" | "restricted";
        redacted?: boolean;
    }): ResidencyCheckResult;
    private result;
}
