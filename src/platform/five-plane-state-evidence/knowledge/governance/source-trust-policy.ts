import type { SourceTrustPolicy, TrustLevel } from "../knowledge-model.js";

const DEFAULT_POLICIES: Record<TrustLevel, SourceTrustPolicy> = {
  authoritative: {
    level: "authoritative",
    allowedInFinalResponse: true,
    requiresCitation: true,
    maxRetrievalWeight: 1,
    humanReviewRequired: false,
  },
  official: {
    level: "official",
    allowedInFinalResponse: true,
    requiresCitation: true,
    maxRetrievalWeight: 0.85,
    humanReviewRequired: false,
  },
  team_reviewed: {
    level: "team_reviewed",
    allowedInFinalResponse: true,
    requiresCitation: true,
    maxRetrievalWeight: 0.65,
    humanReviewRequired: false,
  },
  private_unverified: {
    level: "private_unverified",
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
