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
}

export class SqliteDelegationStore implements DelegationStore {
  public constructor(private readonly db: DatabaseSync) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS governance_delegations (
        delegation_id TEXT PRIMARY KEY,
        grantor_id TEXT NOT NULL,
        grantee_id TEXT NOT NULL,
        org_node_ids_json TEXT NOT NULL,
        domain_ids_json TEXT NOT NULL,
        permissions_json TEXT NOT NULL,
        guardrails_json TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revocable INTEGER NOT NULL,
        status TEXT NOT NULL
      )
    `);
  }

  public save(delegation: GovernanceDelegation): void {
    this.db.prepare(`
      INSERT INTO governance_delegations (
        delegation_id, grantor_id, grantee_id, org_node_ids_json, domain_ids_json,
        permissions_json, guardrails_json, expires_at, revocable, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(delegation_id) DO UPDATE SET
        grantor_id = excluded.grantor_id,
        grantee_id = excluded.grantee_id,
        org_node_ids_json = excluded.org_node_ids_json,
        domain_ids_json = excluded.domain_ids_json,
        permissions_json = excluded.permissions_json,
        guardrails_json = excluded.guardrails_json,
        expires_at = excluded.expires_at,
        revocable = excluded.revocable,
        status = excluded.status
    `).run(
      delegation.delegationId,
      delegation.grantorId,
      delegation.granteeId,
      JSON.stringify(delegation.orgNodeIds),
      JSON.stringify(delegation.domainIds),
      JSON.stringify(delegation.permissions),
      JSON.stringify(delegation.guardrails),
      delegation.expiresAt,
      delegation.revocable ? 1 : 0,
      delegation.status,
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
      orgNodeIds: JSON.parse(String(row.org_node_ids_json)) as string[],
      domainIds: JSON.parse(String(row.domain_ids_json)) as string[],
      permissions: JSON.parse(String(row.permissions_json)) as GovernanceDelegation["permissions"],
      guardrails: JSON.parse(String(row.guardrails_json)) as GovernanceDelegation["guardrails"],
      expiresAt: String(row.expires_at),
      revocable: Number(row.revocable) === 1,
      status: String(row.status) as GovernanceDelegation["status"],
    };
  }
}

export class SqliteAuditLogStore implements AuditLogStore {
  public constructor(private readonly db: DatabaseSync) {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS governance_audit_log (
        event_id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        delegation_id TEXT,
        timestamp TEXT NOT NULL,
        details_json TEXT NOT NULL
      )
    `);
  }

  public append(entry: GovernanceConsoleAuditEntry): void {
    this.db.prepare(`
      INSERT INTO governance_audit_log (action, actor_id, delegation_id, timestamp, details_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      entry.action,
      entry.actorId,
      entry.delegationId,
      entry.timestamp,
      JSON.stringify(entry.details),
    );
  }

  public list(): GovernanceConsoleAuditEntry[] {
    const rows = this.db.prepare(`
      SELECT action, actor_id, delegation_id, timestamp, details_json
      FROM governance_audit_log
      ORDER BY event_id ASC
    `).all() as Record<string, unknown>[];
    return rows.map((row) => this.deserialize(row));
  }

  public listByDelegationId(delegationId: string): GovernanceConsoleAuditEntry[] {
    const rows = this.db.prepare(`
      SELECT action, actor_id, delegation_id, timestamp, details_json
      FROM governance_audit_log
      WHERE delegation_id = ?
      ORDER BY event_id ASC
    `).all(delegationId) as Record<string, unknown>[];
    return rows.map((row) => this.deserialize(row));
  }

  private deserialize(row: Record<string, unknown>): GovernanceConsoleAuditEntry {
    return {
      action: String(row.action) as GovernanceConsoleAuditEntry["action"],
      actorId: String(row.actor_id),
      delegationId: row.delegation_id == null ? null : String(row.delegation_id),
      timestamp: String(row.timestamp),
      details: JSON.parse(String(row.details_json)) as Record<string, unknown>,
    };
  }
}
