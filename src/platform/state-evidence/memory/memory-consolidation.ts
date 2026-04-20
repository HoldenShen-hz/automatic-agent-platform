import type { MemoryLayer, MemoryRecord } from "../../contracts/types/domain.js";
import {
  buildFactProvenanceFromRecord,
  extractStructuredMemoryText,
  parseStructuredMemoryContent,
  type StructuredMemoryContent,
} from "./memory-schema.js";

export interface MemoryConsolidationSummary {
  summaryText: string;
  averageQualityScore: number | null;
  sourceMemoryIds: string[];
  sourceCount: number;
  structuredContent: StructuredMemoryContent;
}

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
): MemoryConsolidationSummary {
  const ordered = [...records].sort((left, right) => {
    if (left.createdAt === right.createdAt) {
      return left.id.localeCompare(right.id);
    }
    return left.createdAt.localeCompare(right.createdAt);
  });

  const snippets = ordered
    .map((record) => extractMemorySnippet(record))
    .filter((snippet) => snippet.trim().length > 0)
    .slice(0, 8);
  const classifications = Array.from(new Set(ordered.map((record) => record.classification))).sort();
  const qualityScores = ordered
    .map((record) => record.qualityScore)
    .filter((score): score is number => typeof score === "number" && Number.isFinite(score));

  const summaryText = [
    `Consolidated ${ordered.length} memories into ${targetLayer}.`,
    `Window: ${ordered[0]?.createdAt ?? "unknown"} -> ${ordered.at(-1)?.createdAt ?? "unknown"}.`,
    `Classifications: ${classifications.join(", ") || "unknown"}.`,
    snippets.length > 0 ? `Highlights: ${snippets.join(" | ")}` : null,
  ]
    .filter((item): item is string => item != null)
    .join(" ");

  const structuredContent: StructuredMemoryContent = {
    schemaVersion: "memory.v2",
    workContext: `Consolidated ${ordered.length} memories into ${targetLayer}`,
    topOfMind: snippets.slice(0, 3),
    recentHistory: snippets.slice(0, 5),
    longTermBackground: [
      `Window ${ordered[0]?.createdAt ?? "unknown"} -> ${ordered.at(-1)?.createdAt ?? "unknown"}`,
      `Classifications: ${classifications.join(", ") || "unknown"}`,
    ],
    facts: ordered.flatMap((record) => {
      const content = parseStructuredMemoryContent(record.contentJson);
      const provenance = buildFactProvenanceFromRecord(record, "memory.consolidation_source");
      return content.facts.map((fact) => ({
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
      }));
    }).slice(0, 12),
  };

  return {
    summaryText,
    averageQualityScore:
      qualityScores.length > 0 ? qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length : null,
    sourceMemoryIds: ordered.map((record) => record.id),
    sourceCount: ordered.length,
    structuredContent,
  };
}
