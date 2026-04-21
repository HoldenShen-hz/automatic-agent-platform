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
export {};
