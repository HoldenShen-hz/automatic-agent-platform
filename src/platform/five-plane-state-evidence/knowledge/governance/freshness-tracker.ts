import type { KnowledgeSource, KnowledgeNamespace, TrustLevel } from "../knowledge-model.js";
import { degradeTrustLevel } from "../knowledge-model.js";

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
    return {
      stale,
      daysOld,
      effectiveTrustLevel: stale ? degradeTrustLevel(source.trustLevel) : source.trustLevel,
      action: stale ? namespace.freshnessPolicy.staleAction : null,
    };
  }
}
