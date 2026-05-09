/**
 * Delegation Audit Service
 *
 * Provides persistent audit trail for delegation operations:
 * - Delegation creation and lifecycle events
 * - Governance decisions
 * - Permission changes
 *
 * Architecture: §51 Delegation Governance
 */

import { newId, nowIso } from "../../contracts/types/ids.js";

export type DelegationAuditEventType =
  | "delegation.governance.evaluated"
  | "delegation.governance.approved"
  | "delegation.governance.denied"
  | "delegation.created"
  | "delegation.completed"
  | "delegation.failed"
  | "delegation.cancelled"
  | "delegation.expired"
  | "delegation.permission_narrowed";

export interface DelegationAuditEvent {
  id: string;
  eventType: DelegationAuditEventType;
  delegationId: string | null;
  parentAgentId: string;
  childAgentId: string | null;
  depth: number;
  reasonCode: string;
  metadata: Record<string, unknown>;
  actorId: string;
  actorType: "user" | "agent" | "system";
  createdAt: string;
}

export interface DelegationAuditSummary {
  totalEvents: number;
  byType: Record<DelegationAuditEventType, number>;
  byAgent: Record<string, number>;
  lastEventAt: string | null;
}

export class DelegationAuditService {
  private readonly events: DelegationAuditEvent[] = [];

  public record(event: Omit<DelegationAuditEvent, "id" | "createdAt">): DelegationAuditEvent {
    const record: DelegationAuditEvent = {
      ...event,
      id: newId("dlg_audit"),
      createdAt: nowIso(),
    };
    this.events.push(record);
    return record;
  }

  public recordGovernanceEvaluation(params: {
    delegationId: string | null;
    parentAgentId: string;
    childAgentId: string | null;
    depth: number;
    reasonCode: string;
    decision: "allow" | "deny" | "allow_with_constraints" | "require_approval";
    evaluatedRules: string[];
    actorId: string;
    actorType: "user" | "agent" | "system";
  }): DelegationAuditEvent {
    return this.record({
      eventType: params.decision === "deny"
        ? "delegation.governance.denied"
        : params.decision === "require_approval"
          ? "delegation.governance.evaluated"
          : "delegation.governance.approved",
      delegationId: params.delegationId,
      parentAgentId: params.parentAgentId,
      childAgentId: params.childAgentId,
      depth: params.depth,
      reasonCode: params.reasonCode,
      metadata: { evaluatedRules: params.evaluatedRules },
      actorId: params.actorId,
      actorType: params.actorType,
    });
  }

  public recordDelegationCreated(params: {
    delegationId: string;
    parentAgentId: string;
    childAgentId: string;
    depth: number;
    reasonCode?: string;
    actorId: string;
    actorType: "user" | "agent" | "system";
  }): DelegationAuditEvent {
    return this.record({
      eventType: "delegation.created",
      delegationId: params.delegationId,
      parentAgentId: params.parentAgentId,
      childAgentId: params.childAgentId,
      depth: params.depth,
      reasonCode: params.reasonCode ?? "delegation.created",
      metadata: {},
      actorId: params.actorId,
      actorType: params.actorType,
    });
  }

  public recordDelegationCompleted(params: {
    delegationId: string;
    parentAgentId: string;
    childAgentId: string;
    durationMs: number;
    depth?: number; // R26-07 fix: track depth instead of hardcoding 0
    actorId: string;
    actorType: "user" | "agent" | "system";
  }): DelegationAuditEvent {
    return this.record({
      eventType: "delegation.completed",
      delegationId: params.delegationId,
      parentAgentId: params.parentAgentId,
      childAgentId: params.childAgentId,
      depth: params.depth ?? 0,
      reasonCode: "delegation.completed",
      metadata: { durationMs: params.durationMs },
      actorId: params.actorId,
      actorType: params.actorType,
    });
  }

  public recordDelegationFailed(params: {
    delegationId: string;
    parentAgentId: string;
    childAgentId: string;
    error: string;
    depth?: number; // R26-07 fix: track depth instead of hardcoding 0
    actorId: string;
    actorType: "user" | "agent" | "system";
  }): DelegationAuditEvent {
    return this.record({
      eventType: "delegation.failed",
      delegationId: params.delegationId,
      parentAgentId: params.parentAgentId,
      childAgentId: params.childAgentId,
      depth: params.depth ?? 0,
      reasonCode: "delegation.failed",
      metadata: { error: params.error },
      actorId: params.actorId,
      actorType: params.actorType,
    });
  }

  public recordPermissionNarrowed(params: {
    delegationId: string;
    parentAgentId: string;
    childAgentId: string;
    originalPermissions: Record<string, unknown>;
    narrowedPermissions: Record<string, unknown>;
    actorId: string;
    actorType: "user" | "agent" | "system";
  }): DelegationAuditEvent {
    return this.record({
      eventType: "delegation.permission_narrowed",
      delegationId: params.delegationId,
      parentAgentId: params.parentAgentId,
      childAgentId: params.childAgentId,
      depth: 0,
      reasonCode: "delegation.permission_narrowed",
      metadata: {
        originalPermissions: params.originalPermissions,
        narrowedPermissions: params.narrowedPermissions,
      },
      actorId: params.actorId,
      actorType: params.actorType,
    });
  }

  public getByDelegation(delegationId: string): DelegationAuditEvent[] {
    return this.events.filter((e) => e.delegationId === delegationId);
  }

  public getByAgent(agentId: string): DelegationAuditEvent[] {
    return this.events.filter((e) => e.actorId === agentId);
  }

  public getRecentEvents(limit: number = 50): DelegationAuditEvent[] {
    return [...this.events]
      .map((event, index) => ({ event, index }))
      .sort((a, b) => {
        const timeDiff = b.event.createdAt.localeCompare(a.event.createdAt);
        if (timeDiff !== 0) {
          return timeDiff;
        }
        return b.index - a.index;
      })
      .slice(0, limit)
      .map(({ event }) => event);
  }

  public getSummary(): DelegationAuditSummary {
    const byType: Record<DelegationAuditEventType, number> = {
      "delegation.governance.evaluated": 0,
      "delegation.governance.approved": 0,
      "delegation.governance.denied": 0,
      "delegation.created": 0,
      "delegation.completed": 0,
      "delegation.failed": 0,
      "delegation.cancelled": 0,
      "delegation.expired": 0,
      "delegation.permission_narrowed": 0,
    };

    const byAgent: Record<string, number> = {};
    let lastEventAt: string | null = null;

    for (const event of this.events) {
      byType[event.eventType]++;
      byAgent[event.parentAgentId] = (byAgent[event.parentAgentId] ?? 0) + 1;
      if (!lastEventAt || event.createdAt > lastEventAt) {
        lastEventAt = event.createdAt;
      }
    }

    return {
      totalEvents: this.events.length,
      byType,
      byAgent,
      lastEventAt,
    };
  }

  public listEvents(): DelegationAuditEvent[] {
    return [...this.events];
  }
}

export const delegationAuditService = new DelegationAuditService();
