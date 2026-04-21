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
export const RefIdSchema = z.string().regex(/^[a-z_]+:[a-zA-Z0-9_-]+$/, {
    message: "RefId must match pattern {refType}:{id}",
});
export function parseRefId(input) {
    return RefIdSchema.parse(input);
}
//# sourceMappingURL=ref-types.js.map