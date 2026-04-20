/**
 * AsyncIntelligenceRepository - Async data access for perception/intel-item/intel-brief/action-proposal records.
 *
 * This is the async PostgreSQL-compatible version of IntelligenceRepository.
 * All methods are async and use $1, $2 ... placeholders for PostgreSQL.
 */

import type {
  ActionProposalRecord,
  IntelBriefRecord,
  IntelItemRecord,
  PerceptionSourceRecord,
} from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";
import { resolveTenantScope } from "../sqlite/authoritative-task-store-types.js";

export class AsyncIntelligenceRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  public async upsertPerceptionSource(source: PerceptionSourceRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO perception_sources (
        source_id, tenant_id, type, name, enabled, schedule_json, filters_json, priority, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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

  public async insertIntelItem(item: IntelItemRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO intel_items (
        intel_id, tenant_id, source_id, title, summary, raw_ref, relevance_score, importance,
        tags_json, dedupe_key, captured_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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

  public async insertIntelBrief(brief: IntelBriefRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO intel_briefs (
        brief_id, tenant_id, period_start, period_end, source_scope_json, item_ids_json,
        overall_summary, recommended_actions_json, generated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
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

  public async insertActionProposal(proposal: ActionProposalRecord): Promise<void> {
    await this.conn.execute(
      `INSERT INTO action_proposals (
        proposal_id, tenant_id, brief_id, intel_id, task_id, title, summary,
        action_type, status, requires_approval, proposal_json, created_at, decided_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
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

  public async getPerceptionSource(sourceId: string, tenantId?: string | null): Promise<PerceptionSourceRecord | null> {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId === undefined) {
      const result = await asyncQueryOne<PerceptionSourceRecord>(
        this.conn,
        `SELECT
           source_id AS "sourceId",
           tenant_id AS "tenantId",
           type,
           name,
           enabled,
           schedule_json AS "scheduleJson",
           filters_json AS "filtersJson",
           priority,
           created_at AS "createdAt",
           updated_at AS "updatedAt"
         FROM perception_sources
         WHERE source_id = $1`,
        sourceId,
      );
      return result ?? null;
    }
    const result = await asyncQueryOne<PerceptionSourceRecord>(
      this.conn,
      `SELECT
         source_id AS "sourceId",
         tenant_id AS "tenantId",
         type,
         name,
         enabled,
         schedule_json AS "scheduleJson",
         filters_json AS "filtersJson",
         priority,
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM perception_sources
       WHERE source_id = $1 AND tenant_id = $2`,
      sourceId,
      scopedTenantId,
    );
    return result ?? null;
  }

  public async listPerceptionSources(enabledOnly = false, tenantId?: string | null): Promise<PerceptionSourceRecord[]> {
    const scopedTenantId = resolveTenantScope(tenantId);
    const conditions: string[] = [];
    const parameters: unknown[] = [];

    if (enabledOnly) {
      conditions.push("enabled = 1");
    }
    if (scopedTenantId !== undefined) {
      conditions.push(`tenant_id = $${parameters.length + 1}`);
      parameters.push(scopedTenantId);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return asyncQueryAll<PerceptionSourceRecord>(
      this.conn,
      `SELECT
         source_id AS "sourceId",
         tenant_id AS "tenantId",
         type,
         name,
         enabled,
         schedule_json AS "scheduleJson",
         filters_json AS "filtersJson",
         priority,
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM perception_sources
       ${whereClause}
       ORDER BY priority DESC, updated_at DESC`,
      ...parameters,
    );
  }

  public async getIntelItemBySourceAndDedupeKey(
    sourceId: string,
    dedupeKey: string,
    tenantId?: string | null,
  ): Promise<IntelItemRecord | null> {
    const scopedTenantId = resolveTenantScope(tenantId);
    if (scopedTenantId === undefined) {
      const result = await asyncQueryOne<IntelItemRecord>(
        this.conn,
        `SELECT
           intel_id AS "intelId",
           tenant_id AS "tenantId",
           source_id AS "sourceId",
           title,
           summary,
           raw_ref AS "rawRef",
           relevance_score AS "relevanceScore",
           importance,
           tags_json AS "tagsJson",
           dedupe_key AS "dedupeKey",
           captured_at AS "capturedAt",
           expires_at AS "expiresAt"
         FROM intel_items
         WHERE source_id = $1 AND dedupe_key = $2
         LIMIT 1`,
        sourceId,
        dedupeKey,
      );
      return result ?? null;
    }
    const result = await asyncQueryOne<IntelItemRecord>(
      this.conn,
      `SELECT
         intel_id AS "intelId",
         tenant_id AS "tenantId",
         source_id AS "sourceId",
         title,
         summary,
         raw_ref AS "rawRef",
         relevance_score AS "relevanceScore",
         importance,
         tags_json AS "tagsJson",
         dedupe_key AS "dedupeKey",
         captured_at AS "capturedAt",
         expires_at AS "expiresAt"
       FROM intel_items
       WHERE source_id = $1 AND dedupe_key = $2 AND tenant_id = $3
       LIMIT 1`,
      sourceId,
      dedupeKey,
      scopedTenantId,
    );
    return result ?? null;
  }

  public async listIntelItems(options: {
    sourceIds?: readonly string[];
    tenantId?: string | null;
    since?: string | null;
    until?: string | null;
    limit?: number;
  } = {}): Promise<IntelItemRecord[]> {
    const conditions: string[] = [];
    const parameters: unknown[] = [];
    const scopedTenantId = resolveTenantScope(options.tenantId);

    if (options.sourceIds && options.sourceIds.length > 0) {
      const placeholders = options.sourceIds.map((_, i) => `$${parameters.length + 1 + i}`).join(", ");
      conditions.push(`source_id IN (${placeholders})`);
      parameters.push(...options.sourceIds);
    }
    if (scopedTenantId !== undefined) {
      conditions.push(`tenant_id = $${parameters.length + 1}`);
      parameters.push(scopedTenantId);
    }
    if (options.since) {
      conditions.push(`captured_at >= $${parameters.length + 1}`);
      parameters.push(options.since);
    }
    if (options.until) {
      conditions.push(`captured_at <= $${parameters.length + 1}`);
      parameters.push(options.until);
    }

    const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 50)) : 50;
    parameters.push(safeLimit);

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return asyncQueryAll<IntelItemRecord>(
      this.conn,
      `SELECT
         intel_id AS "intelId",
         tenant_id AS "tenantId",
         source_id AS "sourceId",
         title,
         summary,
         raw_ref AS "rawRef",
         relevance_score AS "relevanceScore",
         importance,
         tags_json AS "tagsJson",
         dedupe_key AS "dedupeKey",
         captured_at AS "capturedAt",
         expires_at AS "expiresAt"
       FROM intel_items
       ${whereClause}
       ORDER BY importance DESC, relevance_score DESC, captured_at DESC
       LIMIT $${parameters.length}`,
      ...parameters,
    );
  }

  public async listIntelItemsByIds(intelIds: readonly string[], tenantId?: string | null): Promise<IntelItemRecord[]> {
    if (intelIds.length === 0) {
      return [];
    }
    const scopedTenantId = resolveTenantScope(tenantId);
    const placeholders = intelIds.map((_, i) => `$${1 + i}`).join(", ");
    const sqlBase = `SELECT
         intel_id AS "intelId",
         tenant_id AS "tenantId",
         source_id AS "sourceId",
         title,
         summary,
         raw_ref AS "rawRef",
         relevance_score AS "relevanceScore",
         importance,
         tags_json AS "tagsJson",
         dedupe_key AS "dedupeKey",
         captured_at AS "capturedAt",
         expires_at AS "expiresAt"
       FROM intel_items
       WHERE intel_id IN (${placeholders})`;

    if (scopedTenantId === undefined) {
      return asyncQueryAll<IntelItemRecord>(this.conn, sqlBase, ...intelIds);
    }
    return asyncQueryAll<IntelItemRecord>(
      this.conn,
      `${sqlBase} AND tenant_id = $${intelIds.length + 1}`,
      ...intelIds,
      scopedTenantId,
    );
  }

  public async getIntelBrief(briefId: string, tenantId?: string | null): Promise<IntelBriefRecord | null> {
    const scopedTenantId = resolveTenantScope(tenantId);
    const sql = `SELECT
         brief_id AS "briefId",
         tenant_id AS "tenantId",
         period_start AS "periodStart",
         period_end AS "periodEnd",
         source_scope_json AS "sourceScopeJson",
         item_ids_json AS "itemIdsJson",
         overall_summary AS "overallSummary",
         recommended_actions_json AS "recommendedActionsJson",
         generated_at AS "generatedAt"
       FROM intel_briefs
       WHERE brief_id = $1`;
    if (scopedTenantId === undefined) {
      const result = await asyncQueryOne<IntelBriefRecord>(this.conn, sql, briefId);
      return result ?? null;
    }
    const result = await asyncQueryOne<IntelBriefRecord>(
      this.conn,
      `${sql} AND tenant_id = $2`,
      briefId,
      scopedTenantId,
    );
    return result ?? null;
  }

  public async listIntelBriefs(limit = 20, tenantId?: string | null): Promise<IntelBriefRecord[]> {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 20;
    const scopedTenantId = resolveTenantScope(tenantId);
    const sql = `SELECT
         brief_id AS "briefId",
         tenant_id AS "tenantId",
         period_start AS "periodStart",
         period_end AS "periodEnd",
         source_scope_json AS "sourceScopeJson",
         item_ids_json AS "itemIdsJson",
         overall_summary AS "overallSummary",
         recommended_actions_json AS "recommendedActionsJson",
         generated_at AS "generatedAt"
       FROM intel_briefs`;
    if (scopedTenantId === undefined) {
      return asyncQueryAll<IntelBriefRecord>(
        this.conn,
        `${sql} ORDER BY generated_at DESC LIMIT $1`,
        safeLimit,
      );
    }
    return asyncQueryAll<IntelBriefRecord>(
      this.conn,
      `${sql} WHERE tenant_id = $1 ORDER BY generated_at DESC LIMIT $2`,
      scopedTenantId,
      safeLimit,
    );
  }

  public async listActionProposalsByBrief(briefId: string, tenantId?: string | null): Promise<ActionProposalRecord[]> {
    const scopedTenantId = resolveTenantScope(tenantId);
    const sql = `SELECT
         proposal_id AS "proposalId",
         tenant_id AS "tenantId",
         brief_id AS "briefId",
         intel_id AS "intelId",
         task_id AS "taskId",
         title,
         summary,
         action_type AS "actionType",
         status,
         requires_approval AS "requiresApproval",
         proposal_json AS "proposalJson",
         created_at AS "createdAt",
         decided_at AS "decidedAt"
       FROM action_proposals
       WHERE brief_id = $1`;
    if (scopedTenantId === undefined) {
      return asyncQueryAll<ActionProposalRecord>(
        this.conn,
        `${sql} ORDER BY created_at ASC`,
        briefId,
      );
    }
    return asyncQueryAll<ActionProposalRecord>(
      this.conn,
      `${sql} AND tenant_id = $2 ORDER BY created_at ASC`,
      briefId,
      scopedTenantId,
    );
  }
}
