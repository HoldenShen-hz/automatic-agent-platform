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
// ─────────────────────────────────────────────────────────────────
// Trust Level Mapping
// ─────────────────────────────────────────────────────────────────
/**
 * Trust levels as defined in the documentation.
 */
export const DocTrustLevelSchema = z.enum(["verified", "unverified", "deprecated"]);
/**
 * Trust levels as used in the code implementation.
 */
export const CodeTrustLevelSchema = z.enum(["trusted", "external", "untrusted"]);
/**
 * Mapping from code trust levels to documentation trust levels.
 * - trusted → verified (high confidence, approved sources)
 * - external → unverified (external sources, not yet verified)
 * - untrusted → deprecated (known to be unreliable)
 */
export const TRUST_LEVEL_TO_DOC = {
    trusted: "verified",
    external: "unverified",
    untrusted: "deprecated",
};
/**
 * Mapping from documentation trust levels to code trust levels.
 */
export const TRUST_LEVEL_TO_CODE = {
    verified: "trusted",
    unverified: "external",
    deprecated: "untrusted",
};
/**
 * Converts a code trust level to documentation trust level.
 */
export function toDocTrustLevel(code) {
    return TRUST_LEVEL_TO_DOC[code];
}
/**
 * Converts a documentation trust level to code trust level.
 */
export function toCodeTrustLevel(doc) {
    return TRUST_LEVEL_TO_CODE[doc];
}
/**
 * Checks if a trust level is at or above a minimum threshold.
 */
export function isTrustLevelAtOrAbove(level, minimum) {
    // Normalize to code levels for comparison
    const normalizedLevel = typeof level === "string" && level in TRUST_LEVEL_TO_DOC
        ? TRUST_LEVEL_TO_CODE[level]
        : level;
    const normalizedMinimum = typeof minimum === "string" && minimum in TRUST_LEVEL_TO_DOC
        ? TRUST_LEVEL_TO_CODE[minimum]
        : minimum;
    const order = ["untrusted", "external", "trusted"];
    return order.indexOf(normalizedLevel) >= order.indexOf(normalizedMinimum);
}
// ─────────────────────────────────────────────────────────────────
// Memory Layer Mapping
// ─────────────────────────────────────────────────────────────────
/**
 * Memory layers as defined in the documentation.
 */
export const DocMemoryLayerSchema = z.enum(["working", "episodic", "semantic"]);
/**
 * Memory layers as used in the code implementation.
 */
export const CodeMemoryLayerSchema = z.enum(["layer_3", "layer_4", "layer_5"]);
/**
 * Mapping from code memory layers to documentation memory layers.
 * - layer_3 → working (short-term, operational)
 * - layer_4 → episodic (medium-term, consolidated)
 * - layer_5 → semantic (long-term, summarized)
 */
export const MEMORY_LAYER_TO_DOC = {
    layer_3: "working",
    layer_4: "episodic",
    layer_5: "semantic",
};
/**
 * Mapping from documentation memory layers to code memory layers.
 */
export const MEMORY_LAYER_TO_CODE = {
    working: "layer_3",
    episodic: "layer_4",
    semantic: "layer_5",
};
/**
 * Converts a code memory layer to documentation memory layer.
 */
export function toDocMemoryLayer(code) {
    return MEMORY_LAYER_TO_DOC[code];
}
/**
 * Converts a documentation memory layer to code memory layer.
 */
export function toCodeMemoryLayer(doc) {
    return MEMORY_LAYER_TO_CODE[doc];
}
/**
 * Checks if a memory layer is at or above a minimum tier.
 */
export function isMemoryLayerAtOrAbove(layer, minimum) {
    // Normalize to code layers for comparison
    const normalizedLayer = typeof layer === "string" && layer in MEMORY_LAYER_TO_DOC
        ? MEMORY_LAYER_TO_CODE[layer]
        : layer;
    const normalizedMinimum = typeof minimum === "string" && minimum in MEMORY_LAYER_TO_DOC
        ? MEMORY_LAYER_TO_CODE[minimum]
        : minimum;
    const order = ["layer_3", "layer_4", "layer_5"];
    return order.indexOf(normalizedLayer) >= order.indexOf(normalizedMinimum);
}
/**
 * Gets a human-readable description of a memory layer.
 */
export function getMemoryLayerDescription(layer) {
    switch (layer) {
        case "working":
            return "Short-term operational memories for current task execution";
        case "episodic":
            return "Medium-term consolidated memories from completed episodes";
        case "semantic":
            return "Long-term summarized knowledge extracted from experience";
    }
}
/**
 * Gets a human-readable description of a trust level.
 */
export function getTrustLevelDescription(level) {
    switch (level) {
        case "verified":
            return "High-confidence source, approved for use in responses";
        case "unverified":
            return "External source, not yet verified for accuracy";
        case "deprecated":
            return "Known unreliable source, should not be used";
    }
}
//# sourceMappingURL=knowledge-naming-mapper.js.map