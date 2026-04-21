/**
 * AsyncEvolutionRepository - Async data access for evolution proposal/policy/log and PMF validation records.
 *
 * This is the async PostgreSQL-compatible version of EvolutionRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */
import type { EvolutionLogRecord, EvolutionPolicyRecord, EvolutionProposalRecord, PmfValidationReportRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncEvolutionRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    insertEvolutionProposal(proposal: EvolutionProposalRecord): Promise<void>;
    updateEvolutionProposal(proposal: EvolutionProposalRecord): Promise<number>;
    getEvolutionProposal(proposalId: string): Promise<EvolutionProposalRecord | null>;
    listEvolutionProposals(status?: EvolutionProposalRecord["status"]): Promise<EvolutionProposalRecord[]>;
    insertEvolutionPolicy(policy: EvolutionPolicyRecord): Promise<void>;
    updateEvolutionPolicy(policy: EvolutionPolicyRecord): Promise<number>;
    getEvolutionPolicyByProposal(proposalId: string): Promise<EvolutionPolicyRecord | null>;
    listEvolutionPolicies(input?: {
        kind?: EvolutionPolicyRecord["kind"];
        scopeType?: EvolutionPolicyRecord["scopeType"];
        scopeRef?: string;
        status?: EvolutionPolicyRecord["status"];
    }): Promise<EvolutionPolicyRecord[]>;
    insertEvolutionLog(log: EvolutionLogRecord): Promise<void>;
    listEvolutionLogsByProposal(proposalId: string): Promise<EvolutionLogRecord[]>;
    insertPmfValidationReport(report: PmfValidationReportRecord): Promise<void>;
    listPmfValidationReports(limit?: number): Promise<PmfValidationReportRecord[]>;
    getLatestPmfValidationReport(profileName?: string | null): Promise<PmfValidationReportRecord | null>;
}
