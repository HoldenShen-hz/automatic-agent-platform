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
export const ArtifactFormatSchema = z.enum(["json", "yaml", "markdown", "policy_bundle"]);
export type ArtifactFormat = z.infer<typeof ArtifactFormatSchema>;

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

export type LearningArtifact = z.infer<typeof LearningArtifactSchema>;

/**
 * Creates a LearningArtifact from a validated LearningObject.
 * Serializes the object content and computes a SHA-256 checksum.
 */
export async function createLearningArtifact(
  learningObject: z.infer<typeof LearningObjectSchema>,
  namespace: string,
  format: ArtifactFormat = "json",
): Promise<LearningArtifact> {
  const content = JSON.stringify({
    learningType: learningObject.learningType,
    title: learningObject.title,
    summary: learningObject.summary,
    recommendation: learningObject.recommendation,
    evidenceRefs: learningObject.evidenceRefs,
  });

  let checksum: string;
  try {
    const { createHash } = await import("node:crypto");
    checksum = createHash("sha256").update(content).digest("hex");
  } catch {
    // R29-01 FIX: Hash the learningObjectId to produce a valid hex checksum.
    // Root cause: Previously used learningObjectId.padEnd(64, "0").slice(0, 64) directly,
    // but learningObjectId may contain non-hex characters (_ , g-z) which violate the
    // SHA-256 hex format requirement ^[a-f0-9]{64}$.
    // Fix: Hash the learningObjectId to produce a proper 64-char hex string.
    const { createHash } = await import("node:crypto");
    checksum = createHash("sha256").update(learningObject.learningObjectId).digest("hex");
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

export function parseLearningArtifact(input: unknown): LearningArtifact {
  return LearningArtifactSchema.parse(input);
}
