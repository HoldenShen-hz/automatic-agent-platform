/**
 * AsyncEvolutionRepository - Async data access for evolution proposal/policy/log and PMF validation records.
 *
 * This is the async PostgreSQL-compatible version of EvolutionRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
export class AsyncEvolutionRepository {
    conn;
    constructor(conn) {
        this.conn = conn;
    }
    async insertEvolutionProposal(proposal) {
        await this.conn.execute(`INSERT INTO evolution_proposals (
        id, task_id, execution_id, source_agent_id, kind, scope_type, scope_ref, status,
        approval_id, summary, proposal_json, evidence_json, created_at, updated_at,
        approved_at, applied_at, rolled_back_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`, proposal.id, proposal.taskId, proposal.executionId, proposal.sourceAgentId, proposal.kind, proposal.scopeType, proposal.scopeRef, proposal.status, proposal.approvalId, proposal.summary, proposal.proposalJson, proposal.evidenceJson, proposal.createdAt, proposal.updatedAt, proposal.approvedAt, proposal.appliedAt, proposal.rolledBackAt);
    }
    async updateEvolutionProposal(proposal) {
        return asyncExecute(this.conn, `UPDATE evolution_proposals
       SET status = $1,
           approval_id = $2,
           summary = $3,
           proposal_json = $4,
           evidence_json = $5,
           updated_at = $6,
           approved_at = $7,
           applied_at = $8,
           rolled_back_at = $9
       WHERE id = $10`, proposal.status, proposal.approvalId, proposal.summary, proposal.proposalJson, proposal.evidenceJson, proposal.updatedAt, proposal.approvedAt, proposal.appliedAt, proposal.rolledBackAt, proposal.id);
    }
    async getEvolutionProposal(proposalId) {
        const result = await asyncQueryOne(this.conn, `SELECT
         id,
         task_id AS "taskId",
         execution_id AS "executionId",
         source_agent_id AS "sourceAgentId",
         kind,
         scope_type AS "scopeType",
         scope_ref AS "scopeRef",
         status,
         approval_id AS "approvalId",
         summary,
         proposal_json AS "proposalJson",
         evidence_json AS "evidenceJson",
         created_at AS "createdAt",
         updated_at AS "updatedAt",
         approved_at AS "approvedAt",
         applied_at AS "appliedAt",
         rolled_back_at AS "rolledBackAt"
       FROM evolution_proposals
       WHERE id = $1`, proposalId);
        return result ?? null;
    }
    async listEvolutionProposals(status) {
        const sql = `SELECT
         id,
         task_id AS "taskId",
         execution_id AS "executionId",
         source_agent_id AS "sourceAgentId",
         kind,
         scope_type AS "scopeType",
         scope_ref AS "scopeRef",
         status,
         approval_id AS "approvalId",
         summary,
         proposal_json AS "proposalJson",
         evidence_json AS "evidenceJson",
         created_at AS "createdAt",
         updated_at AS "updatedAt",
         approved_at AS "approvedAt",
         applied_at AS "appliedAt",
         rolled_back_at AS "rolledBackAt"
       FROM evolution_proposals`;
        if (status == null) {
            return asyncQueryAll(this.conn, `${sql} ORDER BY created_at DESC, id DESC`);
        }
        return asyncQueryAll(this.conn, `${sql} WHERE status = $1 ORDER BY created_at DESC, id DESC`, status);
    }
    async insertEvolutionPolicy(policy) {
        await this.conn.execute(`INSERT INTO evolution_policies (
        id, proposal_id, kind, scope_type, scope_ref, status, value_json, created_at, updated_at, rolled_back_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, policy.id, policy.proposalId, policy.kind, policy.scopeType, policy.scopeRef, policy.status, policy.valueJson, policy.createdAt, policy.updatedAt, policy.rolledBackAt);
    }
    async updateEvolutionPolicy(policy) {
        return asyncExecute(this.conn, `UPDATE evolution_policies
       SET status = $1,
           value_json = $2,
           updated_at = $3,
           rolled_back_at = $4
       WHERE id = $5`, policy.status, policy.valueJson, policy.updatedAt, policy.rolledBackAt, policy.id);
    }
    async getEvolutionPolicyByProposal(proposalId) {
        const result = await asyncQueryOne(this.conn, `SELECT
         id,
         proposal_id AS "proposalId",
         kind,
         scope_type AS "scopeType",
         scope_ref AS "scopeRef",
         status,
         value_json AS "valueJson",
         created_at AS "createdAt",
         updated_at AS "updatedAt",
         rolled_back_at AS "rolledBackAt"
       FROM evolution_policies
       WHERE proposal_id = $1`, proposalId);
        return result ?? null;
    }
    async listEvolutionPolicies(input = {}) {
        const filters = [];
        const values = [];
        if (input.kind != null) {
            filters.push(`kind = $${values.length + 1}`);
            values.push(input.kind);
        }
        if (input.scopeType != null) {
            filters.push(`scope_type = $${values.length + 1}`);
            values.push(input.scopeType);
        }
        if (input.scopeRef != null) {
            filters.push(`scope_ref = $${values.length + 1}`);
            values.push(input.scopeRef);
        }
        if (input.status != null) {
            filters.push(`status = $${values.length + 1}`);
            values.push(input.status);
        }
        const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
        return asyncQueryAll(this.conn, `SELECT
         id,
         proposal_id AS "proposalId",
         kind,
         scope_type AS "scopeType",
         scope_ref AS "scopeRef",
         status,
         value_json AS "valueJson",
         created_at AS "createdAt",
         updated_at AS "updatedAt",
         rolled_back_at AS "rolledBackAt"
       FROM evolution_policies
       ${whereClause}
       ORDER BY created_at DESC, id DESC`, ...values);
    }
    async insertEvolutionLog(log) {
        await this.conn.execute(`INSERT INTO evolution_logs (
        id, proposal_id, task_id, execution_id, event_type, reason_code,
        before_state_json, after_state_json, metadata_json, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`, log.id, log.proposalId, log.taskId, log.executionId, log.eventType, log.reasonCode, log.beforeStateJson, log.afterStateJson, log.metadataJson, log.createdAt);
    }
    async listEvolutionLogsByProposal(proposalId) {
        return asyncQueryAll(this.conn, `SELECT
         id,
         proposal_id AS "proposalId",
         task_id AS "taskId",
         execution_id AS "executionId",
         event_type AS "eventType",
         reason_code AS "reasonCode",
         before_state_json AS "beforeStateJson",
         after_state_json AS "afterStateJson",
         metadata_json AS "metadataJson",
         created_at AS "createdAt"
       FROM evolution_logs
       WHERE proposal_id = $1
       ORDER BY created_at ASC, id ASC`, proposalId);
    }
    async insertPmfValidationReport(report) {
        await this.conn.execute(`INSERT INTO pmf_validation_reports (
        id, profile_name, window_start, window_end, division_id, verdict, summary_json, report_json, generated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`, report.id, report.profileName, report.windowStart, report.windowEnd, report.divisionId, report.verdict, report.summaryJson, report.reportJson, report.generatedAt);
    }
    async listPmfValidationReports(limit = 20) {
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 20;
        return asyncQueryAll(this.conn, `SELECT
         id,
         profile_name AS "profileName",
         window_start AS "windowStart",
         window_end AS "windowEnd",
         division_id AS "divisionId",
         verdict,
         summary_json AS "summaryJson",
         report_json AS "reportJson",
         generated_at AS "generatedAt"
       FROM pmf_validation_reports
       ORDER BY generated_at DESC
       LIMIT $1`, safeLimit);
    }
    async getLatestPmfValidationReport(profileName) {
        const sql = `SELECT
         id,
         profile_name AS "profileName",
         window_start AS "windowStart",
         window_end AS "windowEnd",
         division_id AS "divisionId",
         verdict,
         summary_json AS "summaryJson",
         report_json AS "reportJson",
         generated_at AS "generatedAt"
       FROM pmf_validation_reports`;
        if (profileName && profileName.length > 0) {
            const result = await asyncQueryOne(this.conn, `${sql} WHERE profile_name = $1 ORDER BY generated_at DESC LIMIT 1`, profileName);
            return result ?? null;
        }
        const result = await asyncQueryOne(this.conn, `${sql} ORDER BY generated_at DESC LIMIT 1`);
        return result ?? null;
    }
}
//# sourceMappingURL=evolution-repository.js.map