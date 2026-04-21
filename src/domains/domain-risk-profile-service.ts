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
import {
  computeDomainRiskLevel,
  type DomainRiskLevel,
  type DomainRiskProfile,
  type RiskOverride,
  type EscalationLevel,
  type ApprovalRule,
} from "./risk-profile/index.js";

export interface RiskScore {
  readonly dimension: string;
  readonly score: number;
  readonly weight: number;
  readonly weightedScore: number;
}

export interface RiskAssessment {
  readonly assessmentId: string;
  readonly domainId: string;
  readonly effectiveRiskLevel: DomainRiskLevel;
  readonly totalScore: number;
  readonly dimensionScores: readonly RiskScore[];
  readonly applicableOverrides: readonly RiskOverride[];
  readonly escalationTarget: EscalationLevel["target"] | null;
  readonly requiredApprovals: readonly ApprovalRule[];
  readonly createdAt: string;
}

export interface RiskOverrideRequest {
  readonly actionPattern: string;
  readonly baseRisk: number;
  readonly domainRisk: number;
  readonly reason: string;
  readonly requiresJustification?: boolean;
}

export class DomainRiskProfileService {
  private readonly profiles = new Map<string, DomainRiskProfile>();

  public register(profile: DomainRiskProfile): void {
    this.profiles.set(profile.domainId, profile);
  }

  public getProfile(domainId: string): DomainRiskProfile | null {
    return this.profiles.get(domainId) ?? null;
  }

  public assessRisk(domainId: string, dimensionScores: Record<string, number>): RiskAssessment {
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

  public addOverride(domainId: string, override: RiskOverrideRequest): RiskOverride {
    const profile = this.requireProfile(domainId);
    const newOverride: RiskOverride = {
      actionPattern: override.actionPattern,
      baseRisk: override.baseRisk,
      domainRisk: override.domainRisk,
      reason: override.reason,
      requiresJustification: override.requiresJustification ?? false,
    };

    const updated: DomainRiskProfile = {
      ...profile,
      riskOverrides: [...(profile.riskOverrides ?? []), newOverride],
    };
    this.profiles.set(domainId, updated);
    return newOverride;
  }

  public removeOverride(domainId: string, actionPattern: string): boolean {
    const profile = this.requireProfile(domainId);
    const overrides = profile.riskOverrides ?? [];
    const index = overrides.findIndex((o) => o.actionPattern === actionPattern);
    if (index === -1) {
      return false;
    }

    const updated: DomainRiskProfile = {
      ...profile,
      riskOverrides: [...overrides.slice(0, index), ...overrides.slice(index + 1)],
    };
    this.profiles.set(domainId, updated);
    return true;
  }

  private computeScores(
    profile: DomainRiskProfile,
    dimensionScores: Record<string, number>,
  ): { totalScore: number; dimensionScores: RiskScore[] } {
    const scored: RiskScore[] = [];

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

  private findApplicableOverrides(profile: DomainRiskProfile, totalScore: number): RiskOverride[] {
    return (profile.riskOverrides ?? []).filter(
      (o) => totalScore >= o.baseRisk && totalScore <= o.domainRisk,
    );
  }

  private resolveEscalationTarget(
    profile: DomainRiskProfile,
    totalScore: number,
  ): EscalationLevel["target"] | null {
    const chain = profile.escalationChain ?? [];
    if (chain.length === 0) {
      return null;
    }

    const sorted = [...chain].sort((a, b) => b.level - a.level);
    return sorted.find((e) => totalScore >= this.parseTriggerThreshold(e.trigger))?.target ?? null;
  }

  private findRequiredApprovals(profile: DomainRiskProfile, overrides: RiskOverride[]): ApprovalRule[] {
    const rules: ApprovalRule[] = [...(profile.mandatoryApprovals ?? [])];

    for (const override of overrides) {
      if (override.requiresJustification) {
        const matchingRule = rules.find(
          (r) => this.matchesPattern(override.actionPattern, r.actionPattern),
        );
        if (matchingRule && !rules.includes(matchingRule)) {
          rules.push(matchingRule);
        }
      }
    }

    return rules;
  }

  private matchesPattern(action: string, pattern: string): boolean {
    if (pattern === "*") {
      return true;
    }
    const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
    return regex.test(action);
  }

  private parseTriggerThreshold(trigger: string): number {
    const match = trigger.match(/score\s*>=\s*(\d+)/);
    if (!match || !match[1]) {
      return 0;
    }
    return Number.parseInt(match[1], 10);
  }

  private requireProfile(domainId: string): DomainRiskProfile {
    const profile = this.profiles.get(domainId);
    if (!profile) {
      throw new Error(`domain_risk.profile_not_found:${domainId}`);
    }
    return profile;
  }
}
