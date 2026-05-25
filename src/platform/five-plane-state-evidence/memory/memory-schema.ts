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
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const memorySchemaLogger = new StructuredLogger({ retentionLimit: 100 });

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
  metadata: Record<string, unknown>;
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

// Keys that are part of the structured format
const STRUCTURED_KEYS = new Set([
  "schemaVersion",
  "workContext",
  "topOfMind",
  "recentHistory",
  "longTermBackground",
  "facts",
  "metadata",
]);

// Type guard for plain objects
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Normalizes a string value - trims whitespace and returns null if empty
 */
function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalizes a list of strings, filtering out empty values
 */
function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item))
      .filter((item): item is string => item != null);
  }
  const single = normalizeString(value);
  return single == null ? [] : [single];
}

/**
 * Normalizes confidence score to 0-1 range
 */
function normalizeConfidence(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(1, value));
}

/**
 * Creates provenance object from input
 */
function createProvenance(input: NormalizeMemoryContentInput): StructuredMemoryFactProvenance {
  return {
    source: input.defaultSource ?? "remember",
    classification: input.classification ?? null,
    taskId: input.taskId ?? null,
    sessionId: input.sessionId ?? null,
    agentId: input.agentId ?? null,
    executionId: input.executionId ?? null,
    observedAt: input.observedAt ?? null,
  };
}

/**
 * Creates empty structured memory content
 */
function createEmptyStructuredMemoryContent(): StructuredMemoryContent {
  return {
    schemaVersion: "memory.v2",
    workContext: null,
    topOfMind: [],
    recentHistory: [],
    longTermBackground: [],
    facts: [],
    metadata: {},
  };
}

/**
 * Appends unique values to target array
 */
function appendUnique(target: string[], values: readonly string[]): void {
  for (const value of values) {
    if (!target.includes(value)) {
      target.push(value);
    }
  }
}

/**
 * Appends a fact to the target array, avoiding duplicates
 */
function appendFact(
  target: StructuredMemoryFact[],
  content: unknown,
  category: string | null,
  confidence: number | null,
  provenance: StructuredMemoryFactProvenance,
): void {
  const normalizedContent = normalizeString(content);
  if (normalizedContent == null) {
    return;
  }

  // Skip duplicate facts
  const duplicate = target.some((fact) => fact.content === normalizedContent && fact.category === category);
  if (duplicate) {
    return;
  }

  target.push({
    content: normalizedContent,
    category,
    confidence,
    provenance,
  });
}

/**
 * Normalizes a fact from various formats (string or object)
 */
function normalizeFact(
  value: unknown,
  fallbackProvenance: StructuredMemoryFactProvenance,
  fallbackConfidence: number | null,
): StructuredMemoryFact | null {
  // String format: just the fact text
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return null;
    }
    return {
      content: normalized,
      category: null,
      confidence: fallbackConfidence,
      provenance: fallbackProvenance,
    };
  }

  if (!isRecord(value)) {
    return null;
  }

  const content = normalizeString(value.content);
  if (content == null) {
    return null;
  }

  // Extract provenance from various possible field names
  const provenanceRecord = isRecord(value.provenance) ? value.provenance : null;
  const provenance: StructuredMemoryFactProvenance = {
    source:
      normalizeString(provenanceRecord?.source) ??
      normalizeString(value.provenanceSource) ??
      normalizeString(value.source) ??
      fallbackProvenance.source,
    classification:
      normalizeString(provenanceRecord?.classification) ??
      normalizeString(value.classification) ??
      fallbackProvenance.classification,
    taskId: normalizeString(provenanceRecord?.taskId) ?? fallbackProvenance.taskId,
    sessionId: normalizeString(provenanceRecord?.sessionId) ?? fallbackProvenance.sessionId,
    agentId: normalizeString(provenanceRecord?.agentId) ?? fallbackProvenance.agentId,
    executionId: normalizeString(provenanceRecord?.executionId) ?? fallbackProvenance.executionId,
    observedAt: normalizeString(provenanceRecord?.observedAt) ?? fallbackProvenance.observedAt,
  };

  return {
    content,
    category: normalizeString(value.category),
    confidence: normalizeConfidence(value.confidence) ?? fallbackConfidence,
    provenance,
  };
}

/**
 * Normalizes structured memory object, extracting facts from various field names
 */
function normalizeStructuredObject(
  value: Record<string, unknown> | StructuredMemoryContent,
  input: NormalizeMemoryContentInput,
): StructuredMemoryContent {
  const result = createEmptyStructuredMemoryContent();
  const fallbackProvenance = createProvenance(input);
  const fallbackConfidence = input.qualityScore ?? null;

  // Extract structured fields
  result.workContext = normalizeString(value.workContext);
  appendUnique(result.topOfMind, normalizeStringList(value.topOfMind));
  appendUnique(result.recentHistory, normalizeStringList(value.recentHistory));
  appendUnique(result.longTermBackground, normalizeStringList(value.longTermBackground));

  // Extract facts array
  if (Array.isArray(value.facts)) {
    for (const item of value.facts) {
      const normalized = normalizeFact(item, fallbackProvenance, fallbackConfidence);
      if (normalized != null) {
        appendFact(result.facts, normalized.content, normalized.category, normalized.confidence, normalized.provenance);
      }
    }
  }
  if (isRecord(value.metadata)) {
    result.metadata = { ...value.metadata };
  }

  // Handle additional field names that map to structured fields
  for (const [key, rawValue] of Object.entries(value)) {
    if (STRUCTURED_KEYS.has(key)) {
      continue;
    }

    // text/note -> topOfMind + fact
    if (key === "text" || key === "note") {
      const normalized = normalizeString(rawValue);
      if (normalized != null) {
        appendUnique(result.topOfMind, [normalized]);
        appendFact(result.facts, normalized, input.classification ?? "note", fallbackConfidence, fallbackProvenance);
      }
      continue;
    }

    // summary/summaryText -> longTermBackground + fact
    if (key === "summary" || key === "summaryText") {
      appendUnique(result.longTermBackground, normalizeStringList(rawValue));
      appendFact(result.facts, rawValue, "summary", fallbackConfidence, fallbackProvenance);
      continue;
    }

    // reasonCode -> topOfMind + fact (high confidence)
    if (key === "reasonCode") {
      appendUnique(result.topOfMind, normalizeStringList(rawValue));
      appendFact(result.facts, rawValue, "reason_code", 1, fallbackProvenance);
      continue;
    }

    // errorMessage -> recentHistory + fact
    if (key === "errorMessage") {
      const normalized = normalizeString(rawValue);
      if (normalized != null) {
        appendUnique(result.recentHistory, [normalized]);
      }
      appendFact(result.facts, rawValue, "error_message", fallbackConfidence, fallbackProvenance);
      continue;
    }

    // kind -> fact (high confidence)
    if (key === "kind") {
      appendFact(result.facts, rawValue, "kind", 1, fallbackProvenance);
      continue;
    }

    // Array fields -> facts with key as category
    if (Array.isArray(rawValue)) {
      result.metadata[key] = [...rawValue];
      for (const item of rawValue) {
        if (typeof item === "string") {
          appendFact(result.facts, item, key, fallbackConfidence, fallbackProvenance);
        }
      }
      continue;
    }

    if (isRecord(rawValue)) {
      result.metadata[key] = { ...rawValue };
      continue;
    }

    // Primitive values -> fact with key=value format
    if (typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean") {
      result.metadata[key] = rawValue;
      appendFact(result.facts, `${key}=${String(rawValue)}`, key, fallbackConfidence, fallbackProvenance);
    }
  }

  return result;
}

/**
 * Normalizes memory content into structured format
 *
 * Accepts:
 * - Plain string (treated as workContext)
 * - Structured object (parsed and validated)
 * - Already StructuredMemoryContent (validated)
 */
export function normalizeMemoryContent(input: NormalizeMemoryContentInput): StructuredMemoryContent {
  const fallbackProvenance = createProvenance(input);
  const fallbackConfidence = input.qualityScore ?? null;

  // String input: treat as workContext
  if (typeof input.content === "string") {
    const result = createEmptyStructuredMemoryContent();
    const normalized = normalizeString(input.content);
    if (normalized != null) {
      result.workContext = normalized;
      appendUnique(result.topOfMind, [normalized]);
      appendFact(result.facts, normalized, input.classification ?? "note", fallbackConfidence, fallbackProvenance);
    }
    return result;
  }

  return normalizeStructuredObject(input.content as Record<string, unknown>, input);
}

/**
 * Parses memory content JSON into structured format
 *
 * Handles:
 * - JSON string -> parse and normalize
 * - Already parsed object -> normalize
 * - Parse errors -> treat raw string as content
 */
export function parseStructuredMemoryContent(contentJson: string): StructuredMemoryContent {
  try {
    const parsed = JSON.parse(contentJson) as unknown;
    if (typeof parsed === "string") {
      return normalizeMemoryContent({ content: parsed });
    }
    if (isRecord(parsed)) {
      return normalizeMemoryContent({ content: parsed });
    }
  } catch (err) {
    memorySchemaLogger.warn("memory_schema: JSON.parse failed in parseStructuredMemoryContent", { error: err instanceof Error ? err.message : String(err), contentJsonLength: contentJson.length });
    // Fall back to treating the raw string as content
    return normalizeMemoryContent({ content: contentJson });
  }

  return normalizeMemoryContent({ content: contentJson });
}

/**
 * Serializes structured memory content to JSON string
 */
export function stringifyStructuredMemoryContent(content: StructuredMemoryContent): string {
  return JSON.stringify(content);
}

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
export function extractStructuredMemoryText(content: StructuredMemoryContent): string[] {
  const ordered = [
    content.workContext,
    ...content.topOfMind,
    ...content.recentHistory,
    ...content.longTermBackground,
    ...content.facts.map((fact) => fact.content),
  ]
    .map((value) => normalizeString(value))
    .filter((value): value is string => value != null);

  return [...new Set(ordered)];
}

/**
 * Builds provenance from a memory record
 */
export function buildFactProvenanceFromRecord(
  record: Pick<MemoryRecord, "taskId" | "sessionId" | "agentId" | "executionId" | "classification" | "createdAt">,
  source: string,
): StructuredMemoryFactProvenance {
  return {
    source,
    classification: record.classification,
    taskId: record.taskId,
    sessionId: record.sessionId,
    agentId: record.agentId,
    executionId: record.executionId,
    observedAt: record.createdAt,
  };
}
