import { autonomyAuditService, AutonomyAuditService } from "./autonomy-audit-service.js";
export { AutonomyGovernanceService } from "./autonomy-governance-service.js";
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
export declare class ProgressiveAutonomyService implements AutonomyPolicyPort {
    private readonly profiles;
    private readonly auditCallbacks;
    registerProfile(profile: AgentTrustProfile): void;
    onAutonomyChange(callback: (event: AutonomyChangeEvent) => void): void;
    evaluate(subjectId: string): Promise<AutonomyDecision>;
    evaluateProfile(profile: AgentTrustProfile, options?: AutonomyEvaluationOptions): ProgressiveAutonomyEvaluation;
}
