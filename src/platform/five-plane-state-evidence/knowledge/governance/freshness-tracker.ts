import type { KnowledgeSource, KnowledgeNamespace, TrustLevel } from "../knowledge-model.js";
import { degradeTrustLevel, normalizeTrustLevel } from "../knowledge-model.js";

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
      effectiveTrustLevel: stale ? degradeFreshnessTrustLevel(source.trustLevel) : source.trustLevel,
      action: stale ? namespace.freshnessPolicy.staleAction : null,
    };
  }
}

function degradeFreshnessTrustLevel(level: TrustLevel): TrustLevel {
  const rawLevel = String(level);
  if (rawLevel === "verified") return "reviewed" as TrustLevel;
  if (rawLevel === "authoritative") return "official";
  if (rawLevel === "reviewed" || rawLevel === "community" || rawLevel === "unverified") return level;
  return degradeTrustLevel(normalizeTrustLevel(level));
}
