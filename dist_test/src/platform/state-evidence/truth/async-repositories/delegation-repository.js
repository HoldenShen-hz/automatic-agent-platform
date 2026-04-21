/**
 * AsyncDelegationRepository - Async data access for agent delegation tables.
 *
 * Implements §26 storage layer - missing tables: delegations, delegation_events
 */
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
export class AsyncDelegationRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    // ================================
    // DELEGATIONS
    // ================================
    async insertDelegation(delegation) {
        await this.conn.execute(`INSERT INTO delegations (
        delegation_id, parent_agent_id, child_agent_id, delegation_chain_json,
        status, depth, expires_at, result_ref, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, delegation.delegationId, delegation.parentAgentId, delegation.childAgentId, delegation.delegationChainJson, delegation.status, delegation.depth, delegation.expiresAt, delegation.resultRef, delegation.createdAt, delegation.updatedAt);
    }
    async updateDelegation(input) {
        const sets = ["updated_at = $1"];
        const values = [input.updatedAt];
        let idx = 2;
        if (input.status !== undefined) {
            sets.push(`status = $${idx++}`);
            values.push(input.status);
        }
        if (input.resultRef !== undefined) {
            sets.push(`result_ref = $${idx++}`);
            values.push(input.resultRef);
        }
        values.push(input.delegationId);
        return asyncExecute(this.conn, `UPDATE delegations SET ${sets.join(", ")} WHERE delegation_id = $${idx}`, ...values);
    }
    async getDelegation(delegationId) {
        const result = await asyncQueryOne(this.conn, `SELECT
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
       FROM delegations WHERE delegation_id = $1`, delegationId);
        return result ?? null;
    }
    async listDelegationsByParent(parentAgentId) {
        return asyncQueryAll(this.conn, `SELECT
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
       FROM delegations WHERE parent_agent_id = $1 ORDER BY created_at DESC`, parentAgentId);
    }
    async listDelegationsByStatus(status) {
        return asyncQueryAll(this.conn, `SELECT
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
       FROM delegations WHERE status = $1 ORDER BY created_at DESC`, status);
    }
    async listExpiredDelegations() {
        return asyncQueryAll(this.conn, `SELECT
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
       ORDER BY expires_at ASC`);
    }
    async deleteDelegation(delegationId) {
        return asyncExecute(this.conn, `DELETE FROM delegations WHERE delegation_id = $1`, delegationId);
    }
    // ================================
    // DELEGATION EVENTS
    // ================================
    async insertDelegationEvent(event) {
        await this.conn.execute(`INSERT INTO delegation_events (
        event_id, delegation_id, event_type, payload_json, created_at
      ) VALUES ($1, $2, $3, $4, $5)`, event.eventId, event.delegationId, event.eventType, event.payloadJson, event.createdAt);
    }
    async listDelegationEvents(delegationId) {
        return asyncQueryAll(this.conn, `SELECT
        event_id AS "eventId",
        delegation_id AS "delegationId",
        event_type AS "eventType",
        payload_json AS "payloadJson",
        created_at AS "createdAt"
       FROM delegation_events
       WHERE delegation_id = $1
       ORDER BY created_at ASC`, delegationId);
    }
    async countDelegationEvents(delegationId) {
        const result = await asyncQueryOne(this.conn, `SELECT COUNT(*) AS count FROM delegation_events WHERE delegation_id = $1`, delegationId);
        return result?.count ?? 0;
    }
}
//# sourceMappingURL=delegation-repository.js.map