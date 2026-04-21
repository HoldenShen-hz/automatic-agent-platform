/**
 * MemoryWriteRequest — structured request to write a memory entry to the memory plane.
 *
 * §F.6: Complete write request with scope, content, importance scoring,
 * and promotion metadata for L1-L6 layer hierarchy.
 */
import { type HierarchicalMemoryLayer } from "./memory-layer-model.js";
export interface MemoryWriteRequest {
    /** Unique identifier for this write request */
    requestId: string;
    /** Memory content to write */
    content: MemoryContent;
    /** Target memory scope/layer */
    scope: MemoryScope;
    /** Importance score for promotion decisions (0-1) */
    importanceScore: number;
    /** Quality score for promotion decisions (0-1) */
    qualityScore: number;
    /** Number of times this memory has been accessed */
    hitCount: number;
    /** Tags for categorization */
    tags: string[];
    /** Whether this memory should be promoted automatically */
    autoPromote: boolean;
    /** Timestamp for this write operation */
    writtenAt: number;
    /** Optional source task or execution ID */
    sourceRef?: string;
}
export interface MemoryContent {
    /** Memory text content */
    text: string;
    /** Summary for quick recall */
    summary: string;
    /** Key entities mentioned in the memory */
    entities: string[];
    /** Key concepts in the memory */
    concepts: string[];
    /** Importance of this memory relative to other memories */
    importance: "low" | "medium" | "high";
    /** Optional structured data */
    metadata?: Record<string, unknown>;
}
export type MemoryScope = HierarchicalMemoryLayer;
