/**
 * Perception Service
 *
 * Intelligence gathering and signal processing system that collects intel from
 * various sources, evaluates relevance and importance, and produces actionable briefs.
 *
 * Key concepts:
 * - PerceptionSource: A data source (feed, API, manual) that provides intel items
 * - IntelItem: A single piece of intelligence with title, summary, relevance, importance
 * - IntelBrief: A collection of intel items with recommended actions
 * - ActionProposal: A proposed action derived from intel item analysis
 *
 * Workflow:
 * 1. Register perception sources (feeds, APIs, manual inputs)
 * 2. Ingest intel candidates into the system (with deduplication)
 * 3. Build intel briefs covering a time window
 * 4. Derive recommended actions from high-value intel
 * 5. Export briefs as artifacts for human review
 *
 * Action types:
 * - monitor: Continue watching this signal
 * - investigate: Dig deeper into this signal
 * - notify: Alert relevant parties about this signal
 *
 * @see docs_zh/contracts/perception_contract.md for perception system contracts
 */
import { type ArtifactStoreOptions } from "../../platform/state-evidence/artifacts/artifact-store.js";
import { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { ArtifactRef, PerceptionSourceRecord, PerceptionSourceType, IntelBriefRecord, IntelItemRecord, ActionProposalRecord } from "../../platform/contracts/types/domain.js";
import { BillingService } from "./billing-service.js";
/** Input for registering a new perception source */
export interface RegisterPerceptionSourceInput {
    sourceId?: string;
    tenantId?: string | null;
    type: PerceptionSourceType;
    name: string;
    enabled?: boolean;
    /** Optional scheduling configuration */
    schedule?: Record<string, unknown> | null;
    /** Optional filtering configuration */
    filters?: Record<string, unknown> | null;
    priority?: number;
    accountId?: string | null;
}
/** A single intel candidate to ingest */
export interface IngestIntelCandidate {
    title: string;
    summary: string;
    /** Reference URL or identifier for the raw intel */
    rawRef: string;
    /** Relevance score 0-1 indicating how relevant to the use case */
    relevanceScore: number;
    /** Importance score 0-1 indicating overall importance */
    importance: number;
    tags?: readonly string[];
    /** Deduplication key (defaults to rawRef or title) */
    dedupeKey?: string;
    capturedAt?: string;
    /** Time-to-live in hours (null = never expires) */
    ttlHours?: number | null;
}
/** Input for ingesting multiple intel items */
export interface IngestIntelInput {
    sourceId: string;
    tenantId?: string | null;
    items: readonly IngestIntelCandidate[];
    accountId?: string | null;
}
/** Result of ingesting intel items */
export interface IngestIntelResult {
    source: PerceptionSourceRecord;
    insertedItems: IntelItemRecord[];
    /** Count of items skipped due to deduplication */
    skippedDuplicateCount: number;
}
/** Input for building an intel brief */
export interface BuildIntelBriefInput {
    tenantId?: string | null;
    /** Optional filter to specific sources */
    sourceIds?: readonly string[];
    /** Start of time window (null = earliest) */
    since?: string | null;
    /** End of time window (null = now) */
    until?: string | null;
    generatedAt?: string;
    /** Maximum items to include (default: 25) */
    limit?: number;
    accountId?: string | null;
}
/** A recommended action derived from an intel item */
export interface RecommendedPerceptionAction {
    title: string;
    summary: string;
    actionType: "monitor" | "investigate" | "notify";
    intelId: string;
    reason: string;
}
/** Result of building an intel brief */
export interface BuildIntelBriefResult {
    brief: IntelBriefRecord;
    items: IntelItemRecord[];
    recommendedActions: RecommendedPerceptionAction[];
}
/** Input for proposing actions from a brief */
export interface ProposePerceptionActionsInput {
    briefId: string;
    tenantId?: string | null;
    accountId?: string | null;
}
/** Extended result including artifact references */
export interface ExportIntelBriefResult extends BuildIntelBriefResult {
    proposals: ActionProposalRecord[];
    jsonArtifact: ArtifactRef;
    markdownArtifact: ArtifactRef;
}
/** Configuration options */
export interface PerceptionServiceOptions {
    artifactStoreOptions?: ArtifactStoreOptions;
    /** Optional billing service for feature entitlement checks */
    billingService?: BillingService;
}
/**
 * Perception Service
 *
 * Manages intelligence gathering, brief generation, and action proposals.
 * Supports multiple source types with configurable schedules and filters.
 */
export declare class PerceptionService {
    private readonly db;
    private readonly store;
    private readonly artifactStore;
    private readonly billingService;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, options?: PerceptionServiceOptions);
    /**
     * Registers a new perception source.
     * Sources can be enabled/disabled and have priority for ordering.
     */
    registerSource(input: RegisterPerceptionSourceInput): PerceptionSourceRecord;
    /**
     * Ingests intel candidates into the system.
     *
     * Performs deduplication based on source + dedupeKey.
     * Each candidate becomes an IntelItem if not a duplicate.
     */
    ingestIntel(input: IngestIntelInput): IngestIntelResult;
    /**
     * Builds an intel brief from collected items.
     *
     * Queries items within the time window, filters expired items,
     * and derives recommended actions.
     */
    buildBrief(input?: BuildIntelBriefInput): BuildIntelBriefResult;
    /**
     * Proposes actions from a brief.
     *
     * Converts recommended actions into action proposals.
     * Idempotent: returns existing proposals if already generated.
     */
    proposeActions(input: ProposePerceptionActionsInput): ActionProposalRecord[];
    /**
     * Exports an intel brief as JSON and Markdown artifacts.
     */
    exportBrief(briefId: string, accountId?: string | null, tenantId?: string | null): ExportIntelBriefResult;
    /** Lists perception sources, optionally filtered by enabled status and tenant */
    listSources(enabledOnly?: boolean, tenantId?: string | null): PerceptionSourceRecord[];
    /** Lists intel briefs, most recent first */
    listBriefs(limit?: number, tenantId?: string | null): IntelBriefRecord[];
    /**
     * Asserts that the perception feature is enabled for the account.
     * Checks billing entitlement for phase3.perception_mvp feature.
     */
    private assertFeatureEnabled;
    /** Requires a source exists, throws if not found */
    private requireSource;
    /** Requires a source exists and is enabled, throws if disabled */
    private requireEnabledSource;
    /** Requires a brief exists, throws if not found */
    private requireBrief;
    /**
     * Ensures a placeholder task exists for perception artifact references.
     * Required because artifacts reference a task_id.
     */
    private ensurePerceptionArtifactTask;
}
