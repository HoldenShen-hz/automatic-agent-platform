import type { MemoryLayer, MemoryRecord } from "../../contracts/types/domain.js";
import { type StructuredMemoryContent } from "./memory-schema.js";
export interface MemoryConsolidationSummary {
    summaryText: string;
    averageQualityScore: number | null;
    sourceMemoryIds: string[];
    sourceCount: number;
    structuredContent: StructuredMemoryContent;
}
export declare function extractMemorySnippet(record: Pick<MemoryRecord, "contentJson">): string;
export declare function hasExplicitMemoryBoundary(query: Partial<Pick<MemoryRecord, "taskId" | "sessionId" | "agentId" | "executionId">> & {
    scopes?: string[];
}): boolean;
export declare function buildMemoryConsolidationSummary(records: MemoryRecord[], targetLayer: Exclude<MemoryLayer, "layer_3">): MemoryConsolidationSummary;
