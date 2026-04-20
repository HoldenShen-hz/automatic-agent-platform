import type {
  ActionProposalRecord,
  IntelBriefRecord,
  IntelItemRecord,
  PerceptionSourceRecord,
} from "../../../../contracts/types/domain.js";
import type { AuthoritativeSqlDatabase } from "../sqlite-database.js";
import { execute, queryAll, queryOne } from "../query-helper.js";
import { resolveTenantScope } from "../authoritative-task-store-types.js";

/**
 * Standalone repository boundary for perception / intel-item / intel-brief /
 * action-proposal records.
 */
export class IntelligenceRepository {
  public constructor(private readonly db: AuthoritativeSqlDatabase) {}

  public upsertPerceptionSource(source: PerceptionSourceRecord): void {
    execute(
      this.db.connection,
      `INSERT INTO perception_sources (
        source_id, tenant_id, type, name, enabled, schedule_json, filters_json, priority, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        type = excluded.type,
        name = excluded.name,
        enabled = excluded.enabled,
        schedule_json = excluded.schedule_json,
        filters_json = excluded.filters_json,
        priority = excluded.priority,
        updated_at = excluded.updated_at`,
      source.sourceId,
      source.tenantId,
      source.type,
      source.name,
      source.enabled,
      source.scheduleJson,
      source.filtersJson,
      source.priority,
      source.createdAt,
      source.updatedAt,
    );
  }

  public insertIntelItem(item: IntelItemRecord): void {
    execute(
      this.db.connection,
      `INSERT INTO intel_items (
        intel_id, tenant_id, source_id, title, summary, raw_ref, relevance_score, importance,
        tags_json, dedupe_key, captured_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      item.intelId,
      item.tenantId,
      item.sourceId,
      item.title,
      item.summary,
      item.rawRef,
      item.relevanceScore,
      item.importance,
      item.tagsJson,
      item.dedupeKey,
      item.capturedAt,
      item.expiresAt,
    );
  }

  public insertIntelBrief(brief: IntelBriefRecord): void {
    execute(
      this.db.connection,
      `INSERT INTO intel_briefs (
        brief_id, tenant_id, period_start, period_end, source_scope_json, item_ids_json,
        overall_summary, recommended_actions_json, generated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      brief.briefId,
      brief.tenantId,
      brief.periodStart,
      brief.periodEnd,
      brief.sourceScopeJson,
      brief.itemIdsJson,
      brief.overallSummary,
      brief.recommendedActionsJson,
      brief.generatedAt,
    );
  }

  public insertActionProposal(proposal: ActionProposalRecord): void {
    execute(
      this.db.connection,
      `INSERT INTO action_proposals (
        proposal_id, tenant_id, brief_id, intel_id, task_id, title, summary,
        action_type, status, requires_approval, proposal_json, created_at, decided_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      proposal.proposalId,
      proposal.tenantId,
      proposal.briefId,
      proposal.intelId,
      proposal.taskId,
      proposal.title,
      proposal.summary,
      proposal.actionType,
      proposal.status,
      proposal.requiresApproval,
      proposal.proposalJson,
      proposal.createdAt,
      proposal.decidedAt,
    );
  }

  public getPerceptionSource(sourceId: string, tenantId?: string | null): PerceptionSourceRecord | null {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId === undefined) {
      return queryOne<PerceptionSourceRecord>(
        this.db.connection,
        `SELECT
           source_id AS sourceId,
           tenant_id AS tenantId,
           type,
           name,
           enabled,
           schedule_json AS scheduleJson,
           filters_json AS filtersJson,
           priority,
           created_at AS createdAt,
           updated_at AS updatedAt
         FROM perception_sources
         WHERE source_id = ?`,
        sourceId,
      ) ?? null;
    }
    return queryOne<PerceptionSourceRecord>(
      this.db.connection,
      `SELECT
         source_id AS sourceId,
         tenant_id AS tenantId,
         type,
         name,
         enabled,
         schedule_json AS scheduleJson,
         filters_json AS filtersJson,
         priority,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM perception_sources
       WHERE source_id = ? AND tenant_id IS ?`,
      sourceId,
      scopedTenantId,
    ) ?? null;
  }

  public listPerceptionSources(enabledOnly = false, tenantId?: string | null): PerceptionSourceRecord[] {
    const scopedTenantId = resolveTenantScope(tenantId);
    const conditions: string[] = [];
    const parameters: Array<string | number | null> = [];

    if (enabledOnly) {
      conditions.push("enabled = 1");
    }
    if (scopedTenantId !== undefined) {
      conditions.push("tenant_id IS ?");
      parameters.push(scopedTenantId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return queryAll<PerceptionSourceRecord>(
      this.db.connection,
      `SELECT
         source_id AS sourceId,
         tenant_id AS tenantId,
         type,
         name,
         enabled,
         schedule_json AS scheduleJson,
         filters_json AS filtersJson,
         priority,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM perception_sources
       ${whereClause}
       ORDER BY priority DESC, updated_at DESC`,
      ...parameters,
    );
  }

  public getIntelItemBySourceAndDedupeKey(
    sourceId: string,
    dedupeKey: string,
    tenantId?: string | null,
  ): IntelItemRecord | null {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId === undefined) {
      return queryOne<IntelItemRecord>(
        this.db.connection,
        `SELECT
           intel_id AS intelId,
           tenant_id AS tenantId,
           source_id AS sourceId,
           title,
           summary,
           raw_ref AS rawRef,
           relevance_score AS relevanceScore,
           importance,
           tags_json AS tagsJson,
           dedupe_key AS dedupeKey,
           captured_at AS capturedAt,
           expires_at AS expiresAt
         FROM intel_items
         WHERE source_id = ? AND dedupe_key = ?
         LIMIT 1`,
        sourceId,
        dedupeKey,
      ) ?? null;
    }
    return queryOne<IntelItemRecord>(
      this.db.connection,
      `SELECT
         intel_id AS intelId,
         tenant_id AS tenantId,
         source_id AS sourceId,
         title,
         summary,
         raw_ref AS rawRef,
         relevance_score AS relevanceScore,
         importance,
         tags_json AS tagsJson,
         dedupe_key AS dedupeKey,
         captured_at AS capturedAt,
         expires_at AS expiresAt
       FROM intel_items
       WHERE source_id = ? AND dedupe_key = ? AND tenant_id IS ?
       LIMIT 1`,
      sourceId,
      dedupeKey,
      scopedTenantId,
    ) ?? null;
  }

  public listIntelItems(options: {
    sourceIds?: readonly string[];
    tenantId?: string | null;
    since?: string | null;
    until?: string | null;
    limit?: number;
  } = {}): IntelItemRecord[] {
    const conditions: string[] = [];
    const parameters: Array<string | number | null> = [];
    const scopedTenantId = resolveTenantScope(options.tenantId);

    if (options.sourceIds && options.sourceIds.length > 0) {
      conditions.push(`source_id IN (${options.sourceIds.map(() => "?").join(", ")})`);
      parameters.push(...options.sourceIds);
    }
    if (scopedTenantId !== undefined) {
      conditions.push("tenant_id IS ?");
      parameters.push(scopedTenantId);
    }
    if (options.since) {
      conditions.push("captured_at >= ?");
      parameters.push(options.since);
    }
    if (options.until) {
      conditions.push("captured_at <= ?");
      parameters.push(options.until);
    }

    const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 50)) : 50;
    parameters.push(safeLimit);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return queryAll<IntelItemRecord>(
      this.db.connection,
      `SELECT
         intel_id AS intelId,
         tenant_id AS tenantId,
         source_id AS sourceId,
         title,
         summary,
         raw_ref AS rawRef,
         relevance_score AS relevanceScore,
         importance,
         tags_json AS tagsJson,
         dedupe_key AS dedupeKey,
         captured_at AS capturedAt,
         expires_at AS expiresAt
       FROM intel_items
       ${whereClause}
       ORDER BY importance DESC, relevance_score DESC, captured_at DESC
       LIMIT ?`,
      ...parameters,
    );
  }

  public listIntelItemsByIds(intelIds: readonly string[], tenantId?: string | null): IntelItemRecord[] {
    if (intelIds.length === 0) {
      return [];
    }
    const scopedTenantId = resolveTenantScope(tenantId);
    const sqlBase = `SELECT
         intel_id AS intelId,
         tenant_id AS tenantId,
         source_id AS sourceId,
         title,
         summary,
         raw_ref AS rawRef,
         relevance_score AS relevanceScore,
         importance,
         tags_json AS tagsJson,
         dedupe_key AS dedupeKey,
         captured_at AS capturedAt,
         expires_at AS expiresAt
       FROM intel_items
       WHERE intel_id IN (${intelIds.map(() => "?").join(", ")})`;

    if (scopedTenantId === undefined) {
      return queryAll<IntelItemRecord>(this.db.connection, sqlBase, ...intelIds);
    }
    return queryAll<IntelItemRecord>(
      this.db.connection,
      `${sqlBase} AND tenant_id IS ?`,
      ...intelIds,
      scopedTenantId,
    );
  }

  public getIntelBrief(briefId: string, tenantId?: string | null): IntelBriefRecord | null {
    const scopedTenantId = resolveTenantScope(tenantId);
    const sql = `SELECT
         brief_id AS briefId,
         tenant_id AS tenantId,
         period_start AS periodStart,
         period_end AS periodEnd,
         source_scope_json AS sourceScopeJson,
         item_ids_json AS itemIdsJson,
         overall_summary AS overallSummary,
         recommended_actions_json AS recommendedActionsJson,
         generated_at AS generatedAt
       FROM intel_briefs
       WHERE brief_id = ?`;
    if (scopedTenantId === undefined) {
      return queryOne<IntelBriefRecord>(this.db.connection, sql, briefId) ?? null;
    }
    return queryOne<IntelBriefRecord>(
      this.db.connection,
      `${sql} AND tenant_id IS ?`,
      briefId,
      scopedTenantId,
    ) ?? null;
  }

  public listIntelBriefs(limit = 20, tenantId?: string | null): IntelBriefRecord[] {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 20;
    const scopedTenantId = resolveTenantScope(tenantId);
    const sql = `SELECT
         brief_id AS briefId,
         tenant_id AS tenantId,
         period_start AS periodStart,
         period_end AS periodEnd,
         source_scope_json AS sourceScopeJson,
         item_ids_json AS itemIdsJson,
         overall_summary AS overallSummary,
         recommended_actions_json AS recommendedActionsJson,
         generated_at AS generatedAt
       FROM intel_briefs`;
    if (scopedTenantId === undefined) {
      return queryAll<IntelBriefRecord>(
        this.db.connection,
        `${sql} ORDER BY generated_at DESC LIMIT ?`,
        safeLimit,
      );
    }
    return queryAll<IntelBriefRecord>(
      this.db.connection,
      `${sql} WHERE tenant_id IS ? ORDER BY generated_at DESC LIMIT ?`,
      scopedTenantId,
      safeLimit,
    );
  }

  public listActionProposalsByBrief(briefId: string, tenantId?: string | null): ActionProposalRecord[] {
    const scopedTenantId = resolveTenantScope(tenantId);
    const sql = `SELECT
         proposal_id AS proposalId,
         tenant_id AS tenantId,
         brief_id AS briefId,
         intel_id AS intelId,
         task_id AS taskId,
         title,
         summary,
         action_type AS actionType,
         status,
         requires_approval AS requiresApproval,
         proposal_json AS proposalJson,
         created_at AS createdAt,
         decided_at AS decidedAt
       FROM action_proposals
       WHERE brief_id = ?`;
    if (scopedTenantId === undefined) {
      return queryAll<ActionProposalRecord>(
        this.db.connection,
        `${sql} ORDER BY created_at ASC`,
        briefId,
      );
    }
    return queryAll<ActionProposalRecord>(
      this.db.connection,
      `${sql} AND tenant_id IS ? ORDER BY created_at ASC`,
      briefId,
      scopedTenantId,
    );
  }
}
