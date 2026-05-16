/**
 * Perception CLI
 *
 * This module provides a command-line interface for managing external intelligence sources,
 * data ingestion, insight brief generation, and action proposals within the Automatic
 * Agent system. It integrates with billing for cost tracking of intelligence operations.
 *
 * Environment Variables:
 *   - AA_DB_PATH: Optional path to SQLite database
 *   - AA_PERCEPTION_ACTION: Action to perform (upsert_source, ingest, brief, propose, export, sources, briefs)
 *   - AA_PERCEPTION_ACCOUNT_ID: Optional account identifier
 *   - AA_TENANT_ID: Optional tenant identifier
 *   - AA_SOURCE_ID: Source identifier for source operations
 *   - AA_SOURCE_TYPE: Type of intelligence source
 *   - AA_SOURCE_NAME: Human-readable source name
 *   - AA_SOURCE_ENABLED: Whether source is enabled
 *   - AA_SOURCE_SCHEDULE_JSON: Source schedule configuration
 *   - AA_SOURCE_FILTERS_JSON: Source filter configuration
 *   - AA_SOURCE_PRIORITY: Source priority
 *   - AA_INTEL_ITEMS_JSON: Intel items to ingest
 *   - AA_SOURCE_IDS_JSON: Array of source IDs for brief
 *   - AA_BRIEF_GENERATED_AT: Timestamp for brief generation
 *   - AA_BRIEF_LIMIT: Maximum briefs to return
 *   - AA_BRIEF_SINCE: Start of time window for brief
 *   - AA_BRIEF_UNTIL: End of time window for brief
 *   - AA_BRIEF_ID: Brief identifier for proposal/export
 *   - AA_SOURCES_ENABLED_ONLY: Filter to enabled sources only
 *   - AA_BRIEFS_LIMIT: Maximum briefs to list
 *
 * Actions:
 *   - upsert_source: Register or update an intelligence source
 *   - ingest: Ingest intelligence items from a source
 *   - brief: Generate an insight brief from ingested intelligence
 *   - propose: Generate action proposals from a brief
 *   - export: Export a brief to disk
 *   - sources: List registered intelligence sources
 *   - briefs: List generated briefs
 *
 * @see {@link docs_zh/architecture/00-platform-architecture.md} for perception architecture
 * @see {@link docs_zh/governance/glossary_and_terminology.md} for perception terminology
 */

import { withCliStorage } from "./authoritative-storage.js";
import { loadPerceptionCliEnv } from "../../platform/five-plane-control-plane/config-center/product-cli-env.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import type { PerceptionSourceType } from "../../platform/contracts/types/domain.js";
import { assertNonEmpty } from "../../platform/five-plane-control-plane/iam/secret-management-support.js";
import { BillingService } from "../../scale-ecosystem/billing/billing-service.js";
import {
  PerceptionService,
  type IngestIntelCandidate,
} from "../../scale-ecosystem/intelligence/perception-service.js";

const PERCEPTION_SOURCE_TYPES = ["rss", "web", "github", "api", "custom"] as const satisfies readonly PerceptionSourceType[];

function parsePerceptionSourceType(value: string): PerceptionSourceType {
  if (PERCEPTION_SOURCE_TYPES.includes(value as PerceptionSourceType)) {
    return value as PerceptionSourceType;
  }
  throw new ValidationError(`invalid_perception_source_type:${value}`, `invalid_perception_source_type:${value}`);
}

function normalizeIntelItems(items: Array<Record<string, unknown>>): IngestIntelCandidate[] {
  return items.map((item, index) => {
    const title = assertNonEmpty(typeof item.title === "string" ? item.title : "", `perception.invalid_intel_title:${index}`);
    const summary = assertNonEmpty(typeof item.summary === "string" ? item.summary : "", `perception.invalid_intel_summary:${index}`);
    const rawRef = assertNonEmpty(typeof item.rawRef === "string" ? item.rawRef : "", `perception.invalid_intel_raw_ref:${index}`);
    const relevanceScore = typeof item.relevanceScore === "number" ? item.relevanceScore : Number.NaN;
    const importance = typeof item.importance === "number" ? item.importance : Number.NaN;
    if (!Number.isFinite(relevanceScore) || !Number.isFinite(importance)) {
      throw new ValidationError(`invalid_intel_scores:${index}`, `invalid_intel_scores:${index}`);
    }
    return {
      title,
      summary,
      rawRef,
      relevanceScore,
      importance,
      ...(Array.isArray(item.tags) ? { tags: item.tags.filter((tag): tag is string => typeof tag === "string") } : {}),
      ...(typeof item.dedupeKey === "string" ? { dedupeKey: item.dedupeKey } : {}),
      ...(typeof item.capturedAt === "string" ? { capturedAt: item.capturedAt } : {}),
      ...(typeof item.ttlHours === "number" || item.ttlHours === null ? { ttlHours: item.ttlHours } : {}),
    };
  });
}

/**
 * Main entry point for the perception CLI.
 *
 * Initializes storage, creates billing and perception services, dispatches the requested action,
 * outputs the result as JSON, and closes the storage connection.
 */
function main(): void {
  const envConfig = loadPerceptionCliEnv();
  const output = withCliStorage((storage) => {
    const billingService = new BillingService(storage.sql, storage.store, {
      artifactStoreOptions: {
        rootDir: envConfig.artifactRoot,
      },
    });
    const perception = new PerceptionService(storage.sql, storage.store, {
      artifactStoreOptions: {
        rootDir: envConfig.artifactRoot,
      },
      billingService,
    });

    switch (envConfig.action) {
    case "upsert_source": {
      if (envConfig.sourceType == null) {
        throw new ValidationError("missing_env:AA_SOURCE_TYPE", "missing_env:AA_SOURCE_TYPE");
      }
      if (envConfig.sourceName == null) {
        throw new ValidationError("missing_env:AA_SOURCE_NAME", "missing_env:AA_SOURCE_NAME");
      }
      return perception.registerSource({
        ...(envConfig.tenantId !== null ? { tenantId: envConfig.tenantId } : {}),
        type: parsePerceptionSourceType(envConfig.sourceType),
        name: envConfig.sourceName,
        enabled: envConfig.sourceEnabled,
        ...(envConfig.sourceId ? { sourceId: envConfig.sourceId } : {}),
        ...(envConfig.sourceSchedule ? { schedule: envConfig.sourceSchedule } : {}),
        ...(envConfig.sourceFilters ? { filters: envConfig.sourceFilters } : {}),
        ...(envConfig.sourcePriority != null ? { priority: envConfig.sourcePriority } : {}),
        ...(envConfig.accountId !== null ? { accountId: envConfig.accountId } : {}),
      });
    }
    case "ingest":
      if (envConfig.sourceId == null) {
        throw new ValidationError("missing_env:AA_SOURCE_ID", "missing_env:AA_SOURCE_ID");
      }
      if (envConfig.intelItems == null) {
        throw new ValidationError("missing_env:AA_INTEL_ITEMS_JSON", "missing_env:AA_INTEL_ITEMS_JSON");
      }
      return perception.ingestIntel({
        sourceId: envConfig.sourceId,
        ...(envConfig.tenantId !== null ? { tenantId: envConfig.tenantId } : {}),
        items: normalizeIntelItems(envConfig.intelItems),
        ...(envConfig.accountId !== null ? { accountId: envConfig.accountId } : {}),
      });
    case "brief": {
      return perception.buildBrief({
        ...(envConfig.tenantId !== null ? { tenantId: envConfig.tenantId } : {}),
        since: envConfig.briefSince,
        until: envConfig.briefUntil,
        ...(envConfig.sourceIds ? { sourceIds: envConfig.sourceIds } : {}),
        ...(envConfig.briefGeneratedAt ? { generatedAt: envConfig.briefGeneratedAt } : {}),
        ...(envConfig.briefLimit != null ? { limit: envConfig.briefLimit } : {}),
        ...(envConfig.accountId !== null ? { accountId: envConfig.accountId } : {}),
      });
    }
    case "propose":
      if (envConfig.briefId == null) {
        throw new ValidationError("missing_env:AA_BRIEF_ID", "missing_env:AA_BRIEF_ID");
      }
      return perception.proposeActions({
        briefId: envConfig.briefId,
        ...(envConfig.tenantId !== null ? { tenantId: envConfig.tenantId } : {}),
        ...(envConfig.accountId !== null ? { accountId: envConfig.accountId } : {}),
      });
    case "export":
      if (envConfig.briefId == null) {
        throw new ValidationError("missing_env:AA_BRIEF_ID", "missing_env:AA_BRIEF_ID");
      }
      return perception.exportBrief(envConfig.briefId, envConfig.accountId, envConfig.tenantId);
    case "sources":
      return perception.listSources(envConfig.sourcesEnabledOnly, envConfig.tenantId);
    case "briefs":
      return perception.listBriefs(envConfig.briefsLimit ?? 20, envConfig.tenantId);
    default:
      throw new ValidationError(`unknown_perception_action:${envConfig.action}`, `unknown_perception_action:${envConfig.action}`);
    }
  }, { dbPath: envConfig.dbPath });

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main();
