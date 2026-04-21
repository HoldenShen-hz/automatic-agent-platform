/**
 * Autonomy Audit Service
 *
 * Persists autonomy level change events to an audit trail.
 * Provides query interface for autonomy change history.
 */
import type { AutonomyLevel, AutonomyChangeEvent } from "./index.js";
export interface AutonomyAuditRecord {
    id: string;
    agentId: string;
    capabilityId: string;
    eventType: AutonomyChangeEvent["eventType"];
    fromLevel: AutonomyLevel;
    toLevel: AutonomyLevel;
    trigger: AutonomyChangeEvent["trigger"];
    approvedBy: string;
    successRate: number;
    totalExecutions: number;
    incidentCount: number;
    evaluationWindow: string;
    createdAt: string;
}
export interface AutonomyAuditSummary {
    totalChanges: number;
    promotions: number;
    demotions: number;
    freezes: number;
    lastChangeAt: string | null;
}
export declare class AutonomyAuditService {
    private readonly records;
    recordChange(event: AutonomyChangeEvent): AutonomyAuditRecord;
    getByAgent(agentId: string): AutonomyAuditRecord[];
    getByCapability(agentId: string, capabilityId: string): AutonomyAuditRecord[];
    getRecentChanges(limit?: number): AutonomyAuditRecord[];
    getSummary(agentId: string): AutonomyAuditSummary;
    listRecords(): AutonomyAuditRecord[];
}
export declare const autonomyAuditService: AutonomyAuditService;
