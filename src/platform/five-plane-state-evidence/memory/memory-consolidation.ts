import type { MemoryLayer, MemoryRecord } from "../../contracts/types/domain.js";
import {
  buildFactProvenanceFromRecord,
  extractStructuredMemoryText,
  parseStructuredMemoryContent,
  type StructuredMemoryContent,
} from "./memory-schema.js";

/**
 * R24-29/R24-32 FIX: Loss report for memory consolidation.
 * Per §29.2, compression requires loss report - facts must not be silently discarded.
 */
export interface ConsolidationLossReport {
  consolidatedMemoryCount: number;
  sourceMemoryCount: number;
  /** Memories that were excluded from consolidation */
  excludedMemories: readonly {
    memoryId: string;
    scope: string;
    reason: string;
    qualityScore: number | null;
    importanceScore: number | null;
    createdAt: string;
  }[];
  /** Content snippets that were dropped during summarization */
  droppedContent: readonly {
    memoryId: string;
    snippetPreview: string;
    reason: string;
  }[];
  truncationTimestamp: string;
}

export interface MemoryConsolidationSummary {
  summaryText: string;
  averageQualityScore: number | null;
  sourceMemoryIds: string[];
  sourceCount: number;
  structuredContent: StructuredMemoryContent;
  /**
   * R24-29/R24-32 FIX: Loss report documenting what was lost during consolidation.
   * Per §29.2, facts must not be silently discarded - compression requires loss report.
   */
  lossReport: ConsolidationLossReport;
}

export interface MemoryConsolidationOptions {
  maxSnippets?: number;
  maxFacts?: number;
  truncationTimestamp?: string;
}

const DEFAULT_MAX_CONSOLIDATION_SNIPPETS = 8;
const DEFAULT_MAX_CONSOLIDATION_FACTS = 12;

export function extractMemorySnippet(record: Pick<MemoryRecord, "contentJson">): string {
  const snippets = extractStructuredMemoryText(parseStructuredMemoryContent(record.contentJson));
  return snippets[0] ?? record.contentJson;
}

export function hasExplicitMemoryBoundary(
  query: Partial<Pick<MemoryRecord, "taskId" | "sessionId" | "agentId" | "executionId">> & {
    scopes?: string[];
  },
): boolean {
  return Boolean(
    query.taskId != null ||
      query.sessionId != null ||
      query.agentId != null ||
      query.executionId != null ||
      (query.scopes != null && query.scopes.length > 0),
  );
}

export function buildMemoryConsolidationSummary(
  records: MemoryRecord[],
  targetLayer: Exclude<MemoryLayer, "layer_3">,
  options: MemoryConsolidationOptions = {},
): MemoryConsolidationSummary {
  const maxSnippets = Math.max(1, options.maxSnippets ?? DEFAULT_MAX_CONSOLIDATION_SNIPPETS);
  const maxFacts = Math.max(1, options.maxFacts ?? DEFAULT_MAX_CONSOLIDATION_FACTS);
  const ordered = [...records].sort((left, right) => {
    if (left.createdAt === right.createdAt) {
      return left.id.localeCompare(right.id);
    }
    return left.createdAt.localeCompare(right.createdAt);
  });

  const snippets = ordered
    .map((record) => ({ record, snippet: extractMemorySnippet(record) }))
    .filter(({ snippet }) => snippet.trim().length > 0);
  const droppedSnippets = snippets.slice(maxSnippets);
  const limitedSnippets = snippets.slice(0, maxSnippets);
  const classifications = Array.from(new Set(ordered.map((record) => record.classification))).sort();
  const qualityScores = ordered
    .map((record) => record.qualityScore)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

  const factEntries = ordered.flatMap((record) => {
    const content = parseStructuredMemoryContent(record.contentJson);
    const provenance = buildFactProvenanceFromRecord(record, "memory.consolidation_source");
    return content.facts.map((fact) => ({
      record,
      fact,
      provenance,
    }));
  });
  const retainedFacts = factEntries.slice(0, maxFacts);
  const droppedFacts = factEntries.slice(maxFacts);

  const summaryText = [
    `Consolidated ${ordered.length} memories into ${targetLayer}.`,
    `Window: ${ordered[0]?.createdAt ?? "unknown"} -> ${ordered.at(-1)?.createdAt ?? "unknown"}.`,
    `Classifications: ${classifications.join(", ") || "unknown"}.`,
    limitedSnippets.length > 0 ? `Highlights: ${limitedSnippets.map(s => s.snippet).join(" | ")}` : null,
  ]
    .filter((item): item is string => item != null)
    .join(" ");

  const structuredContent: StructuredMemoryContent = {
    schemaVersion: "memory.v2",
    workContext: `Consolidated ${ordered.length} memories into ${targetLayer}`,
    topOfMind: limitedSnippets.slice(0, 3).map(s => s.snippet),
    recentHistory: limitedSnippets.slice(0, 5).map(s => s.snippet),
    longTermBackground: [
      `Window ${ordered[0]?.createdAt ?? "unknown"} -> ${ordered.at(-1)?.createdAt ?? "unknown"}`,
      `Classifications: ${classifications.join(", ") || "unknown"}`,
    ],
    facts: retainedFacts.map(({ fact, provenance }) => ({
        content: fact.content,
        category: fact.category,
        confidence: fact.confidence,
        provenance: {
          ...fact.provenance,
          classification: fact.provenance.classification ?? provenance.classification,
          taskId: fact.provenance.taskId ?? provenance.taskId,
          sessionId: fact.provenance.sessionId ?? provenance.sessionId,
          agentId: fact.provenance.agentId ?? provenance.agentId,
          executionId: fact.provenance.executionId ?? provenance.executionId,
          observedAt: fact.provenance.observedAt ?? provenance.observedAt,
        },
      })),
    metadata: {},
  };

  // R24-29/R24-32 FIX: Build loss report documenting dropped content
  const lossReport: ConsolidationLossReport = {
    consolidatedMemoryCount: ordered.length,
    sourceMemoryCount: ordered.length,
    excludedMemories: [],
    droppedContent: [
      ...droppedSnippets.map(({ record, snippet }) => ({
        memoryId: record.id,
        snippetPreview: snippet.length > 50 ? snippet.slice(0, 50) + "..." : snippet,
        reason: `exceeded_max_snippets_limit:${maxSnippets}`,
      })),
      ...droppedFacts.map(({ record, fact }) => ({
        memoryId: record.id,
        snippetPreview: fact.content.length > 50 ? fact.content.slice(0, 50) + "..." : fact.content,
        reason: `exceeded_max_facts_limit:${maxFacts}`,
      })),
    ],
    truncationTimestamp: options.truncationTimestamp ?? new Date().toISOString(),
  };

  return {
    summaryText,
    averageQualityScore:
      qualityScores.length > 0 ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length : null,
    sourceMemoryIds: ordered.map((record) => record.id),
    sourceCount: ordered.length,
    structuredContent,
    lossReport,
  };
}
