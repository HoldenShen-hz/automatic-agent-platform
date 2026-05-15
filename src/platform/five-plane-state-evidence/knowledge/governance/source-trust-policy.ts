import { normalizeTrustLevel, type SourceTrustPolicy, type TrustLevel } from "../knowledge-model.js";

const CANONICAL_POLICIES: Record<string, SourceTrustPolicy> = {
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

const DEFAULT_POLICIES: Record<string, SourceTrustPolicy> = {
  ...CANONICAL_POLICIES,
  verified: { ...CANONICAL_POLICIES.authoritative!, level: "verified" as TrustLevel },
  reviewed: { ...CANONICAL_POLICIES.official!, level: "reviewed" as TrustLevel, maxRetrievalWeight: 0.8 },
  community: { ...CANONICAL_POLICIES.team_reviewed!, level: "community" as TrustLevel, maxRetrievalWeight: 0.5 },
  unverified: { ...CANONICAL_POLICIES.private_unverified!, level: "unverified" as TrustLevel },
};

export class SourceTrustPolicyRegistry {
  public get(level: TrustLevel): SourceTrustPolicy {
    return DEFAULT_POLICIES[level] ?? CANONICAL_POLICIES[normalizeTrustLevel(level)]!;
  }
}
