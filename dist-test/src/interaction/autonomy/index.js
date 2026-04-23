import { nowIso } from "../../platform/contracts/types/ids.js";
import { autonomyAuditService, AutonomyAuditService } from "./autonomy-audit-service.js";
export { AutonomyGovernanceService } from "./autonomy-governance-service.js";
export { autonomyAuditService, AutonomyAuditService };
const DEFAULT_OPTIONS = {
    windowDays: 30,
    freezeOnIncident: true,
    severityBasedDemotion: true,
    minVolumeForPromotion: 10,
    minVolumeForDemotion: 3,
};
function successRate(score) {
    return score.totalExecutions === 0 ? 0 : score.successfulExecutions / score.totalExecutions;
}
function overrideRate(score) {
    return score.totalExecutions === 0 ? 1 : score.humanOverrides / score.totalExecutions;
}
function trustLevelFromScore(score) {
    if (score >= 95)
        return "fully_trusted";
    if (score >= 85)
        return "trusted";
    if (score >= 70)
        return "semi_trusted";
    if (score >= 50)
        return "supervised";
    if (score >= 30)
        return "probation";
    return "untrusted";
}
function scoreCapability(score) {
    const success = successRate(score);
    const overridePenalty = overrideRate(score) * 20;
    const incidentPenalty = score.incidents * 15;
    const volumeBonus = Math.min(10, Math.floor(score.totalExecutions / 50));
    return Math.max(0, Math.min(100, Math.round(success * 100 - overridePenalty - incidentPenalty + volumeBonus)));
}
/**
 * Autonomy level order (index 0 = lowest, higher = more autonomous)
 */
const AUTONOMY_LEVEL_ORDER = [
    "suggestion",
    "supervised",
    "semi_auto",
    "full_auto",
];
/**
 * Severity order (index 0 = lowest severity)
 */
const SEVERITY_ORDER = ["P3", "P2", "P1", "P0"];
function severityToIndex(severity) {
    return SEVERITY_ORDER.indexOf(severity);
}
/**
 * Demotes the autonomy level by one step.
 * Does not demote below "suggestion".
 */
function demoteOneLevel(current) {
    if (current === "frozen") {
        return "full_auto"; // Recovery from frozen goes to highest non-frozen
    }
    const index = AUTONOMY_LEVEL_ORDER.indexOf(current);
    if (index <= 0) {
        return "suggestion"; // Already at lowest
    }
    return AUTONOMY_LEVEL_ORDER[index - 1] ?? "suggestion";
}
function decideLevel(score, options = DEFAULT_OPTIONS) {
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
function lowestLevel(levels) {
    return [...levels].sort((left, right) => AUTONOMY_LEVEL_ORDER.indexOf(left) - AUTONOMY_LEVEL_ORDER.indexOf(right))[0] ?? "suggestion";
}
export class ProgressiveAutonomyService {
    profiles = new Map();
    auditCallbacks = [];
    registerProfile(profile) {
        this.profiles.set(profile.agentId, profile);
    }
    onAutonomyChange(callback) {
        this.auditCallbacks.push(callback);
    }
    async evaluate(subjectId) {
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
    evaluateProfile(profile, options = DEFAULT_OPTIONS) {
        const capabilityLevels = {};
        const changeEvents = [];
        const recalculatedScores = profile.capabilityScores.map((item) => {
            const nextScore = scoreCapability(item);
            const nextLevel = decideLevel(item, options);
            capabilityLevels[item.capabilityId] = nextLevel;
            if (nextLevel !== item.currentAutonomy) {
                const eventType = nextLevel === "frozen"
                    ? "agent.autonomy.frozen"
                    : nextLevel === "suggestion" || compareLevels(nextLevel, item.currentAutonomy) < 0
                        ? "agent.autonomy.demoted"
                        : "agent.autonomy.promoted";
                const evidence = {
                    successRate: successRate(item),
                    totalExecutions: item.totalExecutions,
                    incidentCount: item.incidents,
                    evaluationWindow: `${options.windowDays ?? 30}d`,
                    ...(item.lastIncidentSeverity == null ? {} : { incidentSeverity: item.lastIncidentSeverity }),
                };
                const changeEvent = {
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
function compareLevels(left, right) {
    const order = ["frozen", "suggestion", "supervised", "semi_auto", "full_auto"];
    return order.indexOf(left) - order.indexOf(right);
}
//# sourceMappingURL=index.js.map