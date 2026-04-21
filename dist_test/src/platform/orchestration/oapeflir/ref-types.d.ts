/**
 * RefId type system — typed references for cross-plane linking.
 *
 * §A.1: Base string RefId with format {refType}:{id} for Evidence, Artifact, Memory.
 * KnowledgeRef is an extended interface with retrieval metadata fields.
 *
 * Usage:
 *   const ref: ArtifactRef = "artifact:abc123";
 *   const kr: KnowledgeRef = { knowledgeRef: "knowledge:xyz", refType: "knowledge",
 *                              namespace: "docs", chunkId: "c1", documentId: "d1",
 *                              score: 0.95, matchType: "semantic" };
 */
import { z } from "zod";
/**
 * Base RefId schema — validates the {refType}:{id} string format.
 */
export declare const RefIdSchema: z.ZodString;
export type RefId = z.infer<typeof RefIdSchema>;
/** Evidence reference — points to a source evidence record */
export type EvidenceRef = RefId;
/** Artifact reference — points to a produced artifact */
export type ArtifactRef = RefId;
/** Memory reference — points to an L1-L6 memory entry */
export type MemoryRef = RefId;
/**
 * Knowledge reference — points to a knowledge plane document or chunk.
 * Extends the base RefId with additional retrieval metadata fields.
 *
 * §A.1 defines this as an interface with refType discriminator.
 */
export interface KnowledgeRef {
    /** String form: "knowledge:{id}" */
    knowledgeRef: string;
    /** Discriminator field */
    refType: "knowledge";
    /** Knowledge namespace this reference belongs to */
    namespace: string;
    /** Chunk identifier within the document */
    chunkId: string;
    /** Document this chunk belongs to */
    documentId: string;
    /** Relevance score from retrieval (0-1) */
    score: number;
    /** Match type from the retrieval query */
    matchType: "semantic" | "keyword" | "structural";
}
export declare function parseRefId(input: unknown): RefId;
