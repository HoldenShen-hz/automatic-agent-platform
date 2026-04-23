import { ValidationError } from "../../contracts/errors.js";
import type { GatewayTargetKind, GatewayTargetRecord, GatewayTargetSource } from "../../contracts/types/domain.js";
import type { GatewayStoragePort } from "./storage-port.js";
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
export declare class GatewayTargetNotFoundError extends ValidationError {
    constructor(query: string);
}
/**
 * Error thrown when a target query matches multiple entries.
 * Contains the list of candidates for disambiguation.
 */
export declare class GatewayTargetAmbiguousError extends ValidationError {
    /** Matching candidate entries */
    readonly candidates: GatewayTargetDirectoryEntry[];
    constructor(query: string, 
    /** Matching candidate entries */
    candidates: GatewayTargetDirectoryEntry[]);
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
export declare class GatewayTargetDirectoryService {
    private readonly store;
    constructor(store: GatewayStoragePort);
    /**
     * Registers a new target in the directory or updates an existing one.
     *
     * If a target with the same channel + kind + externalId already exists,
     * it will be updated with the new information.
     *
     * @param input - Target registration input
     * @returns The registered target record
     */
    registerTarget(input: RegisterGatewayTargetInput): GatewayTargetRecord;
    /**
     * Lists targets matching the given query criteria.
     *
     * Results are sorted by lastSeenAt (most recent first), then channel,
     * displayName, and targetId for consistent ordering.
     *
     * @param query - Filter criteria (all optional)
     * @returns Matching target entries
     */
    listTargets(query?: ListGatewayTargetsQuery): GatewayTargetDirectoryEntry[];
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
    resolveTarget(query: ResolveGatewayTargetQuery): GatewayTargetResolution;
    /**
     * Builds a merged list of entries from explicit directory and session history.
     *
     * Session history entries are included only if they don't duplicate
     * explicitly registered targets (same targetId wins).
     *
     * @param channel - Optional channel filter
     * @returns Merged and sorted entries
     */
    private buildMergedEntries;
}
