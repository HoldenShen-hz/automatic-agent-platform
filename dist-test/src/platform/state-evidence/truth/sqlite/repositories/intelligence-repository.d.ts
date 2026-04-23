import type { ActionProposalRecord, IntelBriefRecord, IntelItemRecord, PerceptionSourceRecord } from "../../../../contracts/types/domain.js";
import type { AuthoritativeSqlDatabase } from "../sqlite-database.js";
/**
 * Standalone repository boundary for perception / intel-item / intel-brief /
 * action-proposal records.
 */
export declare class IntelligenceRepository {
    private readonly db;
    constructor(db: AuthoritativeSqlDatabase);
    upsertPerceptionSource(source: PerceptionSourceRecord): void;
    insertIntelItem(item: IntelItemRecord): void;
    insertIntelBrief(brief: IntelBriefRecord): void;
    insertActionProposal(proposal: ActionProposalRecord): void;
    getPerceptionSource(sourceId: string, tenantId?: string | null): PerceptionSourceRecord | null;
    listPerceptionSources(enabledOnly?: boolean, tenantId?: string | null): PerceptionSourceRecord[];
    getIntelItemBySourceAndDedupeKey(sourceId: string, dedupeKey: string, tenantId?: string | null): IntelItemRecord | null;
    listIntelItems(options?: {
        sourceIds?: readonly string[];
        tenantId?: string | null;
        since?: string | null;
        until?: string | null;
        limit?: number;
    }): IntelItemRecord[];
    listIntelItemsByIds(intelIds: readonly string[], tenantId?: string | null): IntelItemRecord[];
    getIntelBrief(briefId: string, tenantId?: string | null): IntelBriefRecord | null;
    listIntelBriefs(limit?: number, tenantId?: string | null): IntelBriefRecord[];
    listActionProposalsByBrief(briefId: string, tenantId?: string | null): ActionProposalRecord[];
}
