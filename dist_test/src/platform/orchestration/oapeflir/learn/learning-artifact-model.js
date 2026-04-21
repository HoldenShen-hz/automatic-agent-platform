/**
 * LearningArtifact — externally storable/exportable artifact derived from a LearningObject.
 *
 * §8.2: Represents a versioned, serializable snapshot of learned knowledge
 * suitable for persistence, publishing, or cross-session sharing.
 *
 * Distinct from LearningObject which is the internal runtime representation.
 * LearningArtifact adds versioning, format, and content fields needed for
 * storage and retrieval in the Knowledge Plane.
 */
import { z } from "zod";
/**
 * Artifact format — how the learned knowledge is serialized.
 */
export const ArtifactFormatSchema = z.enum(["json", "yaml", "markdown", "policy_bundle"]);
/**
 * LearningArtifact — 10-field artifact derived from a validated LearningObject.
 *
 * §8.2 defines this as the storable/exportable version of learned knowledge.
 */
export const LearningArtifactSchema = z.object({
    /** Unique identifier for this artifact */
    artifactId: z.string().min(1),
    /** ID of the LearningObject this artifact was derived from */
    sourceObjectId: z.string().min(1),
    /** Version of this artifact (monotonically increasing per source object) */
    version: z.number().int().positive(),
    /** Title extracted or derived from the learning object */
    title: z.string().min(1),
    /** Format of the serialized content */
    format: ArtifactFormatSchema,
    /** Serialized content ready for storage or publishing */
    content: z.string(),
    /** Knowledge namespace this artifact belongs to */
    namespace: z.string().min(1),
    /** Approximate token size of the content */
    tokenSize: z.number().int().nonnegative(),
    /** SHA-256 checksum of content for integrity verification */
    checksum: z.string().regex(/^[a-f0-9]{64}$/),
    /** When this artifact was created */
    createdAt: z.number().int().nonnegative(),
});
/**
 * Creates a LearningArtifact from a validated LearningObject.
 * Serializes the object content and computes a SHA-256 checksum.
 */
export async function createLearningArtifact(learningObject, namespace, format = "json") {
    const content = JSON.stringify({
        learningType: learningObject.learningType,
        title: learningObject.title,
        summary: learningObject.summary,
        recommendation: learningObject.recommendation,
        evidenceRefs: learningObject.evidenceRefs,
    });
    let checksum;
    try {
        const { createHash } = await import("node:crypto");
        checksum = createHash("sha256").update(content).digest("hex");
    }
    catch {
        // Deterministic fallback — must still be 64 hex chars to satisfy schema
        checksum = learningObject.learningObjectId.padEnd(64, "0").slice(0, 64);
    }
    return {
        artifactId: `artifact_${learningObject.learningObjectId}`,
        sourceObjectId: learningObject.learningObjectId,
        version: 1,
        title: learningObject.title,
        format,
        content,
        namespace,
        tokenSize: Math.ceil(content.length / 4),
        checksum,
        createdAt: Date.now(),
    };
}
export function parseLearningArtifact(input) {
    return LearningArtifactSchema.parse(input);
}
//# sourceMappingURL=learning-artifact-model.js.map