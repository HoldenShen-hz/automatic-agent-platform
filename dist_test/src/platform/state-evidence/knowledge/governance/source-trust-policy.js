const DEFAULT_POLICIES = {
    verified: {
        level: "verified",
        allowedInFinalResponse: true,
        requiresCitation: true,
        maxRetrievalWeight: 1,
        humanReviewRequired: false,
    },
    reviewed: {
        level: "reviewed",
        allowedInFinalResponse: true,
        requiresCitation: true,
        maxRetrievalWeight: 0.8,
        humanReviewRequired: false,
    },
    community: {
        level: "community",
        allowedInFinalResponse: true,
        requiresCitation: true,
        maxRetrievalWeight: 0.5,
        humanReviewRequired: false,
    },
    unverified: {
        level: "unverified",
        allowedInFinalResponse: false,
        requiresCitation: false,
        maxRetrievalWeight: 0.3,
        humanReviewRequired: true,
    },
};
export class SourceTrustPolicyRegistry {
    get(level) {
        return DEFAULT_POLICIES[level];
    }
}
//# sourceMappingURL=source-trust-policy.js.map