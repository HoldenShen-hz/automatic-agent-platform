import type { SourceTrustPolicy, TrustLevel } from "../knowledge-model.js";

const DEFAULT_POLICIES: Record<TrustLevel, SourceTrustPolicy> = {
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
  public get(level: TrustLevel): SourceTrustPolicy {
    return DEFAULT_POLICIES[level];
  }
}
