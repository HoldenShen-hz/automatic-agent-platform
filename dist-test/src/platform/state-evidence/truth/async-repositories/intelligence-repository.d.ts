/**
 * AsyncIntelligenceRepository - Async data access for perception/intel-item/intel-brief/action-proposal records.
 *
 * This is the async PostgreSQL-compatible version of IntelligenceRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */
import type { ActionProposalRecord, IntelBriefRecord, IntelItemRecord, PerceptionSourceRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncIntelligenceRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    upsertPerceptionSource(source: PerceptionSourceRecord): Promise<void>;
    insertIntelItem(item: IntelItemRecord): Promise<void>;
    insertIntelBrief(brief: IntelBriefRecord): Promise<void>;
    insertActionProposal(proposal: ActionProposalRecord): Promise<void>;
    getPerceptionSource(sourceId: string, tenantId?: string | null): Promise<PerceptionSourceRecord | null>;
    listPerceptionSources(enabledOnly?: boolean, tenantId?: string | null): Promise<PerceptionSourceRecord[]>;
    getIntelItemBySourceAndDedupeKey(sourceId: string, dedupeKey: string, tenantId?: string | null): Promise<IntelItemRecord | null>;
    listIntelItems(options?: {
        sourceIds?: readonly string[];
        tenantId?: string | null;
        since?: string | null;
        until?: string | null;
        limit?: number;
    }): Promise<IntelItemRecord[]>;
    listIntelItemsByIds(intelIds: readonly string[], tenantId?: string | null): Promise<IntelItemRecord[]>;
    getIntelBrief(briefId: string, tenantId?: string | null): Promise<IntelBriefRecord | null>;
    listIntelBriefs(limit?: number, tenantId?: string | null): Promise<IntelBriefRecord[]>;
    listActionProposalsByBrief(briefId: string, tenantId?: string | null): Promise<ActionProposalRecord[]>;
}
