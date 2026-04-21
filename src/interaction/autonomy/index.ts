import { nowIso } from "../../platform/contracts/types/ids.js";
import { autonomyAuditService, AutonomyAuditService } from "./autonomy-audit-service.js";

export { autonomyAuditService, AutonomyAuditService };

export type AutonomyLevel = "suggestion" | "supervised" | "semi_auto" | "full_auto" | "frozen";
export type TrustLevel = "untrusted" | "probation" | "supervised" | "semi_trusted" | "trusted" | "fully_trusted";

/**
 * Incident severity classification.
 * - P0: Critical - immediate freeze
 * - P1: High - demote one level (not freeze)
 * - P2: Medium - warning or minor penalty
 * - P3: Low - informational
 */
export type IncidentSeverity = "P0" | "P1" | "P2" | "P3";

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
  /** Severity of the most recent incident (P0=P0, P1=P1, etc.) */
  readonly lastIncidentSeverity?: IncidentSeverity;
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
    readonly incidentSeverity?: IncidentSeverity;
  };
}

export interface ProgressiveAutonomyEvaluation {
  readonly decision: AutonomyDecision;
  readonly capabilityLevels: Readonly<Record<string, AutonomyLevel>>;
  readonly changeEvents: readonly AutonomyChangeEvent[];
}

export interface AutonomyEvaluationOptions {
  windowDays?: number;
  freezeOnIncident?: boolean;
  /** Enable severity-based demotion: P1 incidents demote one level instead of freezing */
  severityBasedDemotion?: boolean;
  minVolumeForPromotion?: number;
  minVolumeForDemotion?: number;
}

const DEFAULT_OPTIONS: AutonomyEvaluationOptions = {
  windowDays: 30,
  freezeOnIncident: true,
  severityBasedDemotion: true,
  minVolumeForPromotion: 10,
  minVolumeForDemotion: 3,
};

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

/**
 * Autonomy level order (index 0 = lowest, higher = more autonomous)
 */
const AUTONOMY_LEVEL_ORDER: readonly AutonomyLevel[] = [
  "suggestion",
  "supervised",
  "semi_auto",
  "full_auto",
];

/**
 * Severity order (index 0 = lowest severity)
 */
const SEVERITY_ORDER: readonly IncidentSeverity[] = ["P3", "P2", "P1", "P0"];

function severityToIndex(severity: IncidentSeverity): number {
  return SEVERITY_ORDER.indexOf(severity);
}

/**
 * Demotes the autonomy level by one step.
 * Does not demote below "suggestion".
 */
function demoteOneLevel(current: AutonomyLevel): AutonomyLevel {
  if (current === "frozen") {
    return "full_auto"; // Recovery from frozen goes to highest non-frozen
  }
  const index = AUTONOMY_LEVEL_ORDER.indexOf(current);
  if (index <= 0) {
    return "suggestion"; // Already at lowest
  }
  return AUTONOMY_LEVEL_ORDER[index - 1] ?? "suggestion";
}

function decideLevel(
  score: CapabilityTrustScore,
  options: AutonomyEvaluationOptions = DEFAULT_OPTIONS,
): AutonomyLevel {
  const success = successRate(score);
  const overrides = overrideRate(score);

  // §42 P0/P1 Demotion Logic:
  // - P0 incidents: freeze immediately (as before)
  // - P1 incidents: demote one level instead of freezing (when severityBasedDemotion enabled)
  const severity = score.lastIncidentSeverity;
  if (options.freezeOnIncident && score.incidents > 0 && severity === "P0") {
    return "frozen";
  }

  if (score.failedExecutions >= (options.minVolumeForDemotion ?? 3)) {
    return "suggestion";
  }

  if (score.incidents > 0) {
    if (severity === "P1" && options.severityBasedDemotion) {
      // P1 demotes one level instead of freezing
      return demoteOneLevel(score.currentAutonomy);
    }

    if (options.freezeOnIncident) {
      return "frozen";
    }
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
  return [...levels].sort((left, right) => AUTONOMY_LEVEL_ORDER.indexOf(left) - AUTONOMY_LEVEL_ORDER.indexOf(right))[0] ?? "suggestion";
}

export class ProgressiveAutonomyService implements AutonomyPolicyPort {
  private readonly profiles = new Map<string, AgentTrustProfile>();
  private readonly auditCallbacks: Array<(event: AutonomyChangeEvent) => void> = [];

  public registerProfile(profile: AgentTrustProfile): void {
    this.profiles.set(profile.agentId, profile);
  }

  public onAutonomyChange(callback: (event: AutonomyChangeEvent) => void): void {
    this.auditCallbacks.push(callback);
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

  public evaluateProfile(
    profile: AgentTrustProfile,
    options: AutonomyEvaluationOptions = DEFAULT_OPTIONS,
  ): ProgressiveAutonomyEvaluation {
    const capabilityLevels: Record<string, AutonomyLevel> = {};
    const changeEvents: AutonomyChangeEvent[] = [];
    const recalculatedScores = profile.capabilityScores.map((item) => {
      const nextScore = scoreCapability(item);
      const nextLevel = decideLevel(item, options);
      capabilityLevels[item.capabilityId] = nextLevel;

      if (nextLevel !== item.currentAutonomy) {
        const eventType: AutonomyChangeEvent["eventType"] =
          nextLevel === "frozen"
            ? "agent.autonomy.frozen"
            : nextLevel === "suggestion" || compareLevels(nextLevel, item.currentAutonomy) < 0
              ? "agent.autonomy.demoted"
              : "agent.autonomy.promoted";

        const evidence: AutonomyChangeEvent["evidence"] = {
          successRate: successRate(item),
          totalExecutions: item.totalExecutions,
          incidentCount: item.incidents,
          evaluationWindow: `${options.windowDays ?? 30}d`,
          ...(item.lastIncidentSeverity == null ? {} : { incidentSeverity: item.lastIncidentSeverity }),
        };

        const changeEvent: AutonomyChangeEvent = {
          eventType,
          agentId: profile.agentId,
          capabilityId: item.capabilityId,
          fromLevel: item.currentAutonomy,
          toLevel: nextLevel,
          trigger: item.incidents > 0 ? "incident_response" : "rule_engine",
          approvedBy: "auto",
          evidence,
        };
        changeEvents.push(changeEvent);
        this.auditCallbacks.forEach((cb) => cb(changeEvent));
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

function compareLevels(left: AutonomyLevel, right: AutonomyLevel): number {
  const order: readonly AutonomyLevel[] = ["frozen", "suggestion", "supervised", "semi_auto", "full_auto"];
  return order.indexOf(left) - order.indexOf(right);
}
