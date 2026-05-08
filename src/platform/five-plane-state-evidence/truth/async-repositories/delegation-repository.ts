/**
 * AsyncDelegationRepository - Async data access for agent delegation tables.
 *
 * Implements §26 storage layer - missing tables: delegations, delegation_events
 */

import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";

export interface DelegationRecord {
  delegationId: string;
  parentAgentId: string;
  childAgentId: string;
  delegationChainJson: string;
  status: string;
  depth: number;
  expiresAt: string | null;
  resultRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DelegationEventRecord {
  eventId: string;
  delegationId: string;
  eventType: string;
  payloadJson: string;
  createdAt: string;
}

export class AsyncDelegationRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  // ================================
  // DELEGATIONS
  // ================================

  public async insertDelegation(delegation: DelegationRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO delegations (
        delegation_id, parent_agent_id, child_agent_id, delegation_chain_json,
        status, depth, expires_at, result_ref, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      delegation.delegationId,
      delegation.parentAgentId,
      delegation.childAgentId,
      delegation.delegationChainJson,
      delegation.status,
      delegation.depth,
      delegation.expiresAt,
      delegation.resultRef,
      delegation.createdAt,
      delegation.updatedAt,
    );
  }

  public async updateDelegation(input: {
    delegationId: string;
    status?: string;
    resultRef?: string | null;
    updatedAt: string;
  }): Promise<number> {
    const sets = ["updated_at = $1"];
    const values: unknown[] = [input.updatedAt];
    let idx = 2;

    if (input.status !== undefined) { sets.push(`status = $${idx++}`); values.push(input.status); }
    if (input.resultRef !== undefined) { sets.push(`result_ref = $${idx++}`); values.push(input.resultRef); }

    values.push(input.delegationId);
    return asyncExecute(
      this.conn,
      `UPDATE delegations SET ${sets.join(", ")} WHERE delegation_id = $${idx}`,
      ...values,
    );
  }

  public async getDelegation(delegationId: string): Promise<DelegationRecord | null> {
    const result = await asyncQueryOne<DelegationRecord>(
      this.conn,
      `SELECT
        delegation_id AS "delegationId",
        parent_agent_id AS "parentAgentId",
        child_agent_id AS "childAgentId",
        delegation_chain_json AS "delegationChainJson",
        status,
        depth,
        expires_at AS "expiresAt",
        result_ref AS "resultRef",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM delegations WHERE delegation_id = $1`,
      delegationId,
    );
    return result ?? null;
  }

  public async listDelegationsByParent(parentAgentId: string): Promise<DelegationRecord[]> {
    return asyncQueryAll<DelegationRecord>(
      this.conn,
      `SELECT
        delegation_id AS "delegationId",
        parent_agent_id AS "parentAgentId",
        child_agent_id AS "childAgentId",
        delegation_chain_json AS "delegationChainJson",
        status,
        depth,
        expires_at AS "expiresAt",
        result_ref AS "resultRef",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM delegations WHERE parent_agent_id = $1 ORDER BY created_at DESC`,
      parentAgentId,
    );
  }

  public async listDelegationsByStatus(status: string): Promise<DelegationRecord[]> {
    return asyncQueryAll<DelegationRecord>(
      this.conn,
      `SELECT
        delegation_id AS "delegationId",
        parent_agent_id AS "parentAgentId",
        child_agent_id AS "childAgentId",
        delegation_chain_json AS "delegationChainJson",
        status,
        depth,
        expires_at AS "expiresAt",
        result_ref AS "resultRef",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM delegations WHERE status = $1 ORDER BY created_at DESC`,
      status,
    );
  }

  public async listExpiredDelegations(): Promise<DelegationRecord[]> {
    return asyncQueryAll<DelegationRecord>(
      this.conn,
      `SELECT
        delegation_id AS "delegationId",
        parent_agent_id AS "parentAgentId",
        child_agent_id AS "childAgentId",
        delegation_chain_json AS "delegationChainJson",
        status,
        depth,
        expires_at AS "expiresAt",
        result_ref AS "resultRef",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
       FROM delegations
       WHERE expires_at IS NOT NULL AND expires_at < datetime('now')
       ORDER BY expires_at ASC`,
    );
  }

  public async deleteDelegation(delegationId: string): Promise<number> {
    return asyncExecute(this.conn, `DELETE FROM delegations WHERE delegation_id = $1`, delegationId);
  }

  // ================================
  // DELEGATION EVENTS
  // ================================

  public async insertDelegationEvent(event: DelegationEventRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO delegation_events (
        event_id, delegation_id, event_type, payload_json, created_at
      ) VALUES ($1, $2, $3, $4, $5)`,
      event.eventId,
      event.delegationId,
      event.eventType,
      event.payloadJson,
      event.createdAt,
    );
  }

  public async listDelegationEvents(delegationId: string): Promise<DelegationEventRecord[]> {
    return asyncQueryAll<DelegationEventRecord>(
      this.conn,
      `SELECT
        event_id AS "eventId",
        delegation_id AS "delegationId",
        event_type AS "eventType",
        payload_json AS "payloadJson",
        created_at AS "createdAt"
       FROM delegation_events
       WHERE delegation_id = $1
       ORDER BY created_at ASC`,
      delegationId,
    );
  }

  public async countDelegationEvents(delegationId: string): Promise<number> {
    const result = await asyncQueryOne<{ count: number }>(
      this.conn,
      `SELECT COUNT(*) AS count FROM delegation_events WHERE delegation_id = $1`,
      delegationId,
    );
    return result?.count ?? 0;
  }
}
