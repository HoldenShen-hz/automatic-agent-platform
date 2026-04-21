import { execute, queryAll, queryOne } from "../query-helper.js";
/**
 * Standalone repository boundary for evolution proposal / policy / log and PMF
 * validation records.
 */
export class EvolutionRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    insertEvolutionProposal(proposal) {
        execute(this.db.connection, `INSERT INTO evolution_proposals (
        id, task_id, execution_id, source_agent_id, kind, scope_type, scope_ref, status,
        approval_id, summary, proposal_json, evidence_json, created_at, updated_at,
        approved_at, applied_at, rolled_back_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, proposal.id, proposal.taskId, proposal.executionId, proposal.sourceAgentId, proposal.kind, proposal.scopeType, proposal.scopeRef, proposal.status, proposal.approvalId, proposal.summary, proposal.proposalJson, proposal.evidenceJson, proposal.createdAt, proposal.updatedAt, proposal.approvedAt, proposal.appliedAt, proposal.rolledBackAt);
    }
    updateEvolutionProposal(proposal) {
        execute(this.db.connection, `UPDATE evolution_proposals
       SET status = ?,
           approval_id = ?,
           summary = ?,
           proposal_json = ?,
           evidence_json = ?,
           updated_at = ?,
           approved_at = ?,
           applied_at = ?,
           rolled_back_at = ?
       WHERE id = ?`, proposal.status, proposal.approvalId, proposal.summary, proposal.proposalJson, proposal.evidenceJson, proposal.updatedAt, proposal.approvedAt, proposal.appliedAt, proposal.rolledBackAt, proposal.id);
    }
    getEvolutionProposal(proposalId) {
        return queryOne(this.db.connection, `SELECT
         id,
         task_id AS taskId,
         execution_id AS executionId,
         source_agent_id AS sourceAgentId,
         kind,
         scope_type AS scopeType,
         scope_ref AS scopeRef,
         status,
         approval_id AS approvalId,
         summary,
         proposal_json AS proposalJson,
         evidence_json AS evidenceJson,
         created_at AS createdAt,
         updated_at AS updatedAt,
         approved_at AS approvedAt,
         applied_at AS appliedAt,
         rolled_back_at AS rolledBackAt
       FROM evolution_proposals
       WHERE id = ?`, proposalId) ?? null;
    }
    listEvolutionProposals(status) {
        const sql = `SELECT
         id,
         task_id AS taskId,
         execution_id AS executionId,
         source_agent_id AS sourceAgentId,
         kind,
         scope_type AS scopeType,
         scope_ref AS scopeRef,
         status,
         approval_id AS approvalId,
         summary,
         proposal_json AS proposalJson,
         evidence_json AS evidenceJson,
         created_at AS createdAt,
         updated_at AS updatedAt,
         approved_at AS approvedAt,
         applied_at AS appliedAt,
         rolled_back_at AS rolledBackAt
       FROM evolution_proposals`;
        if (status == null) {
            return queryAll(this.db.connection, `${sql} ORDER BY created_at DESC, id DESC`);
        }
        return queryAll(this.db.connection, `${sql} WHERE status = ? ORDER BY created_at DESC, id DESC`, status);
    }
    insertEvolutionPolicy(policy) {
        execute(this.db.connection, `INSERT INTO evolution_policies (
        id, proposal_id, kind, scope_type, scope_ref, status, value_json, created_at, updated_at, rolled_back_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, policy.id, policy.proposalId, policy.kind, policy.scopeType, policy.scopeRef, policy.status, policy.valueJson, policy.createdAt, policy.updatedAt, policy.rolledBackAt);
    }
    updateEvolutionPolicy(policy) {
        execute(this.db.connection, `UPDATE evolution_policies
       SET status = ?,
           value_json = ?,
           updated_at = ?,
           rolled_back_at = ?
       WHERE id = ?`, policy.status, policy.valueJson, policy.updatedAt, policy.rolledBackAt, policy.id);
    }
    getEvolutionPolicyByProposal(proposalId) {
        return queryOne(this.db.connection, `SELECT
         id,
         proposal_id AS proposalId,
         kind,
         scope_type AS scopeType,
         scope_ref AS scopeRef,
         status,
         value_json AS valueJson,
         created_at AS createdAt,
         updated_at AS updatedAt,
         rolled_back_at AS rolledBackAt
       FROM evolution_policies
       WHERE proposal_id = ?`, proposalId) ?? null;
    }
    listEvolutionPolicies(input = {}) {
        const filters = [];
        const values = [];
        if (input.kind != null) {
            filters.push("kind = ?");
            values.push(input.kind);
        }
        if (input.scopeType != null) {
            filters.push("scope_type = ?");
            values.push(input.scopeType);
        }
        if (input.scopeRef != null) {
            filters.push("scope_ref = ?");
            values.push(input.scopeRef);
        }
        if (input.status != null) {
            filters.push("status = ?");
            values.push(input.status);
        }
        const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
        return queryAll(this.db.connection, `SELECT
         id,
         proposal_id AS proposalId,
         kind,
         scope_type AS scopeType,
         scope_ref AS scopeRef,
         status,
         value_json AS valueJson,
         created_at AS createdAt,
         updated_at AS updatedAt,
         rolled_back_at AS rolledBackAt
       FROM evolution_policies
       ${whereClause}
       ORDER BY created_at DESC, id DESC`, ...values);
    }
    insertEvolutionLog(log) {
        execute(this.db.connection, `INSERT INTO evolution_logs (
        id, proposal_id, task_id, execution_id, event_type, reason_code,
        before_state_json, after_state_json, metadata_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, log.id, log.proposalId, log.taskId, log.executionId, log.eventType, log.reasonCode, log.beforeStateJson, log.afterStateJson, log.metadataJson, log.createdAt);
    }
    listEvolutionLogsByProposal(proposalId) {
        return queryAll(this.db.connection, `SELECT
         id,
         proposal_id AS proposalId,
         task_id AS taskId,
         execution_id AS executionId,
         event_type AS eventType,
         reason_code AS reasonCode,
         before_state_json AS beforeStateJson,
         after_state_json AS afterStateJson,
         metadata_json AS metadataJson,
         created_at AS createdAt
       FROM evolution_logs
       WHERE proposal_id = ?
       ORDER BY created_at ASC, id ASC`, proposalId);
    }
    insertPmfValidationReport(report) {
        execute(this.db.connection, `INSERT INTO pmf_validation_reports (
        id, profile_name, window_start, window_end, division_id, verdict, summary_json, report_json, generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, report.id, report.profileName, report.windowStart, report.windowEnd, report.divisionId, report.verdict, report.summaryJson, report.reportJson, report.generatedAt);
    }
    listPmfValidationReports(limit = 20) {
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 20;
        return queryAll(this.db.connection, `SELECT
         id,
         profile_name AS profileName,
         window_start AS windowStart,
         window_end AS windowEnd,
         division_id AS divisionId,
         verdict,
         summary_json AS summaryJson,
         report_json AS reportJson,
         generated_at AS generatedAt
       FROM pmf_validation_reports
       ORDER BY generated_at DESC
       LIMIT ?`, safeLimit);
    }
    getLatestPmfValidationReport(profileName) {
        const sql = `SELECT
         id,
         profile_name AS profileName,
         window_start AS windowStart,
         window_end AS windowEnd,
         division_id AS divisionId,
         verdict,
         summary_json AS summaryJson,
         report_json AS reportJson,
         generated_at AS generatedAt
       FROM pmf_validation_reports`;
        if (profileName && profileName.length > 0) {
            return queryOne(this.db.connection, `${sql} WHERE profile_name = ? ORDER BY generated_at DESC LIMIT 1`, profileName) ?? null;
        }
        return queryOne(this.db.connection, `${sql} ORDER BY generated_at DESC LIMIT 1`) ?? null;
    }
}
//# sourceMappingURL=evolution-repository.js.map