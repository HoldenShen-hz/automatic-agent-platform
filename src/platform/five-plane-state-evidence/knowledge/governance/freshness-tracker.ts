import type { KnowledgeSource, KnowledgeNamespace, TrustLevel } from "../knowledge-model.js";

export interface FreshnessAssessment {
  stale: boolean;
  daysOld: number;
  effectiveTrustLevel: TrustLevel;
  action: KnowledgeNamespace["freshnessPolicy"]["staleAction"] | null;
}

export class FreshnessTracker {
  public assess(source: KnowledgeSource, namespace: KnowledgeNamespace, now: Date = new Date()): FreshnessAssessment {
    const ageMs = now.getTime() - new Date(source.freshnessTimestamp).getTime();
    const daysOld = Math.max(0, Math.floor(ageMs / (24 * 60 * 60 * 1000)));
    const stale = daysOld > namespace.freshnessPolicy.maxAgeDays;
    const effectiveTrust = stale ? "team_reviewed" : source.trustLevel;
    return {
      stale,
      daysOld,
      effectiveTrustLevel: effectiveTrust,
      action: stale ? namespace.freshnessPolicy.staleAction : null,
    };
  }
}
