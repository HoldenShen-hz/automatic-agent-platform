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
import { LearningObjectSchema } from "./learning-object-model.js";
/**
 * Artifact format — how the learned knowledge is serialized.
 */
export declare const ArtifactFormatSchema: z.ZodEnum<["json", "yaml", "markdown", "policy_bundle"]>;
export type ArtifactFormat = z.infer<typeof ArtifactFormatSchema>;
/**
 * LearningArtifact — 10-field artifact derived from a validated LearningObject.
 *
 * §8.2 defines this as the storable/exportable version of learned knowledge.
 */
export declare const LearningArtifactSchema: z.ZodObject<{
    /** Unique identifier for this artifact */
    artifactId: z.ZodString;
    /** ID of the LearningObject this artifact was derived from */
    sourceObjectId: z.ZodString;
    /** Version of this artifact (monotonically increasing per source object) */
    version: z.ZodNumber;
    /** Title extracted or derived from the learning object */
    title: z.ZodString;
    /** Format of the serialized content */
    format: z.ZodEnum<["json", "yaml", "markdown", "policy_bundle"]>;
    /** Serialized content ready for storage or publishing */
    content: z.ZodString;
    /** Knowledge namespace this artifact belongs to */
    namespace: z.ZodString;
    /** Approximate token size of the content */
    tokenSize: z.ZodNumber;
    /** SHA-256 checksum of content for integrity verification */
    checksum: z.ZodString;
    /** When this artifact was created */
    createdAt: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    createdAt: number;
    version: number;
    artifactId: string;
    content: string;
    title: string;
    namespace: string;
    format: "json" | "markdown" | "yaml" | "policy_bundle";
    checksum: string;
    sourceObjectId: string;
    tokenSize: number;
}, {
    createdAt: number;
    version: number;
    artifactId: string;
    content: string;
    title: string;
    namespace: string;
    format: "json" | "markdown" | "yaml" | "policy_bundle";
    checksum: string;
    sourceObjectId: string;
    tokenSize: number;
}>;
export type LearningArtifact = z.infer<typeof LearningArtifactSchema>;
/**
 * Creates a LearningArtifact from a validated LearningObject.
 * Serializes the object content and computes a SHA-256 checksum.
 */
export declare function createLearningArtifact(learningObject: z.infer<typeof LearningObjectSchema>, namespace: string, format?: ArtifactFormat): Promise<LearningArtifact>;
export declare function parseLearningArtifact(input: unknown): LearningArtifact;
