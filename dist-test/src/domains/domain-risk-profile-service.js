/**
 * Domain Risk Profile Service
 *
 * Handles risk profile operations including:
 * - Effective risk level computation
 * - Risk override application
 * - Escalation chain resolution
 * - Mandatory approval checks
 *
 * As defined in architecture doc §37.3 DomainRiskProfile.
 */
import { newId, nowIso } from "../platform/contracts/types/ids.js";
import { computeDomainRiskLevel, } from "./risk-profile/index.js";
export class DomainRiskProfileService {
    profiles = new Map();
    register(profile) {
        this.profiles.set(profile.domainId, profile);
    }
    getProfile(domainId) {
        return this.profiles.get(domainId) ?? null;
    }
    assessRisk(domainId, dimensionScores) {
        const profile = this.requireProfile(domainId);
        const computed = this.computeScores(profile, dimensionScores);
        const applicableOverrides = this.findApplicableOverrides(profile, computed.totalScore);
        const escalationTarget = this.resolveEscalationTarget(profile, computed.totalScore);
        const requiredApprovals = this.findRequiredApprovals(profile, applicableOverrides);
        return {
            assessmentId: newId("risk_assessment"),
            domainId,
            effectiveRiskLevel: computeDomainRiskLevel(profile, computed.totalScore),
            totalScore: computed.totalScore,
            dimensionScores: computed.dimensionScores,
            applicableOverrides,
            escalationTarget,
            requiredApprovals,
            createdAt: nowIso(),
        };
    }
    addOverride(domainId, override) {
        const profile = this.requireProfile(domainId);
        const newOverride = {
            actionPattern: override.actionPattern,
            baseRisk: override.baseRisk,
            domainRisk: override.domainRisk,
            reason: override.reason,
            requiresJustification: override.requiresJustification ?? false,
        };
        const updated = {
            ...profile,
            riskOverrides: [...(profile.riskOverrides ?? []), newOverride],
        };
        this.profiles.set(domainId, updated);
        return newOverride;
    }
    removeOverride(domainId, actionPattern) {
        const profile = this.requireProfile(domainId);
        const overrides = profile.riskOverrides ?? [];
        const index = overrides.findIndex((o) => o.actionPattern === actionPattern);
        if (index === -1) {
            return false;
        }
        const updated = {
            ...profile,
            riskOverrides: [...overrides.slice(0, index), ...overrides.slice(index + 1)],
        };
        this.profiles.set(domainId, updated);
        return true;
    }
    computeScores(profile, dimensionScores) {
        const scored = [];
        for (const dim of profile.dimensions) {
            const rawScore = dimensionScores[dim.dimension] ?? dim.threshold;
            const weightedScore = (rawScore / 100) * dim.weight;
            scored.push({
                dimension: dim.dimension,
                score: rawScore,
                weight: dim.weight,
                weightedScore,
            });
        }
        const totalScore = scored.reduce((sum, s) => sum + s.weightedScore, 0) * 100;
        return { totalScore, dimensionScores: scored };
    }
    findApplicableOverrides(profile, totalScore) {
        return (profile.riskOverrides ?? []).filter((o) => totalScore >= o.baseRisk && totalScore <= o.domainRisk);
    }
    resolveEscalationTarget(profile, totalScore) {
        const chain = profile.escalationChain ?? [];
        if (chain.length === 0) {
            return null;
        }
        const sorted = [...chain].sort((a, b) => b.level - a.level);
        return sorted.find((e) => totalScore >= this.parseTriggerThreshold(e.trigger))?.target ?? null;
    }
    findRequiredApprovals(profile, overrides) {
        const rules = [...(profile.mandatoryApprovals ?? [])];
        for (const override of overrides) {
            if (override.requiresJustification) {
                const matchingRule = rules.find((r) => this.matchesPattern(override.actionPattern, r.actionPattern));
                if (matchingRule && !rules.includes(matchingRule)) {
                    rules.push(matchingRule);
                }
            }
        }
        return rules;
    }
    matchesPattern(action, pattern) {
        if (pattern === "*") {
            return true;
        }
        const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
        return regex.test(action);
    }
    parseTriggerThreshold(trigger) {
        const match = trigger.match(/score\s*>=\s*(\d+)/);
        if (!match || !match[1]) {
            return 0;
        }
        return Number.parseInt(match[1], 10);
    }
    requireProfile(domainId) {
        const profile = this.profiles.get(domainId);
        if (!profile) {
            throw new Error(`domain_risk.profile_not_found:${domainId}`);
        }
        return profile;
    }
}
//# sourceMappingURL=domain-risk-profile-service.js.map