import { DatabaseSync } from "node:sqlite";

import type { GovernanceDelegation } from "../delegation-registry/index.js";
import type { GovernanceConsoleAuditEntry } from "../governance-console-service.js";

export interface DelegationStore {
  save(delegation: GovernanceDelegation): void;
  get(delegationId: string): GovernanceDelegation | null;
  list(): GovernanceDelegation[];
  listByGrantee(granteeId: string): GovernanceDelegation[];
  listByOrgNode(orgNodeId: string): GovernanceDelegation[];
}

export interface AuditLogStore {
  append(entry: GovernanceConsoleAuditEntry): void;
  list(): GovernanceConsoleAuditEntry[];
  listByDelegationId(delegationId: string): GovernanceConsoleAuditEntry[];
  listByActorId(actorId: string): GovernanceConsoleAuditEntry[];
  listByTargetId(targetId: string): GovernanceConsoleAuditEntry[];
}

export class InMemoryDelegationStore implements DelegationStore {
  private readonly delegations = new Map<string, GovernanceDelegation>();

  public save(delegation: GovernanceDelegation): void {
    this.delegations.set(delegation.delegationId, delegation);
  }

  public get(delegationId: string): GovernanceDelegation | null {
    return this.delegations.get(delegationId) ?? null;
  }

  public list(): GovernanceDelegation[] {
    return [...this.delegations.values()];
  }

  public listByGrantee(granteeId: string): GovernanceDelegation[] {
    return this.list().filter((delegation) => delegation.granteeId === granteeId);
  }

  public listByOrgNode(orgNodeId: string): GovernanceDelegation[] {
    return this.list().filter(
      (delegation) => delegation.orgNodeIds.length === 0 || delegation.orgNodeIds.includes(orgNodeId),
    );
  }
}

export class InMemoryAuditLogStore implements AuditLogStore {
  private readonly entries: GovernanceConsoleAuditEntry[] = [];

  public append(entry: GovernanceConsoleAuditEntry): void {
    this.entries.push(entry);
  }

  public list(): GovernanceConsoleAuditEntry[] {
    return [...this.entries];
  }

  public listByDelegationId(delegationId: string): GovernanceConsoleAuditEntry[] {
    return this.entries.filter((entry) => entry.delegationId === delegationId);
  }

  public listByActorId(actorId: string): GovernanceConsoleAuditEntry[] {
    return this.entries.filter((entry) => entry.actorId === actorId);
  }

  public listByTargetId(targetId: string): GovernanceConsoleAuditEntry[] {
    return this.entries.filter((entry) => entry.targetId === targetId);
  }
}

export class SqliteDelegationStore implements DelegationStore {
  public constructor(private readonly db: DatabaseSync) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS governance_delegations (
        delegation_id TEXT PRIMARY KEY,
        grantor_id TEXT NOT NULL,
        grantee_id TEXT NOT NULL,
        level TEXT NOT NULL,
        delegatable INTEGER NOT NULL,
        org_node_ids_json TEXT NOT NULL,
        domain_ids_json TEXT NOT NULL,
        derived_delegation_ids_json TEXT NOT NULL,
        permissions_json TEXT NOT NULL,
        guardrails_json TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revocable INTEGER NOT NULL,
        status TEXT NOT NULL
      )
    `);
  }

  public save(delegation: GovernanceDelegation): void {
    const normalized = normalizeDelegationForPersistence(delegation);
    this.db.prepare(`
      INSERT INTO governance_delegations (
        delegation_id, grantor_id, grantee_id, level, delegatable, org_node_ids_json, domain_ids_json,
        derived_delegation_ids_json, permissions_json, guardrails_json, expires_at, revocable, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(delegation_id) DO UPDATE SET
        grantor_id = excluded.grantor_id,
        grantee_id = excluded.grantee_id,
        level = excluded.level,
        delegatable = excluded.delegatable,
        org_node_ids_json = excluded.org_node_ids_json,
        domain_ids_json = excluded.domain_ids_json,
        derived_delegation_ids_json = excluded.derived_delegation_ids_json,
        permissions_json = excluded.permissions_json,
        guardrails_json = excluded.guardrails_json,
        expires_at = excluded.expires_at,
        revocable = excluded.revocable,
        status = excluded.status
    `).run(
      normalized.delegationId,
      normalized.grantorId,
      normalized.granteeId,
      normalized.level,
      normalized.delegatable ? 1 : 0,
      JSON.stringify(normalized.orgNodeIds),
      JSON.stringify(normalized.domainIds),
      JSON.stringify(normalized.derivedDelegationIds),
      JSON.stringify(normalized.permissions),
      JSON.stringify(normalized.guardrails),
      normalized.expiresAt,
      normalized.revocable ? 1 : 0,
      normalized.status,
    );
  }

  public get(delegationId: string): GovernanceDelegation | null {
    const row = this.db.prepare(`
      SELECT * FROM governance_delegations WHERE delegation_id = ?
    `).get(delegationId) as Record<string, unknown> | undefined;
    return row ? this.deserialize(row) : null;
  }

  public list(): GovernanceDelegation[] {
    const rows = this.db.prepare(`SELECT * FROM governance_delegations`).all() as Record<string, unknown>[];
    return rows.map((row) => this.deserialize(row));
  }

  public listByGrantee(granteeId: string): GovernanceDelegation[] {
    const rows = this.db.prepare(`
      SELECT * FROM governance_delegations WHERE grantee_id = ?
    `).all(granteeId) as Record<string, unknown>[];
    return rows.map((row) => this.deserialize(row));
  }

  public listByOrgNode(orgNodeId: string): GovernanceDelegation[] {
    return this.list().filter(
      (delegation) => delegation.orgNodeIds.length === 0 || delegation.orgNodeIds.includes(orgNodeId),
    );
  }

  private deserialize(row: Record<string, unknown>): GovernanceDelegation {
    return {
      delegationId: String(row.delegation_id),
      grantorId: String(row.grantor_id),
      granteeId: String(row.grantee_id),
      level: String(row.level) as GovernanceDelegation["level"],
      delegatable: Number(row.delegatable) === 1,
      orgNodeIds: JSON.parse(String(row.org_node_ids_json)) as string[],
      domainIds: JSON.parse(String(row.domain_ids_json)) as string[],
      derivedDelegationIds: JSON.parse(String(row.derived_delegation_ids_json)) as string[],
      permissions: JSON.parse(String(row.permissions_json)) as GovernanceDelegation["permissions"],
      guardrails: JSON.parse(String(row.guardrails_json)) as GovernanceDelegation["guardrails"],
      expiresAt: String(row.expires_at),
      revocable: Number(row.revocable) === 1,
      status: String(row.status) as GovernanceDelegation["status"],
    };
  }
}

function normalizeDelegationForPersistence(delegation: GovernanceDelegation): GovernanceDelegation {
  return {
    ...delegation,
    level: delegation.level ?? "delegated",
    delegatable: delegation.delegatable ?? false,
    orgNodeIds: delegation.orgNodeIds ?? [],
    domainIds: delegation.domainIds ?? [],
    derivedDelegationIds: delegation.derivedDelegationIds ?? [],
    permissions: delegation.permissions ?? [],
    guardrails: delegation.guardrails ?? [],
  };
}

export class SqliteAuditLogStore implements AuditLogStore {
  public constructor(private readonly db: DatabaseSync) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS governance_audit_log (
        event_id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        delegation_id TEXT,
        target_type TEXT,
        target_id TEXT,
        timestamp TEXT NOT NULL,
        details_json TEXT NOT NULL,
        success INTEGER NOT NULL,
        failure_reason TEXT
      )
    `);
  }

  public append(entry: GovernanceConsoleAuditEntry): void {
    this.db.prepare(`
      INSERT INTO governance_audit_log (event_id, action, actor_id, actor_role, delegation_id, target_type, target_id, timestamp, details_json, success, failure_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.eventId,
      entry.action,
      entry.actorId,
      entry.actorRole,
      entry.delegationId,
      entry.targetType,
      entry.targetId,
      entry.timestamp,
      JSON.stringify(entry.details),
      entry.success ? 1 : 0,
      entry.failureReason ?? null,
    );
  }

  public list(): GovernanceConsoleAuditEntry[] {
    const rows = this.db.prepare(`
      SELECT event_id, action, actor_id, actor_role, delegation_id, target_type, target_id, timestamp, details_json, success, failure_reason
      FROM governance_audit_log
      ORDER BY timestamp ASC
    `).all() as Record<string, unknown>[];
    return rows.map((row) => this.deserialize(row));
  }

  public listByDelegationId(delegationId: string): GovernanceConsoleAuditEntry[] {
    const rows = this.db.prepare(`
      SELECT event_id, action, actor_id, actor_role, delegation_id, target_type, target_id, timestamp, details_json, success, failure_reason
      FROM governance_audit_log
      WHERE delegation_id = ?
      ORDER BY timestamp ASC
    `).all(delegationId) as Record<string, unknown>[];
    return rows.map((row) => this.deserialize(row));
  }

  public listByActorId(actorId: string): GovernanceConsoleAuditEntry[] {
    const rows = this.db.prepare(`
      SELECT event_id, action, actor_id, actor_role, delegation_id, target_type, target_id, timestamp, details_json, success, failure_reason
      FROM governance_audit_log
      WHERE actor_id = ?
      ORDER BY timestamp ASC
    `).all(actorId) as Record<string, unknown>[];
    return rows.map((row) => this.deserialize(row));
  }

  public listByTargetId(targetId: string): GovernanceConsoleAuditEntry[] {
    const rows = this.db.prepare(`
      SELECT event_id, action, actor_id, actor_role, delegation_id, target_type, target_id, timestamp, details_json, success, failure_reason
      FROM governance_audit_log
      WHERE target_id = ?
      ORDER BY timestamp ASC
    `).all(targetId) as Record<string, unknown>[];
    return rows.map((row) => this.deserialize(row));
  }

  private deserialize(row: Record<string, unknown>): GovernanceConsoleAuditEntry {
    return {
      eventId: String(row.event_id),
      action: String(row.action) as GovernanceConsoleAuditEntry["action"],
      actorId: String(row.actor_id),
      actorRole: String(row.actor_role) as GovernanceConsoleAuditEntry["actorRole"],
      delegationId: row.delegation_id == null ? null : String(row.delegation_id),
      targetType: row.target_type == null ? null : String(row.target_type) as GovernanceConsoleAuditEntry["targetType"],
      targetId: row.target_id == null ? null : String(row.target_id),
      timestamp: String(row.timestamp),
      details: JSON.parse(String(row.details_json)) as Record<string, unknown>,
      success: Number(row.success) === 1,
      ...(row.failure_reason != null && { failureReason: String(row.failure_reason) }),
    };
  }
}
