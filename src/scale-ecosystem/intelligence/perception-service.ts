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

import { dirname, join } from "node:path";

import { ArtifactStore, type ArtifactStoreOptions } from "../../platform/five-plane-state-evidence/artifacts/artifact-store.js";
import { AuthoritativeTaskStore } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type {
  ArtifactRef,
  BillingAccountRecord,
  PerceptionSourceRecord,
  PerceptionSourceType,
  IntelBriefRecord,
  IntelItemRecord,
  ActionProposalRecord,
  TaskRecord,
} from "../../platform/contracts/types/domain.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { MonetizationError, PolicyDeniedError, StorageError, ValidationError } from "../../platform/contracts/errors.js";
import { BillingService } from "../billing/billing-service.js";

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

/** Validates identifier format */
function assertIdentifier(value: string, code: string): string {
  if (!/^[a-zA-Z0-9._:-]{2,128}$/.test(value)) {
    throw new ValidationError(code, code);
  }
  return value;
}

/** Validates and trims title (3-200 chars) */
function assertTitle(value: string, code: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 3 || trimmed.length > 200) {
    throw new ValidationError(code, code);
  }
  return trimmed;
}

/** Validates and trims summary (8-5000 chars) */
function assertSummary(value: string, code: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 8 || trimmed.length > 5_000) {
    throw new ValidationError(code, code);
  }
  return trimmed;
}

/** Validates score is between 0 and 1, rounds to 3 decimal places */
function assertScore(value: number, code: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new ValidationError(code, code);
  }
  return Math.round(value * 1000) / 1000;
}

/** Parses timestamp or returns current time */
function parseTimestamp(value: string | undefined, code: string): string {
  if (!value) {
    return nowIso();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError(code, code);
  }
  return date.toISOString();
}

/** Adds hours to a timestamp */
function addHours(value: string, hours: number): string {
  const date = new Date(value);
  date.setUTCHours(date.getUTCHours() + hours);
  return date.toISOString();
}

/** Normalizes tags: lowercases, filters invalid formats, limits to 12 */
function normalizeTags(tags: readonly string[] | undefined): string[] {
  const result = Array.from(
    new Set(
      (tags ?? [])
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => /^[a-z0-9._:-]{2,64}$/.test(tag)),
    ),
  );
  return result.slice(0, 12);
}

/** Builds deduplication key from source and candidate */
function buildDedupeKey(sourceId: string, candidate: IngestIntelCandidate): string {
  const base = candidate.dedupeKey?.trim() || candidate.rawRef.trim() || candidate.title.trim().toLowerCase();
  return `${sourceId}:${base.toLowerCase()}`;
}

/** Builds summary text for an intel brief */
function buildBriefSummary(items: readonly IntelItemRecord[], sourceCount: number): string {
  if (items.length === 0) {
    return "No active intel items matched the current perception window.";
  }
  const topTitles = items.slice(0, 3).map((item) => item.title).join(" / ");
  return `${items.length} intel items from ${sourceCount} source(s). Top signals: ${topTitles}.`;
}

/**
 * Derives recommended actions from intel items.
 *
 * Action type logic:
 * - importance >= 0.85: investigate (high importance signals)
 * - relevanceScore >= 0.75: notify (highly relevant signals)
 * - otherwise: monitor
 */
function deriveRecommendedActions(items: readonly IntelItemRecord[]): RecommendedPerceptionAction[] {
  return items.slice(0, 3).map((item) => {
    const actionType: RecommendedPerceptionAction["actionType"] =
      item.importance >= 0.85 ? "investigate" : item.relevanceScore >= 0.75 ? "notify" : "monitor";
    return {
      title: `${actionType}:${item.title}`,
      summary: item.summary,
      actionType,
      intelId: item.intelId,
      reason: `importance=${item.importance}; relevance=${item.relevanceScore}; tags=${item.tagsJson}`,
    };
  });
}

function parseJsonArray<T>(value: string): T[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as T[] : [];
  } catch {
    return [];
  }
}

/** Builds Markdown-formatted intel brief for human review */
function buildBriefMarkdown(
  brief: IntelBriefRecord,
  items: readonly IntelItemRecord[],
  proposals: readonly ActionProposalRecord[],
): string {
  const recommendedActions = parseJsonArray<RecommendedPerceptionAction>(brief.recommendedActionsJson);
  const lines = [
    "# Intel Brief",
    "",
    `- Brief ID: \`${brief.briefId}\``,
    `- Period: \`${brief.periodStart}\` -> \`${brief.periodEnd}\``,
    `- Generated At: \`${brief.generatedAt}\``,
    "",
    "## Summary",
    "",
    brief.overallSummary,
    "",
    "## Intel Items",
    "",
    ...items.map(
      (item) =>
        `- [${item.sourceId}] ${item.title} | importance=${item.importance} | relevance=${item.relevanceScore} | rawRef=${item.rawRef}`,
    ),
    "",
    "## Recommended Actions",
    "",
    ...recommendedActions.map((action) => `- ${action.actionType}: ${action.title} (${action.intelId})`),
    "",
    "## Action Proposals",
    "",
    ...proposals.map((proposal) => `- ${proposal.status}: ${proposal.title} (${proposal.actionType})`),
  ];
  return lines.join("\n");
}

/**
 * Perception Service
 *
 * Manages intelligence gathering, brief generation, and action proposals.
 * Supports multiple source types with configurable schedules and filters.
 */
export class PerceptionService {
  private readonly artifactStore: ArtifactStore;
  private readonly billingService: BillingService | null;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
    options: PerceptionServiceOptions = {},
  ) {
    const defaultArtifactRoot = typeof db.filePath === "string" && db.filePath.length > 0
      ? join(dirname(db.filePath), "artifacts")
      : join(process.cwd(), "data", "artifacts");
    this.artifactStore = new ArtifactStore(
      options.artifactStoreOptions ?? {
        rootDir: defaultArtifactRoot,
      },
    );
    this.billingService = options.billingService ?? null;
  }

  /**
   * Registers a new perception source.
   * Sources can be enabled/disabled and have priority for ordering.
   */
  public registerSource(input: RegisterPerceptionSourceInput): PerceptionSourceRecord {
    this.assertFeatureEnabled(input.accountId ?? null);
    const createdAt = nowIso();
    const source: PerceptionSourceRecord = {
      sourceId: input.sourceId ? assertIdentifier(input.sourceId, "perception.invalid_source_id") : newId("source"),
      tenantId: input.tenantId ?? null,
      type: input.type,
      name: assertTitle(input.name, "perception.invalid_source_name"),
      enabled: input.enabled === false ? 0 : 1,
      scheduleJson: input.schedule == null ? null : JSON.stringify(input.schedule),
      filtersJson: input.filters == null ? null : JSON.stringify(input.filters),
      priority: Number.isFinite(input.priority) ? Math.max(0, Math.trunc(input.priority ?? 0)) : 0,
      createdAt,
      updatedAt: createdAt,
    };
    this.store.intelligence.upsertPerceptionSource(source);
    return source;
  }

  /**
   * Ingests intel candidates into the system.
   *
   * Performs deduplication based on source + dedupeKey.
   * Each candidate becomes an IntelItem if not a duplicate.
   */
  public ingestIntel(input: IngestIntelInput): IngestIntelResult {
    this.assertFeatureEnabled(input.accountId ?? null);
    const source = this.requireEnabledSource(input.sourceId, input.tenantId ?? undefined);
    const insertedItems: IntelItemRecord[] = [];
    let skippedDuplicateCount = 0;

    this.db.transaction(() => {
      for (const candidate of input.items) {
        const capturedAt = parseTimestamp(candidate.capturedAt, "perception.invalid_captured_at");
        const dedupeKey = buildDedupeKey(source.sourceId, candidate);

        // Skip duplicate items based on dedupe key
        if (this.store.intelligence.getIntelItemBySourceAndDedupeKey(source.sourceId, dedupeKey, source.tenantId ?? undefined)) {
          skippedDuplicateCount += 1;
          continue;
        }

        const item: IntelItemRecord = {
          intelId: newId("intel"),
          tenantId: source.tenantId,
          sourceId: source.sourceId,
          title: assertTitle(candidate.title, "perception.invalid_intel_title"),
          summary: assertSummary(candidate.summary, "perception.invalid_intel_summary"),
          rawRef: candidate.rawRef.trim().length > 0 ? candidate.rawRef.trim() : "manual://ingest",
          relevanceScore: assertScore(candidate.relevanceScore, "perception.invalid_relevance_score"),
          importance: assertScore(candidate.importance, "perception.invalid_importance"),
          tagsJson: JSON.stringify(normalizeTags(candidate.tags)),
          dedupeKey,
          capturedAt,
          expiresAt:
            candidate.ttlHours == null
              ? null
              : addHours(capturedAt, Math.max(1, Math.trunc(candidate.ttlHours))),
        };
        this.store.intelligence.insertIntelItem(item);
        insertedItems.push(item);
      }
    });

    return {
      source,
      insertedItems,
      skippedDuplicateCount,
    };
  }

  /**
   * Builds an intel brief from collected items.
   *
   * Queries items within the time window, filters expired items,
   * and derives recommended actions.
   */
  public buildBrief(input: BuildIntelBriefInput = {}): BuildIntelBriefResult {
    this.assertFeatureEnabled(input.accountId ?? null);
    const generatedAt = parseTimestamp(input.generatedAt, "perception.invalid_generated_at");
    const tenantId = input.tenantId ?? null;
    const sourceIds = input.sourceIds?.map((sourceId) => this.requireSource(sourceId, tenantId ?? undefined).sourceId);

    // Query intel items within the time window
    const items = this.store.intelligence
      .listIntelItems({
        tenantId,
        since: input.since ?? null,
        until: input.until ?? generatedAt,
        limit: input.limit ?? 25,
        ...(sourceIds ? { sourceIds } : {}),
      })
      .filter((item) => item.expiresAt == null || item.expiresAt > generatedAt);

    // Determine source scope
    const sourceScopeIds =
      sourceIds && sourceIds.length > 0
        ? sourceIds
        : this.store.intelligence.listPerceptionSources(true, tenantId).map((source) => source.sourceId);

    const recommendedActions = deriveRecommendedActions(items);

    const brief: IntelBriefRecord = {
      briefId: newId("brief"),
      tenantId,
      periodStart: input.since ?? (items.at(-1)?.capturedAt ?? generatedAt),
      periodEnd: input.until ?? generatedAt,
      sourceScopeJson: JSON.stringify(sourceScopeIds),
      itemIdsJson: JSON.stringify(items.map((item) => item.intelId)),
      overallSummary: buildBriefSummary(items, sourceScopeIds.length),
      recommendedActionsJson: JSON.stringify(recommendedActions),
      generatedAt,
    };
    this.store.intelligence.insertIntelBrief(brief);

    return {
      brief,
      items,
      recommendedActions,
    };
  }

  /**
   * Proposes actions from a brief.
   *
   * Converts recommended actions into action proposals.
   * Idempotent: returns existing proposals if already generated.
   */
  public proposeActions(input: ProposePerceptionActionsInput): ActionProposalRecord[] {
    this.assertFeatureEnabled(input.accountId ?? null);
    const brief = this.requireBrief(input.briefId, input.tenantId ?? undefined);

    // Return existing proposals if already generated
    const existing = this.store.intelligence.listActionProposalsByBrief(brief.briefId, brief.tenantId ?? undefined);
    if (existing.length > 0) {
      return existing;
    }

    const recommendedActions = parseJsonArray<RecommendedPerceptionAction>(brief.recommendedActionsJson);
    const proposals = recommendedActions.map((action) => {
      const createdAt = nowIso();
      return {
        proposalId: newId("proposal"),
        tenantId: brief.tenantId,
        briefId: brief.briefId,
        intelId: action.intelId,
        taskId: null,
        title: action.title,
        summary: action.summary,
        actionType: action.actionType,
        status: "proposed" as const,
        requiresApproval: 1 as const,
        proposalJson: JSON.stringify(action),
        createdAt,
        decidedAt: null,
      };
    });

    this.db.transaction(() => {
      for (const proposal of proposals) {
        this.store.intelligence.insertActionProposal(proposal);
      }
    });
    return proposals;
  }

  /**
   * Exports an intel brief as JSON and Markdown artifacts.
   */
  public exportBrief(briefId: string, accountId?: string | null, tenantId?: string | null): ExportIntelBriefResult {
    this.assertFeatureEnabled(accountId ?? null);
    const brief = this.requireBrief(briefId, tenantId ?? undefined);
    const itemIds = parseJsonArray<string>(brief.itemIdsJson);

    // Retrieve and sort items to match the brief order
    const items = this.store
      .listIntelItemsByIds(itemIds, brief.tenantId ?? undefined)
      .sort((left, right) => itemIds.indexOf(left.intelId) - itemIds.indexOf(right.intelId));

    // Propose actions if not already done
    const proposals = this.proposeActions({
      briefId: brief.briefId,
      ...(tenantId !== undefined ? { tenantId } : {}),
      ...(accountId !== undefined ? { accountId } : {}),
    });
    const recommendedActions = parseJsonArray<RecommendedPerceptionAction>(brief.recommendedActionsJson);

    this.ensurePerceptionArtifactTask(brief.generatedAt);

    const exportPayload = {
      brief,
      items,
      recommendedActions,
      proposals,
    };

    // Export as JSON artifact
    const jsonArtifact = this.artifactStore.writeJsonArtifact({
      taskId: "perception_reporting",
      executionId: null,
      stepId: null,
      kind: "intel_brief",
      fileName: `intel-brief-${brief.briefId}.json`,
      content: exportPayload,
      lineage: {
        source: "perception_service",
        briefId: brief.briefId,
        tenantId: brief.tenantId,
      },
    });
    this.store.artifact.insertArtifact(jsonArtifact.record);

    // Export as Markdown for human review
    const markdownArtifact = this.artifactStore.writeTextArtifact({
      taskId: "perception_reporting",
      executionId: null,
      stepId: null,
      kind: "intel_brief",
      fileName: `intel-brief-${brief.briefId}.md`,
      content: buildBriefMarkdown(brief, items, proposals),
      lineage: {
        source: "perception_service",
        briefId: brief.briefId,
        format: "markdown",
        tenantId: brief.tenantId,
      },
    });
    this.store.artifact.insertArtifact(markdownArtifact.record);

    return {
      brief,
      items,
      recommendedActions,
      proposals,
      jsonArtifact: jsonArtifact.ref,
      markdownArtifact: markdownArtifact.ref,
    };
  }

  /** Lists perception sources, optionally filtered by enabled status and tenant */
  public listSources(enabledOnly = false, tenantId?: string | null): PerceptionSourceRecord[] {
    return this.store.intelligence.listPerceptionSources(enabledOnly, tenantId);
  }

  /** Lists intel briefs, most recent first */
  public listBriefs(limit = 20, tenantId?: string | null): IntelBriefRecord[] {
    return this.store.intelligence.listIntelBriefs(limit, tenantId);
  }

  /**
   * Asserts that the perception feature is enabled for the account.
   * Checks billing entitlement for phase3.perception_mvp feature.
   */
  private assertFeatureEnabled(accountId: string | null): BillingAccountRecord | null {
    if (!accountId || !this.billingService) {
      return null;
    }
    const result = this.billingService.evaluateEntitlement({
      accountId,
      featureKey: "phase3.perception_mvp",
      evaluatedAt: nowIso(),
    });
    if (result.decision.allowed !== 1) {
      throw new MonetizationError(`perception.feature_denied:${result.decision.reasonCode}`, `perception.feature_denied:${result.decision.reasonCode}`, {
        retryable: false,
        details: {
          accountId,
          reasonCode: result.decision.reasonCode,
          featureKey: result.decision.featureKey,
        },
      });
    }
    return result.account;
  }

  /** Requires a source exists, throws if not found */
  private requireSource(sourceId: string, tenantId?: string | null): PerceptionSourceRecord {
    const source = this.store.intelligence.getPerceptionSource(assertIdentifier(sourceId, "perception.invalid_source_id"), tenantId);
    if (!source) {
      throw new StorageError(`perception.source_not_found:${sourceId}`, `perception.source_not_found:${sourceId}`, {
        statusCode: 404,
        retryable: false,
        details: { sourceId, tenantId: tenantId ?? null },
      });
    }
    return source;
  }

  /** Requires a source exists and is enabled, throws if disabled */
  private requireEnabledSource(sourceId: string, tenantId?: string | null): PerceptionSourceRecord {
    const source = this.requireSource(sourceId, tenantId);
    if (source.enabled !== 1) {
      throw new PolicyDeniedError(`perception.source_disabled:${sourceId}`, `perception.source_disabled:${sourceId}`, {
        retryable: false,
        details: { sourceId, tenantId: tenantId ?? null },
      });
    }
    return source;
  }

  /** Requires a brief exists, throws if not found */
  private requireBrief(briefId: string, tenantId?: string | null): IntelBriefRecord {
    const brief = this.store.intelligence.getIntelBrief(assertIdentifier(briefId, "perception.invalid_brief_id"), tenantId);
    if (!brief) {
      throw new StorageError(`perception.brief_not_found:${briefId}`, `perception.brief_not_found:${briefId}`, {
        statusCode: 404,
        retryable: false,
        details: { briefId, tenantId: tenantId ?? null },
      });
    }
    return brief;
  }

  /**
   * Ensures a placeholder task exists for perception artifact references.
   * Required because artifacts reference a task_id.
   */
  private ensurePerceptionArtifactTask(createdAt: string): void {
    if (this.store.task.getTask("perception_reporting")) {
      return;
    }

    const task: TaskRecord = {
      id: "perception_reporting",
      parentId: null,
      rootId: "perception_reporting",
      divisionId: "system_admin",
      title: "Perception reporting",
      status: "done",
      source: "system",
      priority: "normal",
      inputJson: JSON.stringify({ purpose: "perception_brief_export" }),
      normalizedInputJson: JSON.stringify({ purpose: "perception_brief_export" }),
      outputJson: JSON.stringify({ result: "perception_brief_exported" }),
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt,
      updatedAt: createdAt,
      completedAt: createdAt,
    };
    this.store.task.insertTask(task);
  }
}
