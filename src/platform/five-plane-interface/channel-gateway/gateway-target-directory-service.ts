import { nowIso } from "../../contracts/types/ids.js";
import { StorageError, ValidationError } from "../../contracts/errors.js";
import type {
  GatewayTargetKind,
  GatewayTargetRecord,
  GatewayTargetSource,
} from "../../contracts/types/domain.js";
import type { GatewaySessionTargetCandidate } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import type { GatewayStoragePort } from "./storage-port.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Input for registering a new gateway target in the directory.
 */
export interface RegisterGatewayTargetInput {
  /** Channel this target belongs to (telegram, slack, webhook) */
  channel: string;
  /** Kind of target (user, group, channel, session, etc.) */
  targetKind: GatewayTargetKind;
  /** External identifier as known by the provider (chat ID, channel ID, webhook URL) */
  externalTargetId: string;
  /** Human-readable display name */
  displayName: string;
  /** Alternative identifiers for lookup (e.g., usernames, aliases) */
  aliases?: readonly string[];
  /** Arbitrary metadata stored with the target */
  metadata?: Record<string, unknown> | null;
  /** Source of this target (defaults to "directory") */
  source?: Extract<GatewayTargetSource, "directory">;
  /** When this target was observed (defaults to now) */
  observedAt?: string;
}

/**
 * A target entry returned from directory queries.
 * Includes both stored fields and computed/derived fields.
 */
export interface GatewayTargetDirectoryEntry {
  /** Internal unique identifier */
  targetId: string;
  /** Channel (telegram, slack, webhook) */
  channel: string;
  /** Target kind */
  targetKind: GatewayTargetKind;
  /** Source of this entry (directory, session_history) */
  source: GatewayTargetSource;
  /** Display name for UI */
  displayName: string;
  /** All aliases including the primary identifier */
  aliases: string[];
  /** External/provider identifier */
  externalTargetId: string | null;
  /** Associated session ID if this is a session-based target */
  sessionId: string | null;
  /** Associated task ID if this target is task-scoped */
  taskId: string | null;
  /** Last time this target was active */
  lastSeenAt: string | null;
  /** Preview of the most recent message to/from this target */
  latestMessagePreview: string | null;
}

/**
 * Query parameters for listing gateway targets.
 */
export interface ListGatewayTargetsQuery {
  /** Filter by channel (optional) */
  channel?: string;
  /** Search query matching targetId, displayName, or aliases (optional) */
  query?: string;
  /** Maximum results to return (default 50, max 200) */
  limit?: number;
}

/**
 * Query parameters for resolving a single target.
 */
export interface ResolveGatewayTargetQuery {
  /** Query string to search for */
  query: string;
  /** Optional channel to scope the search */
  channel?: string;
}

/**
 * Result of a successful target resolution.
 */
export interface GatewayTargetResolution {
  /** The matched target entry */
  entry: GatewayTargetDirectoryEntry;
  /** How the match was made (for debugging/auditing) */
  matchedBy: "target_id_exact" | "display_name_exact" | "alias_exact" | "target_id_prefix" | "display_name_prefix" | "alias_prefix";
}

/**
 * Error thrown when a target query matches no entries.
 */
export class GatewayTargetNotFoundError extends ValidationError {
  public constructor(query: string) {
    super(`gateway.target_not_found:${query}`, `gateway.target_not_found:${query}`, {
      statusCode: 404,
      retryable: false,
      details: { query },
    });
    this.name = "GatewayTargetNotFoundError";
  }
}

/**
 * Error thrown when a target query matches multiple entries.
 * Contains the list of candidates for disambiguation.
 */
export class GatewayTargetAmbiguousError extends ValidationError {
  public constructor(
    query: string,
    /** Matching candidate entries */
    public readonly candidates: GatewayTargetDirectoryEntry[],
  ) {
    super(`gateway.target_ambiguous:${query}`, `gateway.target_ambiguous:${query}`, {
      statusCode: 409,
      retryable: false,
      details: { query, candidateCount: candidates.length },
    });
    this.name = "GatewayTargetAmbiguousError";
  }
}

/**
 * Service for managing gateway target directory.
 *
 * The target directory provides a unified view of all known delivery targets,
 * whether explicitly registered or discovered through session history.
 *
 * Resolution follows a priority order:
 * 1. Exact match on targetId
 * 2. Exact match on displayName
 * 3. Exact match on any alias
 * 4. Prefix match on targetId
 * 5. Prefix match on displayName
 * 6. Prefix match on any alias
 *
 * If resolution yields multiple matches at any step, GatewayTargetAmbiguousError is thrown.
 */
export class GatewayTargetDirectoryService {
  public constructor(private readonly store: GatewayStoragePort) {}

  /**
   * Registers a new target in the directory or updates an existing one.
   *
   * If a target with the same channel + kind + externalId already exists,
   * it will be updated with the new information.
   *
   * @param input - Target registration input
   * @returns The registered target record
   */
  public registerTarget(input: RegisterGatewayTargetInput): GatewayTargetRecord {
    const observedAt = input.observedAt ?? nowIso();
    const normalizedExternalTargetId = normalizeHumanKey(input.externalTargetId);
    if (normalizedExternalTargetId.length === 0) {
      throw new ValidationError("gateway.invalid_external_target_id", "gateway.invalid_external_target_id", {
        retryable: false,
      });
    }
    const displayName = sanitizeDisplayName(input.displayName);
    if (displayName.length === 0) {
      throw new ValidationError("gateway.invalid_display_name", "gateway.invalid_display_name", {
        retryable: false,
      });
    }

    // Build the target record with canonical IDs and normalized data
    const target: GatewayTargetRecord = {
      targetId: buildCanonicalTargetId(input.channel, input.targetKind, normalizedExternalTargetId),
      channel: normalizeChannel(input.channel),
      targetKind: input.targetKind,
      externalTargetId: input.externalTargetId,
      displayName,
      aliasesJson: JSON.stringify(normalizeAliases(input.aliases)),
      metadataJson: input.metadata == null ? null : JSON.stringify(input.metadata),
      source: input.source ?? "directory",
      lastSeenAt: observedAt,
      createdAt: observedAt,
      updatedAt: observedAt,
    };
    this.store.upsertGatewayTarget(target);
    return this.store.getGatewayTarget(target.targetId) ?? target;
  }

  /**
   * Lists targets matching the given query criteria.
   *
   * Results are sorted by lastSeenAt (most recent first), then channel,
   * displayName, and targetId for consistent ordering.
   *
   * @param query - Filter criteria (all optional)
   * @returns Matching target entries
   */
  public listTargets(query: ListGatewayTargetsQuery = {}): GatewayTargetDirectoryEntry[] {
    const limit = clampLimit(query.limit ?? 50);
    const merged = this.buildMergedEntries(query.channel);
    const filtered = filterEntries(merged, query.query);
    return filtered.slice(0, limit);
  }

  /**
   * Resolves a target by query string.
   *
   * The query is matched against targetId, displayName, and aliases.
   * Matching follows the priority order described in the class documentation.
   *
   * @param query - Query string (trimmed and searched case-insensitively)
   * @returns The matched target with match type
   * @throws GatewayTargetNotFoundError if no match found
   * @throws GatewayTargetAmbiguousError if multiple matches found
   */
  public resolveTarget(query: ResolveGatewayTargetQuery): GatewayTargetResolution {
    const humanQuery = query.query.trim();
    if (humanQuery.length === 0) {
      throw new ValidationError("gateway.target_query_required", "gateway.target_query_required", {
        retryable: false,
      });
    }
    const entries = this.buildMergedEntries(query.channel);
    return resolveGatewayTargetFromEntries(entries, humanQuery);
  }

  /**
   * Builds a merged list of entries from explicit directory and session history.
   *
   * Session history entries are included only if they don't duplicate
   * explicitly registered targets (same targetId wins).
   *
   * @param channel - Optional channel filter
   * @returns Merged and sorted entries
   */
  private buildMergedEntries(channel?: string): GatewayTargetDirectoryEntry[] {
    // Get explicitly registered targets
    const explicit = this.store
      .listGatewayTargets(200, channel)
      .map((record) => mapGatewayTargetRecord(record));
    // Get session history targets
    const sessionHistory = this.store
      .listGatewaySessionTargetCandidates(200, channel)
      .map((candidate) => mapSessionCandidate(candidate));

    // Merge, preferring explicit entries
    const merged = new Map<string, GatewayTargetDirectoryEntry>();
    for (const entry of explicit) {
      merged.set(entry.targetId, entry);
    }
    for (const entry of sessionHistory) {
      if (!merged.has(entry.targetId)) {
        merged.set(entry.targetId, entry);
      }
    }
    return [...merged.values()].sort(compareGatewayTargets);
  }
}

/**
 * Converts a stored GatewayTargetRecord to a directory entry.
 *
 * @param record - Raw database record
 * @returns Directory entry format
 */
function mapGatewayTargetRecord(record: GatewayTargetRecord): GatewayTargetDirectoryEntry {
  return {
    targetId: record.targetId,
    channel: record.channel,
    targetKind: record.targetKind,
    source: record.source,
    displayName: record.displayName,
    aliases: parseAliases(record.aliasesJson),
    externalTargetId: record.externalTargetId,
    sessionId: null,
    taskId: null,
    lastSeenAt: record.lastSeenAt,
    latestMessagePreview: null,
  };
}

/**
 * Converts a session target candidate to a directory entry.
 *
 * Session-based targets are dynamically created from conversation history.
 * They use the task title or session ID as the display name.
 *
 * @param candidate - Session candidate from database
 * @returns Directory entry format
 */
function mapSessionCandidate(candidate: GatewaySessionTargetCandidate): GatewayTargetDirectoryEntry {
  const canonicalTargetId = buildCanonicalTargetId(
    candidate.channel,
    "session",
    normalizeHumanKey(candidate.externalSessionId ?? candidate.sessionId),
  );
  // Use task title if available, otherwise fall back to session ID
  const displayName = candidate.taskTitle != null && candidate.taskTitle.length > 0
    ? `${candidate.channel} :: ${candidate.taskTitle}`
    : `${candidate.channel} :: ${candidate.externalSessionId ?? candidate.sessionId}`;
  // Build aliases from available identifiers
  const aliases = [
    candidate.sessionId,
    candidate.externalSessionId,
    candidate.taskId,
    candidate.taskTitle,
  ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  return {
    targetId: canonicalTargetId,
    channel: candidate.channel,
    targetKind: "session",
    source: "session_history",
    displayName,
    aliases: normalizeAliases(aliases),
    externalTargetId: candidate.externalSessionId,
    sessionId: candidate.sessionId,
    taskId: candidate.taskId,
    lastSeenAt: candidate.lastSeenAt,
    latestMessagePreview: buildLatestMessagePreview(candidate.latestMessage),
  };
}

/**
 * Resolves a target from a list of entries using the query string.
 *
 * @param entries - All entries to search
 * @param query - Query string
 * @returns Resolution result
 * @throws GatewayTargetNotFoundError if no match
 * @throws GatewayTargetAmbiguousError if multiple exact or prefix matches
 */
function resolveGatewayTargetFromEntries(
  entries: GatewayTargetDirectoryEntry[],
  query: string,
): GatewayTargetResolution {
  const normalizedQuery = normalizeHumanKey(query);

  // Try exact matches first
  const exactMatches = collectMatches(entries, normalizedQuery, "exact");
  if (exactMatches.length === 1) {
    return exactMatches[0]!;
  }
  if (exactMatches.length > 1) {
    throw new GatewayTargetAmbiguousError(query, exactMatches.map((candidate) => candidate.entry));
  }

  // Fall back to prefix matches
  const prefixMatches = collectMatches(entries, normalizedQuery, "prefix");
  if (prefixMatches.length === 1) {
    return prefixMatches[0]!;
  }
  if (prefixMatches.length > 1) {
    throw new GatewayTargetAmbiguousError(query, prefixMatches.map((candidate) => candidate.entry));
  }

  throw new GatewayTargetNotFoundError(query);
}

/**
 * Collects all matches for a given query and mode.
 *
 * @param entries - Entries to search
 * @param normalizedQuery - Pre-normalized query string
 * @param mode - "exact" for full match, "prefix" for prefix match
 * @returns All matching resolutions
 */
function collectMatches(
  entries: GatewayTargetDirectoryEntry[],
  normalizedQuery: string,
  mode: "exact" | "prefix",
): GatewayTargetResolution[] {
  const matches: GatewayTargetResolution[] = [];
  for (const entry of entries) {
    const match = mode === "exact"
      ? matchExact(entry, normalizedQuery)
      : matchPrefix(entry, normalizedQuery);
    if (match != null) {
      matches.push(match);
    }
  }
  return matches;
}

/**
 * Attempts exact match of query against an entry.
 *
 * @param entry - Entry to match against
 * @param normalizedQuery - Query to match
 * @returns Resolution if matched, null otherwise
 */
function matchExact(entry: GatewayTargetDirectoryEntry, normalizedQuery: string): GatewayTargetResolution | null {
  if (normalizeHumanKey(entry.targetId) === normalizedQuery) {
    return { entry, matchedBy: "target_id_exact" };
  }
  if (normalizeHumanKey(entry.displayName) === normalizedQuery) {
    return { entry, matchedBy: "display_name_exact" };
  }
  if (entry.aliases.some((alias) => normalizeHumanKey(alias) === normalizedQuery)) {
    return { entry, matchedBy: "alias_exact" };
  }
  return null;
}

/**
 * Attempts prefix match of query against an entry.
 *
 * @param entry - Entry to match against
 * @param normalizedQuery - Query to match
 * @returns Resolution if matched, null otherwise
 */
function matchPrefix(entry: GatewayTargetDirectoryEntry, normalizedQuery: string): GatewayTargetResolution | null {
  if (normalizeHumanKey(entry.targetId).startsWith(normalizedQuery)) {
    return { entry, matchedBy: "target_id_prefix" };
  }
  if (normalizeHumanKey(entry.displayName).startsWith(normalizedQuery)) {
    return { entry, matchedBy: "display_name_prefix" };
  }
  if (entry.aliases.some((alias) => normalizeHumanKey(alias).startsWith(normalizedQuery))) {
    return { entry, matchedBy: "alias_prefix" };
  }
  return null;
}

/**
 * Comparison function for sorting gateway targets.
 *
 * Sort order: lastSeenAt (desc), channel, displayName, targetId.
 * This puts most-recently-active targets first.
 *
 * @param left - Left entry
 * @param right - Right entry
 * @returns Comparison result for sorting
 */
function compareGatewayTargets(left: GatewayTargetDirectoryEntry, right: GatewayTargetDirectoryEntry): number {
  const leftTimestamp = left.lastSeenAt ?? "";
  const rightTimestamp = right.lastSeenAt ?? "";
  return rightTimestamp.localeCompare(leftTimestamp)
    || left.channel.localeCompare(right.channel)
    || left.displayName.localeCompare(right.displayName)
    || left.targetId.localeCompare(right.targetId);
}

/**
 * Filters entries by query string.
 *
 * Matches if query appears in targetId, displayName, or any alias.
 *
 * @param entries - Entries to filter
 * @param query - Query string (optional)
 * @returns Filtered entries
 */
function filterEntries(entries: GatewayTargetDirectoryEntry[], query?: string): GatewayTargetDirectoryEntry[] {
  if (!query || query.trim().length === 0) {
    return entries;
  }
  const normalizedQuery = normalizeHumanKey(query);
  return entries.filter((entry) =>
    normalizeHumanKey(entry.targetId).includes(normalizedQuery)
    || normalizeHumanKey(entry.displayName).includes(normalizedQuery)
    || entry.aliases.some((alias) => normalizeHumanKey(alias).includes(normalizedQuery)),
  );
}

/**
 * Builds a preview string from the latest message.
 *
 * @param latestMessage - Raw message string
 * @returns Truncated preview or null
 */
function buildLatestMessagePreview(latestMessage: string | null): string | null {
  if (latestMessage == null) {
    return null;
  }
  // Normalize whitespace and trim
  const normalized = latestMessage.replace(/\s+/g, " ").trim();
  if (normalized.length === 0) {
    return null;
  }
  // Truncate to 80 chars with ellipsis
  return normalized.length > 80 ? `${normalized.slice(0, 77)}...` : normalized;
}

/**
 * Parses aliases JSON string to array.
 *
 * @param raw - JSON string from database
 * @returns Array of alias strings
 */
function parseAliases(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return normalizeAliases(parsed.map((value) => String(value)));
  } catch (err) {
    logger.warn("parseAliases failed", { error: err });
    return [];
  }
}

/**
 * Normalizes an alias array: trims, deduplicates, removes empty.
 *
 * @param aliases - Raw alias array
 * @returns Normalized alias array
 */
function normalizeAliases(aliases: readonly string[] | undefined): string[] {
  return [...new Set((aliases ?? [])
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0))];
}

/**
 * Sanitizes display name: normalizes whitespace.
 *
 * @param displayName - Raw display name
 * @returns Sanitized display name
 */
function sanitizeDisplayName(displayName: string): string {
  return displayName.replace(/\s+/g, " ").trim();
}

/**
 * Normalizes a channel identifier.
 *
 * @param channel - Raw channel string
 * @returns Lowercase, trimmed channel
 * @throws ValidationError if channel is empty
 */
function normalizeChannel(channel: string): string {
  const normalized = channel.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new ValidationError("gateway.invalid_channel", "gateway.invalid_channel", {
      retryable: false,
      details: { channel },
    });
  }
  return normalized;
}

/**
 * Normalizes a human-readable key (targetId, displayName, alias).
 *
 * Applies NFKC normalization, lowercasing, and whitespace normalization.
 * This ensures consistent matching regardless of input encoding.
 *
 * @param value - Raw string
 * @returns Normalized string
 */
function normalizeHumanKey(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Normalizes a segment of a canonical target ID.
 *
 * Converts to lowercase, replaces invalid characters with hyphens,
 * collapses multiple hyphens, and trims leading/trailing hyphens.
 *
 * @param value - Raw segment
 * @returns Normalized segment
 */
function normalizeCanonicalSegment(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._:-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Builds a canonical target ID from its components.
 *
 * Format: channel:targetKind:normalizedTargetId
 *
 * @param channel - Channel identifier
 * @param targetKind - Kind of target
 * @param rawTargetId - External target ID
 * @returns Canonical target ID
 * @throws StorageError if resulting target ID would be empty
 */
function buildCanonicalTargetId(channel: string, targetKind: GatewayTargetKind, rawTargetId: string): string {
  const normalizedChannel = normalizeChannel(channel);
  const normalizedTarget = normalizeCanonicalSegment(rawTargetId);
  if (normalizedTarget.length === 0) {
    throw new StorageError("gateway.invalid_target_id", "gateway.invalid_target_id", {
      retryable: false,
      statusCode: 404,
      details: { channel, targetKind, rawTargetId },
    });
  }
  return `${normalizedChannel}:${targetKind}:${normalizedTarget}`;
}

/**
 * Clamps a limit value to valid range [1, 200].
 *
 * @param limit - Raw limit value
 * @returns Clamped limit
 */
function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return 50;
  }
  return Math.max(1, Math.min(200, Math.trunc(limit)));
}
