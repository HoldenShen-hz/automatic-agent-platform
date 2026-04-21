/**
 * Memory Schema
 *
 * Defines the structured memory content format (memory.v2) and provides
 * utilities for parsing, normalizing, and extracting text from memory content.
 *
 * ## Structured Memory Format
 *
 * Memories store content in a structured format with:
 * - workContext: Main context or summary
 * - topOfMind: Key points to remember
 * - recentHistory: Recent events or information
 * - longTermBackground: Background knowledge
 * - facts: Extracted factual statements with provenance
 *
 * ## Provenance Tracking
 *
 * Each fact carries provenance information:
 * - source: Where the fact came from
 * - classification: Category of the fact
 * - taskId/sessionId/agentId/executionId: Origin context
 * - observedAt: When the fact was observed
 */
import type { MemoryRecord } from "../../contracts/types/domain.js";
/**
 * Provenance information for a fact - tracks its origin
 */
export interface StructuredMemoryFactProvenance {
    source: string;
    classification: string | null;
    taskId: string | null;
    sessionId: string | null;
    agentId: string | null;
    executionId: string | null;
    observedAt: string | null;
}
/**
 * A factual statement extracted from memory
 */
export interface StructuredMemoryFact {
    content: string;
    category: string | null;
    confidence: number | null;
    provenance: StructuredMemoryFactProvenance;
}
/**
 * Structured memory content format (schema version memory.v2)
 */
export interface StructuredMemoryContent {
    schemaVersion: "memory.v2";
    workContext: string | null;
    topOfMind: string[];
    recentHistory: string[];
    longTermBackground: string[];
    facts: StructuredMemoryFact[];
}
/**
 * Input for normalizing memory content
 */
export interface NormalizeMemoryContentInput {
    content: string | Record<string, unknown> | StructuredMemoryContent;
    classification?: string | null;
    qualityScore?: number | null;
    taskId?: string | null;
    sessionId?: string | null;
    agentId?: string | null;
    executionId?: string | null;
    observedAt?: string | null;
    defaultSource?: string;
}
/**
 * Normalizes memory content into structured format
 *
 * Accepts:
 * - Plain string (treated as workContext)
 * - Structured object (parsed and validated)
 * - Already StructuredMemoryContent (validated)
 */
export declare function normalizeMemoryContent(input: NormalizeMemoryContentInput): StructuredMemoryContent;
/**
 * Parses memory content JSON into structured format
 *
 * Handles:
 * - JSON string -> parse and normalize
 * - Already parsed object -> normalize
 * - Parse errors -> treat raw string as content
 */
export declare function parseStructuredMemoryContent(contentJson: string): StructuredMemoryContent;
/**
 * Serializes structured memory content to JSON string
 */
export declare function stringifyStructuredMemoryContent(content: StructuredMemoryContent): string;
/**
 * Extracts all searchable text from structured memory content
 *
 * Returns deduplicated list of all text fields in priority order:
 * 1. workContext
 * 2. topOfMind items
 * 3. recentHistory items
 * 4. longTermBackground items
 * 5. Fact contents
 */
export declare function extractStructuredMemoryText(content: StructuredMemoryContent): string[];
/**
 * Builds provenance from a memory record
 */
export declare function buildFactProvenanceFromRecord(record: Pick<MemoryRecord, "taskId" | "sessionId" | "agentId" | "executionId" | "classification" | "createdAt">, source: string): StructuredMemoryFactProvenance;
