/**
 * Autonomy Audit Service
 *
 * Persists autonomy level change events to an audit trail.
 * Provides query interface for autonomy change history.
 */

import type { AutonomyLevel, AutonomyChangeEvent } from "./index.js";
import { newId } from "../../platform/contracts/types/ids.js";

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

export class AutonomyAuditService {
  private readonly records: AutonomyAuditRecord[] = [];

  public recordChange(event: AutonomyChangeEvent): AutonomyAuditRecord {
    // §42: Use ULID for globally unique, time-sortable IDs across distributed instances
    const record: AutonomyAuditRecord = {
      id: newId("audit"),
      agentId: event.agentId,
      capabilityId: event.capabilityId,
      eventType: event.eventType,
      fromLevel: event.fromLevel,
      toLevel: event.toLevel,
      trigger: event.trigger,
      approvedBy: event.approvedBy,
      successRate: event.evidence.successRate,
      totalExecutions: event.evidence.totalExecutions,
      incidentCount: event.evidence.incidentCount,
      evaluationWindow: event.evidence.evaluationWindow,
      createdAt: new Date().toISOString(),
    };
    this.records.push(record);
    return record;
  }

  public getByAgent(agentId: string): AutonomyAuditRecord[] {
    return this.records.filter((r) => r.agentId === agentId);
  }

  public getByCapability(agentId: string, capabilityId: string): AutonomyAuditRecord[] {
    return this.records.filter(
      (r) => r.agentId === agentId && r.capabilityId === capabilityId,
    );
  }

  public getRecentChanges(limit: number = 50): AutonomyAuditRecord[] {
    return [...this.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }

  public getSummary(agentId: string): AutonomyAuditSummary {
    const agentRecords = this.getByAgent(agentId);
    if (agentRecords.length === 0) {
      return {
        totalChanges: 0,
        promotions: 0,
        demotions: 0,
        freezes: 0,
        lastChangeAt: null,
      };
    }
    return {
      totalChanges: agentRecords.length,
      promotions: agentRecords.filter((r) => r.eventType === "agent.autonomy.promoted").length,
      demotions: agentRecords.filter((r) => r.eventType === "agent.autonomy.demoted").length,
      freezes: agentRecords.filter((r) => r.eventType === "agent.autonomy.frozen").length,
      lastChangeAt: agentRecords.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]!.createdAt,
    };
  }

  public listRecords(): AutonomyAuditRecord[] {
    return [...this.records];
  }
}

export const autonomyAuditService = new AutonomyAuditService();
