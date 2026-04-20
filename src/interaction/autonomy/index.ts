import { nowIso } from "../../platform/contracts/types/ids.js";

export type AutonomyLevel = "suggestion" | "supervised" | "semi_auto" | "full_auto" | "frozen";
export type TrustLevel = "untrusted" | "probation" | "supervised" | "semi_trusted" | "trusted" | "fully_trusted";

export interface AutonomyDecision {
  readonly level: AutonomyLevel;
  readonly trustScore: number;
  readonly rationale: string;
  readonly trustLevel: TrustLevel;
}

export interface AutonomyPolicyPort {
  evaluate(subjectId: string): Promise<AutonomyDecision>;
}

export interface CapabilityTrustScore {
  readonly capabilityId: string;
  readonly currentAutonomy: AutonomyLevel;
  readonly trustScore: number;
  readonly totalExecutions: number;
  readonly successfulExecutions: number;
  readonly failedExecutions: number;
  readonly humanOverrides: number;
  readonly incidents: number;
  readonly lastIncidentAgeDays: number | null;
}

export interface AgentTrustProfile {
  readonly agentId: string;
  readonly domainId: string;
  readonly capabilityScores: readonly CapabilityTrustScore[];
  readonly overallTrustLevel: TrustLevel;
  readonly lastEvaluation: string;
}

export interface AutonomyChangeEvent {
  readonly eventType: "agent.autonomy.promoted" | "agent.autonomy.demoted" | "agent.autonomy.frozen";
  readonly agentId: string;
  readonly capabilityId: string;
  readonly fromLevel: AutonomyLevel;
  readonly toLevel: AutonomyLevel;
  readonly trigger: "rule_engine" | "manual" | "incident_response";
  readonly approvedBy: string | "auto";
  readonly evidence: {
    readonly successRate: number;
    readonly totalExecutions: number;
    readonly incidentCount: number;
    readonly evaluationWindow: string;
  };
}

export interface ProgressiveAutonomyEvaluation {
  readonly decision: AutonomyDecision;
  readonly capabilityLevels: Readonly<Record<string, AutonomyLevel>>;
  readonly changeEvents: readonly AutonomyChangeEvent[];
}

function successRate(score: CapabilityTrustScore): number {
  return score.totalExecutions === 0 ? 0 : score.successfulExecutions / score.totalExecutions;
}

function overrideRate(score: CapabilityTrustScore): number {
  return score.totalExecutions === 0 ? 1 : score.humanOverrides / score.totalExecutions;
}

function trustLevelFromScore(score: number): TrustLevel {
  if (score >= 95) return "fully_trusted";
  if (score >= 85) return "trusted";
  if (score >= 70) return "semi_trusted";
  if (score >= 50) return "supervised";
  if (score >= 30) return "probation";
  return "untrusted";
}

function scoreCapability(score: CapabilityTrustScore): number {
  const success = successRate(score);
  const overridePenalty = overrideRate(score) * 20;
  const incidentPenalty = score.incidents * 15;
  const volumeBonus = Math.min(10, Math.floor(score.totalExecutions / 50));
  return Math.max(
    0,
    Math.min(
      100,
      Math.round(success * 100 - overridePenalty - incidentPenalty + volumeBonus),
    ),
  );
}

function decideLevel(score: CapabilityTrustScore): AutonomyLevel {
  const success = successRate(score);
  const overrides = overrideRate(score);

  if (score.incidents > 0 || score.failedExecutions >= 3) {
    return "suggestion";
  }
  if (score.totalExecutions >= 500 && success >= 0.99 && overrides < 0.01) {
    return "full_auto";
  }
  if (score.totalExecutions >= 200 && success >= 0.98 && overrides < 0.05) {
    return "semi_auto";
  }
  if (score.totalExecutions >= 50 && success >= 0.95) {
    return "supervised";
  }
  return "suggestion";
}

function lowestLevel(levels: readonly AutonomyLevel[]): AutonomyLevel {
  const order: readonly AutonomyLevel[] = ["suggestion", "supervised", "semi_auto", "full_auto", "frozen"];
  return [...levels].sort((left, right) => order.indexOf(left) - order.indexOf(right))[0] ?? "suggestion";
}

export class ProgressiveAutonomyService implements AutonomyPolicyPort {
  private readonly profiles = new Map<string, AgentTrustProfile>();

  public registerProfile(profile: AgentTrustProfile): void {
    this.profiles.set(profile.agentId, profile);
  }

  public async evaluate(subjectId: string): Promise<AutonomyDecision> {
    const profile = this.profiles.get(subjectId);
    if (profile == null) {
      return {
        level: "suggestion",
        trustScore: 0,
        rationale: "No trust history exists for this subject.",
        trustLevel: "untrusted",
      };
    }
    return this.evaluateProfile(profile).decision;
  }

  public evaluateProfile(profile: AgentTrustProfile): ProgressiveAutonomyEvaluation {
    const capabilityLevels: Record<string, AutonomyLevel> = {};
    const changeEvents: AutonomyChangeEvent[] = [];
    const recalculatedScores = profile.capabilityScores.map((item) => {
      const nextScore = scoreCapability(item);
      const nextLevel = decideLevel(item);
      capabilityLevels[item.capabilityId] = nextLevel;

      if (nextLevel !== item.currentAutonomy) {
        changeEvents.push({
          eventType: nextLevel === "suggestion" ? "agent.autonomy.demoted" : "agent.autonomy.promoted",
          agentId: profile.agentId,
          capabilityId: item.capabilityId,
          fromLevel: item.currentAutonomy,
          toLevel: nextLevel,
          trigger: item.incidents > 0 ? "incident_response" : "rule_engine",
          approvedBy: "auto",
          evidence: {
            successRate: successRate(item),
            totalExecutions: item.totalExecutions,
            incidentCount: item.incidents,
            evaluationWindow: "30d",
          },
        });
      }
      return nextScore;
    });

    const overallScore = recalculatedScores.length === 0
      ? 0
      : Math.round(recalculatedScores.reduce((sum, item) => sum + item, 0) / recalculatedScores.length);
    const levels = Object.values(capabilityLevels);
    const level = levels.length === 0 ? "suggestion" : lowestLevel(levels);
    const trustLevel = trustLevelFromScore(overallScore);

    return {
      decision: {
        level,
        trustScore: overallScore,
        rationale: `Evaluated ${profile.capabilityScores.length} capabilities at ${nowIso()}.`,
        trustLevel,
      },
      capabilityLevels,
      changeEvents,
    };
  }
}
