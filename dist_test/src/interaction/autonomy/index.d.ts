import { autonomyAuditService, AutonomyAuditService } from "./autonomy-audit-service.js";
export { autonomyAuditService, AutonomyAuditService };
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
export interface AutonomyEvaluationOptions {
    windowDays?: number;
    freezeOnIncident?: boolean;
    minVolumeForPromotion?: number;
    minVolumeForDemotion?: number;
}
export declare class ProgressiveAutonomyService implements AutonomyPolicyPort {
    private readonly profiles;
    private readonly auditCallbacks;
    registerProfile(profile: AgentTrustProfile): void;
    onAutonomyChange(callback: (event: AutonomyChangeEvent) => void): void;
    evaluate(subjectId: string): Promise<AutonomyDecision>;
    evaluateProfile(profile: AgentTrustProfile, options?: AutonomyEvaluationOptions): ProgressiveAutonomyEvaluation;
}
