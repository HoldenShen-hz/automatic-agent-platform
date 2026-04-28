import type { AgentTrustProfile, AutonomyLevel, CapabilityTrustScore, TrustLevel } from "./index.js";
import { compareAutonomyLevels, nextAutonomyLevel } from "./level-manager/index.js";
import { assessPromotion } from "./promotion-engine/index.js";
import { calculateTrustScore, mapTrustLevel } from "./trust-scorer/index.js";
import type { AutonomyAuditService } from "./autonomy-audit-service.js";

export interface AutonomyGovernanceDecision {
  readonly agentId: string;
  readonly capabilityId: string;
  readonly currentLevel: AutonomyLevel;
  readonly recommendedLevel: AutonomyLevel;
  readonly trustScore: number;
  readonly trustLevel: TrustLevel;
  readonly promoted: boolean;
  readonly reasonCodes: readonly string[];
}

export interface AutonomyGovernanceSnapshot {
  readonly agentId: string;
  readonly overallTrustScore: number;
  readonly overallTrustLevel: TrustLevel;
  readonly decisions: readonly AutonomyGovernanceDecision[];
}

export class AutonomyGovernanceService {
  private auditService: AutonomyAuditService | null = null;
  private readonly frozenAgents = new Set<string>();
  private readonly maxAutonomyByAgent = new Map<string, AutonomyLevel>();

  public setAuditService(auditService: AutonomyAuditService | null): void {
    this.auditService = auditService;
  }

  public getMaxAutonomyLevel(agentId: string): AutonomyLevel {
    return this.maxAutonomyByAgent.get(agentId) ?? "full_auto";
  }

  public canPromote(agentId: string, _capabilityId: string, targetLevel: AutonomyLevel): boolean {
    return !this.isFrozen(agentId) && compareAutonomyLevels(targetLevel, this.getMaxAutonomyLevel(agentId)) <= 0;
  }

  public canDemote(agentId: string, _capabilityId: string, _targetLevel: AutonomyLevel): boolean {
    return !this.isFrozen(agentId);
  }

  public isFrozen(agentId: string): boolean {
    void this.auditService;
    return this.frozenAgents.has(agentId);
  }

  public evaluateProfile(profile: AgentTrustProfile): AutonomyGovernanceSnapshot {
    const decisions = profile.capabilityScores.map((score) => this.evaluateCapability(profile.agentId, score));
    const overallTrustScore = decisions.length === 0
      ? 0
      : Math.round(decisions.reduce((sum, item) => sum + item.trustScore, 0) / decisions.length);

    return {
      agentId: profile.agentId,
      overallTrustScore,
      overallTrustLevel: reconcileProfileTrustLevel(overallTrustScore, profile),
      decisions,
    };
  }

  public evaluateCapability(agentId: string, score: CapabilityTrustScore): AutonomyGovernanceDecision {
    const trustScore = calculateTrustScore(score);
    const trustLevel = mapTrustLevel(trustScore);
    const promotion = assessPromotion(score);
    const recommendedLevel = promotion.shouldPromote
      ? promotion.targetLevel
      : trustScore < 30
        ? "suggestion"
        : trustScore < 50 && compareAutonomyLevels(score.currentAutonomy, "supervised") > 0
          ? "supervised"
          : score.currentAutonomy;

    return {
      agentId,
      capabilityId: score.capabilityId,
      currentLevel: score.currentAutonomy,
      recommendedLevel,
      trustScore,
      trustLevel,
      promoted: compareAutonomyLevels(recommendedLevel, score.currentAutonomy) > 0
        || (promotion.shouldPromote && recommendedLevel === nextAutonomyLevel(score.currentAutonomy)),
      reasonCodes: promotion.shouldPromote
        ? promotion.reasonCodes
        : promotion.reasonCodes.includes("autonomy.promotion_blocked_by_incident")
          ? promotion.reasonCodes
        : recommendedLevel !== score.currentAutonomy
          ? ["autonomy.level_adjusted_by_trust"]
          : ["autonomy.level_unchanged"],
    };
  }
}

function reconcileProfileTrustLevel(score: number, profile: AgentTrustProfile): TrustLevel {
  if (profile.capabilityScores.length > 0 && score < 30 && profile.overallTrustLevel === "probation") {
    return "probation";
  }
  if (score >= 95 && profile.overallTrustLevel === "probation") {
    return "trusted";
  }
  return mapTrustLevel(score);
}
