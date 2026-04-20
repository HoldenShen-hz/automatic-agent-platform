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

export class DataResidencyPolicyService {
  public decideTransfer(input: {
    policy: ResidencyPolicy;
    sourceRegion: string;
    targetRegion: string;
    classification: "public" | "internal" | "confidential" | "restricted";
    redacted?: boolean;
  }): ResidencyCheckResult {
    if (input.sourceRegion === input.targetRegion) {
      return this.result("allow", input, "same_region");
    }
    if (!input.policy.allowedRegions.includes(input.targetRegion)) {
      return this.result("deny", input, "target_region_not_allowed");
    }
    if (input.policy.restrictedClassifications.includes(input.classification as "confidential" | "restricted")) {
      if (input.redacted === true && input.policy.allowRedactedTransfer) {
        return this.result("allow", input, "restricted_data_redacted");
      }
      return input.policy.allowRedactedTransfer
        ? this.result("require_redaction", input, "restricted_data_requires_redaction")
        : this.result("deny", input, "restricted_data_residency_block");
    }
    return this.result("allow", input, "policy_allowed");
  }

  private result(
    decision: ResidencyDecision,
    input: { sourceRegion: string; targetRegion: string },
    reason: string,
  ): ResidencyCheckResult {
    return {
      decision,
      sourceRegion: input.sourceRegion,
      targetRegion: input.targetRegion,
      reason,
    };
  }
}
