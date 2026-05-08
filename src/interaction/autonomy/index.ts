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
  calculateTrustScore,
  mapTrustLevel,
  mapTrustLevelToAutonomyLevel,
  type ArchitectureAutonomyLevel,
} from "./trust-scorer/index.js";
import { applyTrustDecay, mapTrustLevel } from "./trust-scorer/index.js";

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
  // R9-44: "auto" = immediate, domain_owner/platform_team = requires approval queue
  readonly approvedBy: string | "auto";
  // R9-44: true when promotion requires human approval before being applied
  readonly requiresApprovalResolution?: boolean;
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

export interface PendingAutonomyApprovalRequest {
  readonly requestId: string;
  readonly agentId: string;
  readonly capabilityId: string;
  readonly fromLevel: AutonomyLevel;
  readonly toLevel: AutonomyLevel;
  readonly requiredApprover: "domain_owner" | "platform_team";
  readonly status: "pending" | "approved" | "rejected";
  readonly createdAt: string;
  readonly resolvedAt: string | null;
  readonly resolvedBy: string | null;
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
      let newTrustScore = applyTrustDecay(item.trustScore, options.inactiveDays, options.decayRate);

      // §42.3: 180 days no-execution triggers suggestion demotion
      if (options.inactiveDays >= 180 && item.totalExecutions > 0) {
        // After 180 days of inactivity, demote to suggestion level
        // The trust score will be heavily decayed anyway
        return {
          ...item,
          trustScore: Math.min(newTrustScore, 200), // Cap at suggestion-level trust
        };
      }

      // §42.3: Execution→suggestion demotion for 30d freeze after demotion
      // If the capability was demoted (currentAutonomy is suggestion but trustScore is high),
      // apply 30d promotion freeze by capping trustScore
      const wasRecentlyDemoted = item.currentAutonomy === "suggestion" && newTrustScore > 300;
      // Apply 30d promotion freeze after demotion (cap trust at probation level)
      const promotionFreezeCap = wasRecentlyDemoted ? 300 : newTrustScore;
      return {
        ...item,
        trustScore: Math.min(newTrustScore, promotionFreezeCap),
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
  return mapTrustLevel(score);
}

/**
 * Score a capability trust profile.
 * §42.1 requires TrustScore range 0-1000 (not 0-100).
 * This function returns 0-1000 for domain-scored trust profiles.
 */
function scoreCapability(score: CapabilityTrustScore): number {
  const success = successRate(score);
  const overridePenalty = overrideRate(score) * 20;
  const incidentPenalty = score.incidents * 15;
  const volumeBonus = Math.min(100, Math.floor(score.totalExecutions / 50));
  // R5-21 fix: Return 0-1000 per §42.1, not 0-100
  // Use 1000 scaling factor and higher penalty scale to align with calculateTrustScore
  const scaledPenalty = overridePenalty * 10; // Scale from 0-20 to 0-200
  const scaledIncidentPenalty = incidentPenalty * 10; // Scale from 0-15 to 0-150
  return Math.max(0, Math.min(1000, Math.round(success * 1000 - scaledPenalty - scaledIncidentPenalty + volumeBonus)));
}

/**
 * Autonomy level order (index 0 = lowest, higher = more autonomous)
 * Includes frozen at index 0 as the lowest autonomy level for manual intervention state.
 * §174-2042 fix: frozen must be included to ensure consistent ordering across modules.
 */
const AUTONOMY_LEVEL_ORDER: readonly AutonomyLevel[] = [
  "frozen",
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
  // §42: frozen requires manual approval for recovery - should never be demoted automatically
  if (current === "frozen") {
    return "frozen";
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

  // §42.2: Cost overrun 200% demotion rule - any execution exceeding 200% of budget triggers demotion
  const costOverrunThreshold = options.costOverrunDemotionThreshold ?? 2.0;
  if (score.costOverruns >= costOverrunThreshold) {
    return "supervised";
  }
  if (score.costOverruns > 0) {
    return "supervised"; // costOverruns records executions that already crossed the 200% guardrail
  }

  // §42 P0/P1 Demotion Logic:
  // - P0 incidents: freeze immediately per R23-07
  // - P1 incidents: demote one level instead of freezing (when severityBasedDemotion enabled)
  const severity = score.lastIncidentSeverity;
  if (score.incidents > 0 && severity === "P0" && !options.severityBasedDemotion) {
    return "frozen";
  }

  // R9-45 fix: Non-P0/P1 incidents require time window check for demotion
  // Only demote if incident is recent (within the promotion time window)
  // Older incidents don't cause demotion - similar to how promotion requires incident-free period
  const timeWindows = options.promotionTimeWindows ?? {};
  const lastIncidentAgeDays = score.lastIncidentAgeDays ?? Number.POSITIVE_INFINITY;
  const recentIncidentThreshold = Math.min(
    timeWindows.toSupervisedDays ?? 30,
    timeWindows.toSemiAutoDays ?? 60,
    timeWindows.toFullAutoDays ?? 90,
  );

  if (score.incidents > 0) {
    // Only apply demotion if incident is recent; older incidents don't trigger demotion
    if (lastIncidentAgeDays > recentIncidentThreshold) {
      // Incident is old - don't demote, but still require incident-free for promotion
    } else if (severity === "P0") {
      // §42.2: P0 incidents demote to suggestion, not frozen
      return "suggestion";
    } else if (severity === "P1" && options.severityBasedDemotion) {
      // P1 demotes one level instead of freezing
      return score.currentAutonomy === "suggestion" ? "suggestion" : demoteOneLevel(score.currentAutonomy);
    } else if (options.freezeOnIncident) {
      // R23-08 fix: Freeze on incident for non-P0 severities that reach this point
      return "frozen";
    } else {
      return "suggestion";
    }
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

  // §42.2: Promotion time window checks (incident-free period required)
  // R9-45 fix: timeWindows already declared above for demotion time window check
  const lastIncidentAge = score.lastIncidentAgeDays ?? Number.POSITIVE_INFINITY;

  // §42.3: 180d no-execution -> suggestion demotion
  const lastExecutionAge = score.lastExecutionAgeDays ?? 0;
  if (lastExecutionAge > 180) {
    return "suggestion"; // Demote to suggestion after 180 days of no execution
  }

  // Check incident-free windows for promotion
  if (score.totalExecutions >= 500 && success >= 0.99 && overrides < 0.01) {
    // §42.2: 90d incident-free for full_auto
    if (lastIncidentAge >= (timeWindows.toFullAutoDays ?? 90)) {
      return "full_auto";
    }
    return "semi_auto"; // Not yet incident-free long enough for full_auto
  }
  if (score.totalExecutions >= 200 && success >= 0.98 && overrides < 0.05) {
    // §42.2: 60d incident-free for semi_auto
    if (lastIncidentAge >= (timeWindows.toSemiAutoDays ?? 60)) {
      return "semi_auto";
    }
    return "supervised"; // Not yet incident-free long enough for semi_auto
  }
  if (score.totalExecutions >= (options.minVolumeForPromotion ?? 50) && success >= 0.95) {
    // §42.2: 30d incident-free for supervised
    if (lastIncidentAge >= (timeWindows.toSupervisedDays ?? 30)) {
      return "supervised";
    }
    return "suggestion"; // Not yet incident-free long enough for supervised
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
  private readonly pendingApprovalRequests = new Map<string, PendingAutonomyApprovalRequest>();

  public registerProfile(profile: AgentTrustProfile): void {
    this.profiles.set(profile.agentId, profile);
  }

  public onAutonomyChange(callback: (event: AutonomyChangeEvent) => void): void {
    this.auditCallbacks.push(callback);
  }

  public listPendingApprovalRequests(agentId?: string): PendingAutonomyApprovalRequest[] {
    const requests = [...this.pendingApprovalRequests.values()].filter((request) => request.status === "pending");
    return agentId == null ? requests : requests.filter((request) => request.agentId === agentId);
  }

  public resolvePendingApproval(
    requestId: string,
    resolution: { readonly approved: boolean; readonly resolvedBy: string; readonly resolvedAt?: string },
  ): PendingAutonomyApprovalRequest | null {
    const existing = this.pendingApprovalRequests.get(requestId);
    if (existing == null || existing.status !== "pending") {
      return null;
    }
    const resolvedAt = resolution.resolvedAt ?? nowIso();
    const updated: PendingAutonomyApprovalRequest = {
      ...existing,
      status: resolution.approved ? "approved" : "rejected",
      resolvedAt,
      resolvedBy: resolution.resolvedBy,
    };
    this.pendingApprovalRequests.set(requestId, updated);

    if (resolution.approved) {
      const profile = this.profiles.get(existing.agentId);
      if (profile != null) {
        const capabilityScores = profile.capabilityScores.map((score) =>
          score.capabilityId === existing.capabilityId
            ? { ...score, currentAutonomy: existing.toLevel }
            : score);
        this.profiles.set(existing.agentId, {
          ...profile,
          capabilityScores,
          lastEvaluation: resolvedAt,
        });
      }
    }

    return updated;
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
    this.profiles.set(profile.agentId, profile);
    const capabilityLevels: Record<string, AutonomyLevel> = {};
    const changeEvents: AutonomyChangeEvent[] = [];
    const impactReports: AutonomyChangeImpactReport[] = [];
    const recalculatedScores = profile.capabilityScores.map((item) => {
      const nextScore = scoreCapability(item);
      const nextLevel = applyDomainRiskAutonomyCap(profile.domainId, decideLevel(item, options), options);
      let effectiveLevel = nextLevel;

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

        // §42.2: Promotions require domain_owner/platform_team approval based on target level
        // - promotions to supervised: domain_owner
        // - promotions to semi_auto: domain_owner
        // - promotions to full_auto: platform_team (requires platform_team approval per §42.2)
        // - incident-driven and demotions use "auto"
        const approvedBy: "auto" | "domain_owner" | "platform_team" =
          item.incidents > 0 || eventType === "agent.autonomy.demoted"
            ? "auto"
            : nextLevel === "full_auto"
              ? "platform_team"
              : nextLevel === "semi_auto"
                ? "domain_owner"
                : nextLevel === "supervised"
                  ? "domain_owner"
                  : "domain_owner";

        // R9-44: Flag promotions that require approval queue integration
        // When approvedBy is domain_owner/platform_team, promotion must be routed to approval queue
        const requiresApprovalResolution = approvedBy !== "auto" && eventType === "agent.autonomy.promoted";
        if (requiresApprovalResolution) {
          effectiveLevel = item.currentAutonomy;
          this.ensurePendingApprovalRequest(
            profile.agentId,
            item.capabilityId,
            item.currentAutonomy,
            nextLevel,
            approvedBy,
          );
        }

        const changeEvent: AutonomyChangeEvent = {
          eventId: `autonomy_event_${Date.now()}_${changeEvents.length + 1}`,
          eventType,
          agentId: profile.agentId,
          capabilityId: item.capabilityId,
          fromLevel: item.currentAutonomy,
          toLevel: nextLevel,
          trigger: item.incidents > 0 ? "incident_response" : "rule_engine",
          approvedBy,
          requiresApprovalResolution,
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
          approvalQueueImpact: requiresApprovalResolution ? "increase_expected" : "none",
          budgetImpact: nextLevel === "suggestion" ? "higher_human_review_cost" : "none",
          businessOwnerAction: nextLevel === "frozen"
            ? "immediate_pause"
            : requiresApprovalResolution
              ? "confirm"
              : "inform",
        });
        this.auditCallbacks.forEach((cb) => cb(changeEvent));
      }
      capabilityLevels[item.capabilityId] = effectiveLevel;
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

  private ensurePendingApprovalRequest(
    agentId: string,
    capabilityId: string,
    fromLevel: AutonomyLevel,
    toLevel: AutonomyLevel,
    requiredApprover: "domain_owner" | "platform_team",
  ): void {
    const existing = [...this.pendingApprovalRequests.values()].find((request) =>
      request.agentId === agentId
      && request.capabilityId === capabilityId
      && request.fromLevel === fromLevel
      && request.toLevel === toLevel
      && request.status === "pending");
    if (existing != null) {
      return;
    }
    const createdAt = nowIso();
    const request: PendingAutonomyApprovalRequest = {
      requestId: `autonomy_approval_${Date.now()}_${this.pendingApprovalRequests.size + 1}`,
      agentId,
      capabilityId,
      fromLevel,
      toLevel,
      requiredApprover,
      status: "pending",
      createdAt,
      resolvedAt: null,
      resolvedBy: null,
    };
    this.pendingApprovalRequests.set(request.requestId, request);
  }
}

export function toUnifiedRuntimeMode(level: AutonomyLevel): UnifiedRuntimeMode {
  return mapAutonomyLevelToUnifiedRuntimeMode(level);
}

function compareLevels(left: AutonomyLevel, right: AutonomyLevel): number {
  // frozen is not part of normal autonomy progression - exclude from comparison
  const order: readonly AutonomyLevel[] = ["suggestion", "supervised", "semi_auto", "full_auto"];
  return order.indexOf(left) - order.indexOf(right);
}
