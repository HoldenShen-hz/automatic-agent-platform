import { nowIso } from "../../platform/contracts/types/ids.js";
import {
  mapAutonomyLevelToUnifiedRuntimeMode,
  type UnifiedRuntimeMode,
} from "../../platform/contracts/types/unified-runtime-mode.js";
import { resolveDomainRiskSpec, type DomainRiskSpec } from "../../domains/domain-specs.js";
import { autonomyAuditService, AutonomyAuditService } from "./autonomy-audit-service.js";
export { AutonomyGovernanceService } from "./autonomy-governance-service.js";
export {
  applyTrustDecay,
  mapTrustLevelToAutonomyLevel,
  type ArchitectureAutonomyLevel,
} from "./trust-scorer/index.js";
import { applyTrustDecay } from "./trust-scorer/index.js";

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
  evaluate(subjectId: string): AutonomyDecision | Promise<AutonomyDecision>;
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
  /** §42.2: Timestamp of last incident (for time-window incident-free checks) */
  readonly lastIncidentTimestamp?: string | null;
  /** §42.2: Number of cost overruns (for 200% demotion rule) */
  readonly costOverruns: number;
  /** §42.3: Days since last execution (for trust decay and suggestion demotion) */
  readonly lastExecutionAgeDays: number | null;
}

export interface AgentTrustProfile {
  readonly agentId: string;
  readonly domainId: string;
  readonly capabilityScores: readonly CapabilityTrustScore[];
  readonly overallTrustLevel: TrustLevel;
  readonly lastEvaluation: string;
}

export interface AutonomyChangeEvent {
  readonly eventId?: string;
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
  readonly impactReports: readonly AutonomyChangeImpactReport[];
}

export interface AutonomyChangeImpactReport {
  readonly reportId: string;
  readonly agentId: string;
  readonly capabilityId: string;
  readonly fromLevel: AutonomyLevel;
  readonly toLevel: AutonomyLevel;
  readonly activeRunsImpact: "none" | "limited" | "broad";
  readonly slaImpact: "none" | "warning" | "degradation_risk";
  readonly approvalQueueImpact: "none" | "increase_expected";
  readonly budgetImpact: "none" | "higher_human_review_cost";
  readonly businessOwnerAction: "inform" | "confirm" | "immediate_pause";
}

export class TrustDecayWorker {
  public run(
    profile: AgentTrustProfile,
    options: {
      readonly inactiveDays: number;
      readonly decayRate?: number;
    },
  ): AgentTrustProfile {
    // §42.3: 180d no-execution -> suggestion demotion
    // If a capability has had no executions for 180+ days, demote to suggestion
    const updatedScores = profile.capabilityScores.map((item) => {
      let newTrustScore = applyTrustDecay(item.truckScore, options.inactiveDays, options.decayRate);

      // §42.3: 180 days no-execution triggers suggestion demotion
      if (options.inactiveDays >= 180 && item.totalExecutions > 0) {
        // After 180 days of inactivity, demote to suggestion level
        // The trust score will be heavily decayed anyway
        return {
          ...item,
          trustScore: Math.min(newTrustScore, 200), // Cap at suggestion-level trust
        };
      }
      return {
        ...item,
        trustScore: newTrustScore,
      };
    });

    return {
      ...profile,
      capabilityScores: updatedScores,
      lastEvaluation: nowIso(),
    };
  }
}

export interface AutonomyEvaluationOptions {
  windowDays?: number;
  freezeOnIncident?: boolean;
  /** Enable severity-based demotion: P1 incidents demote one level instead of freezing */
  severityBasedDemotion?: boolean;
  minVolumeForPromotion?: number;
  minVolumeForDemotion?: number;
  highRiskDomainIds?: readonly string[];
  resolveDomainRiskSpec?: (domainId: string) => DomainRiskSpec | null;
  /** §42.2: Promotion time windows - incident-free periods required for promotion */
  promotionTimeWindows?: {
    toSupervisedDays?: number;   // 30d default
    toSemiAutoDays?: number;     // 60d default
    toFullAutoDays?: number;     // 90d default
  };
  /** §42.2: Cost overrun demotion threshold (default 2.0 = 200%) */
  costOverrunDemotionThreshold?: number;
}

const DEFAULT_OPTIONS: AutonomyEvaluationOptions = {
  windowDays: 30,
  freezeOnIncident: true,
  severityBasedDemotion: true,
  minVolumeForPromotion: 50,
  minVolumeForDemotion: 3,
  highRiskDomainIds: ["medical", "healthcare", "financial-services", "finance-accounting", "quant-trading", "legal"],
  resolveDomainRiskSpec,
  // §42.2: Promotion time windows (incident-free periods)
  promotionTimeWindows: {
    toSupervisedDays: 30,
    toSemiAutoDays: 60,
    toFullAutoDays: 90,
  },
  // §42.2: Cost overrun demotion at 200%
  costOverrunDemotionThreshold: 2.0,
};

function successRate(score: CapabilityTrustScore): number {
  return score.totalExecutions === 0 ? 0 : score.successfulExecutions / score.totalExecutions;
}

function overrideRate(score: CapabilityTrustScore): number {
  return score.totalExecutions === 0 ? 1 : score.humanOverrides / score.totalExecutions;
}

function trustLevelFromScore(score: number): TrustLevel {
  if (score >= 950) return "fully_trusted";
  if (score >= 850) return "trusted";
  if (score >= 700) return "semi_trusted";
  if (score >= 500) return "supervised";
  if (score >= 300) return "probation";
  return "untrusted";
}

function scoreCapability(score: CapabilityTrustScore): number {
  const success = successRate(score);
  const overridePenalty = overrideRate(score) * 200;
  const incidentPenalty = score.incidents * 150;
  const volumeBonus = Math.min(100, Math.floor(score.totalExecutions / 50));
  // §42.1: TrustScore range 0-1000 (expanded from 0-100)
  return Math.max(
    0,
    Math.min(
      1000,
      Math.round(success * 1000 - overridePenalty - incidentPenalty + volumeBonus),
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

  if (score.incidents > 0) {
    if (severity === "P1" && options.severityBasedDemotion) {
      // P1 demotes one level instead of freezing
      return score.currentAutonomy === "suggestion" ? "suggestion" : demoteOneLevel(score.currentAutonomy);
    }

    if (options.freezeOnIncident) {
      return "frozen";
    }
    return "suggestion";
  }

  if (score.failedExecutions >= (options.minVolumeForDemotion ?? 3)) {
    if (score.currentAutonomy === "frozen" && score.incidents === 0) {
      // Allow recovery to be driven by fresh success evidence once incidents clear.
    } else {
      return "suggestion";
    }
  } else if (score.failedExecutions > 0 && score.totalExecutions >= 50) {
    return score.currentAutonomy === "suggestion" ? "supervised" : score.currentAutonomy;
  }

  if (score.totalExecutions >= 500 && success >= 0.99 && overrides < 0.01) {
    return "full_auto";
  }
  if (score.totalExecutions >= 200 && success >= 0.98 && overrides < 0.05) {
    return "semi_auto";
  }
  if (score.totalExecutions >= (options.minVolumeForPromotion ?? 50) && success >= 0.95) {
    return "supervised";
  }
  return "suggestion";
}

function applyDomainRiskAutonomyCap(
  domainId: string,
  level: AutonomyLevel,
  options: AutonomyEvaluationOptions = DEFAULT_OPTIONS,
): AutonomyLevel {
  const resolvedSpec = options.resolveDomainRiskSpec?.(domainId) ?? DEFAULT_OPTIONS.resolveDomainRiskSpec?.(domainId) ?? null;
  if (resolvedSpec != null) {
    if (resolvedSpec.advisoryOnly || resolvedSpec.riskClass === "critical") {
      return level === "frozen" ? "frozen" : "suggestion";
    }
    if (resolvedSpec.humanAccountable || resolvedSpec.riskClass === "high") {
      return lowestLevel([level, "supervised"]);
    }
    if (resolvedSpec.deterministicHotPathOnly && level === "full_auto") {
      return "semi_auto";
    }
    return level;
  }

  const highRiskDomainIds = options.highRiskDomainIds ?? DEFAULT_OPTIONS.highRiskDomainIds ?? [];
  if (highRiskDomainIds.includes(domainId)) {
    return lowestLevel([level, "supervised"]);
  }
  return level;
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

  public evaluate(subjectId: string): AutonomyDecision {
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
    const impactReports: AutonomyChangeImpactReport[] = [];
    const recalculatedScores = profile.capabilityScores.map((item) => {
      const nextScore = scoreCapability(item);
      const nextLevel = applyDomainRiskAutonomyCap(profile.domainId, decideLevel(item, options), options);
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
          eventId: `autonomy_event_${Date.now()}_${changeEvents.length + 1}`,
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
        impactReports.push({
          reportId: `autonomy_impact_${Date.now()}_${impactReports.length + 1}`,
          agentId: profile.agentId,
          capabilityId: item.capabilityId,
          fromLevel: item.currentAutonomy,
          toLevel: nextLevel,
          activeRunsImpact: item.currentAutonomy === "full_auto" && nextLevel !== "full_auto" ? "broad" : "limited",
          slaImpact: item.currentAutonomy === "full_auto" && nextLevel === "suggestion" ? "degradation_risk" : "warning",
          approvalQueueImpact: nextLevel === "suggestion" || nextLevel === "supervised" ? "increase_expected" : "none",
          budgetImpact: nextLevel === "suggestion" ? "higher_human_review_cost" : "none",
          businessOwnerAction: nextLevel === "frozen" ? "immediate_pause" : "inform",
        });
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
      impactReports,
    };
  }
}

export function toUnifiedRuntimeMode(level: AutonomyLevel): UnifiedRuntimeMode {
  return mapAutonomyLevelToUnifiedRuntimeMode(level);
}

function compareLevels(left: AutonomyLevel, right: AutonomyLevel): number {
  const order: readonly AutonomyLevel[] = ["frozen", "suggestion", "supervised", "semi_auto", "full_auto"];
  return order.indexOf(left) - order.indexOf(right);
}
