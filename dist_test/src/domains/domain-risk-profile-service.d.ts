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
import { type DomainRiskLevel, type DomainRiskProfile, type RiskOverride, type EscalationLevel, type ApprovalRule } from "./risk-profile/index.js";
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
export declare class DomainRiskProfileService {
    private readonly profiles;
    register(profile: DomainRiskProfile): void;
    getProfile(domainId: string): DomainRiskProfile | null;
    assessRisk(domainId: string, dimensionScores: Record<string, number>): RiskAssessment;
    addOverride(domainId: string, override: RiskOverrideRequest): RiskOverride;
    removeOverride(domainId: string, actionPattern: string): boolean;
    private computeScores;
    private findApplicableOverrides;
    private resolveEscalationTarget;
    private findRequiredApprovals;
    private matchesPattern;
    private parseTriggerThreshold;
    private requireProfile;
}
