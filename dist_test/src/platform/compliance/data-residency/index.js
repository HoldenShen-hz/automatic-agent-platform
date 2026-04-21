export class DataResidencyPolicyService {
    decideTransfer(input) {
        if (input.sourceRegion === input.targetRegion) {
            return this.result("allow", input, "same_region");
        }
        if (!input.policy.allowedRegions.includes(input.targetRegion)) {
            return this.result("deny", input, "target_region_not_allowed");
        }
        if (input.policy.restrictedClassifications.includes(input.classification)) {
            if (input.redacted === true && input.policy.allowRedactedTransfer) {
                return this.result("allow", input, "restricted_data_redacted");
            }
            return input.policy.allowRedactedTransfer
                ? this.result("require_redaction", input, "restricted_data_requires_redaction")
                : this.result("deny", input, "restricted_data_residency_block");
        }
        return this.result("allow", input, "policy_allowed");
    }
    result(decision, input, reason) {
        return {
            decision,
            sourceRegion: input.sourceRegion,
            targetRegion: input.targetRegion,
            reason,
        };
    }
}
//# sourceMappingURL=index.js.map