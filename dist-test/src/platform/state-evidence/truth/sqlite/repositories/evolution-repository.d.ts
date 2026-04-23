import type { EvolutionLogRecord, EvolutionPolicyRecord, EvolutionProposalRecord, PmfValidationReportRecord } from "../../../../contracts/types/domain.js";
import type { AuthoritativeSqlDatabase } from "../sqlite-database.js";
/**
 * Standalone repository boundary for evolution proposal / policy / log and PMF
 * validation records.
 */
export declare class EvolutionRepository {
    private readonly db;
    constructor(db: AuthoritativeSqlDatabase);
    insertEvolutionProposal(proposal: EvolutionProposalRecord): void;
    updateEvolutionProposal(proposal: EvolutionProposalRecord): void;
    getEvolutionProposal(proposalId: string): EvolutionProposalRecord | null;
    listEvolutionProposals(status?: EvolutionProposalRecord["status"]): EvolutionProposalRecord[];
    insertEvolutionPolicy(policy: EvolutionPolicyRecord): void;
    updateEvolutionPolicy(policy: EvolutionPolicyRecord): void;
    getEvolutionPolicyByProposal(proposalId: string): EvolutionPolicyRecord | null;
    listEvolutionPolicies(input?: {
        kind?: EvolutionPolicyRecord["kind"];
        scopeType?: EvolutionPolicyRecord["scopeType"];
        scopeRef?: string;
        status?: EvolutionPolicyRecord["status"];
    }): EvolutionPolicyRecord[];
    insertEvolutionLog(log: EvolutionLogRecord): void;
    listEvolutionLogsByProposal(proposalId: string): EvolutionLogRecord[];
    insertPmfValidationReport(report: PmfValidationReportRecord): void;
    listPmfValidationReports(limit?: number): PmfValidationReportRecord[];
    getLatestPmfValidationReport(profileName?: string | null): PmfValidationReportRecord | null;
}
