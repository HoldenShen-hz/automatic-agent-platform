/**
 * Knowledge and Memory Naming Mapper
 *
 * Provides bidirectional mapping between documentation-defined naming
 * and code implementation naming for trust levels and memory layers.
 *
 * ## Trust Level Mapping
 *
 * Documentation defines: verified, unverified, deprecated
 * Code uses: trusted, external, untrusted
 *
 * ## Memory Layer Mapping
 *
 * Documentation defines: working, episodic, semantic
 * Code uses: layer_3, layer_4, layer_5
 *
 * This module enables backward compatibility while using the canonical
 * documentation-defined names throughout the codebase.
 */
import { z } from "zod";
/**
 * Trust levels as defined in the documentation.
 */
export declare const DocTrustLevelSchema: z.ZodEnum<["verified", "unverified", "deprecated"]>;
export type DocTrustLevel = z.infer<typeof DocTrustLevelSchema>;
/**
 * Trust levels as used in the code implementation.
 */
export declare const CodeTrustLevelSchema: z.ZodEnum<["trusted", "external", "untrusted"]>;
export type CodeTrustLevel = z.infer<typeof CodeTrustLevelSchema>;
/**
 * Mapping from code trust levels to documentation trust levels.
 * - trusted → verified (high confidence, approved sources)
 * - external → unverified (external sources, not yet verified)
 * - untrusted → deprecated (known to be unreliable)
 */
export declare const TRUST_LEVEL_TO_DOC: Record<CodeTrustLevel, DocTrustLevel>;
/**
 * Mapping from documentation trust levels to code trust levels.
 */
export declare const TRUST_LEVEL_TO_CODE: Record<DocTrustLevel, CodeTrustLevel>;
/**
 * Converts a code trust level to documentation trust level.
 */
export declare function toDocTrustLevel(code: CodeTrustLevel): DocTrustLevel;
/**
 * Converts a documentation trust level to code trust level.
 */
export declare function toCodeTrustLevel(doc: DocTrustLevel): CodeTrustLevel;
/**
 * Checks if a trust level is at or above a minimum threshold.
 */
export declare function isTrustLevelAtOrAbove(level: CodeTrustLevel | DocTrustLevel, minimum: CodeTrustLevel | DocTrustLevel): boolean;
/**
 * Memory layers as defined in the documentation.
 */
export declare const DocMemoryLayerSchema: z.ZodEnum<["working", "episodic", "semantic"]>;
export type DocMemoryLayer = z.infer<typeof DocMemoryLayerSchema>;
/**
 * Memory layers as used in the code implementation.
 */
export declare const CodeMemoryLayerSchema: z.ZodEnum<["layer_3", "layer_4", "layer_5"]>;
export type CodeMemoryLayer = z.infer<typeof CodeMemoryLayerSchema>;
/**
 * Mapping from code memory layers to documentation memory layers.
 * - layer_3 → working (short-term, operational)
 * - layer_4 → episodic (medium-term, consolidated)
 * - layer_5 → semantic (long-term, summarized)
 */
export declare const MEMORY_LAYER_TO_DOC: Record<CodeMemoryLayer, DocMemoryLayer>;
/**
 * Mapping from documentation memory layers to code memory layers.
 */
export declare const MEMORY_LAYER_TO_CODE: Record<DocMemoryLayer, CodeMemoryLayer>;
/**
 * Converts a code memory layer to documentation memory layer.
 */
export declare function toDocMemoryLayer(code: CodeMemoryLayer): DocMemoryLayer;
/**
 * Converts a documentation memory layer to code memory layer.
 */
export declare function toCodeMemoryLayer(doc: DocMemoryLayer): CodeMemoryLayer;
/**
 * Checks if a memory layer is at or above a minimum tier.
 */
export declare function isMemoryLayerAtOrAbove(layer: CodeMemoryLayer | DocMemoryLayer, minimum: CodeMemoryLayer | DocMemoryLayer): boolean;
/**
 * Gets a human-readable description of a memory layer.
 */
export declare function getMemoryLayerDescription(layer: DocMemoryLayer): string;
/**
 * Gets a human-readable description of a trust level.
 */
export declare function getTrustLevelDescription(level: DocTrustLevel): string;
