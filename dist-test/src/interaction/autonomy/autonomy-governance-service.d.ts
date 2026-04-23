import type { AgentTrustProfile, AutonomyLevel, CapabilityTrustScore, TrustLevel } from "./index.js";
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
export declare class AutonomyGovernanceService {
    evaluateProfile(profile: AgentTrustProfile): AutonomyGovernanceSnapshot;
    evaluateCapability(agentId: string, score: CapabilityTrustScore): AutonomyGovernanceDecision;
}
