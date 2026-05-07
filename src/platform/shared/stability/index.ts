/**
 * Stability Module - Facade Layer
 *
 * This directory provides backward-compatible re-exports from the authoritative
 * stability module at `platform/stability/`.
 *
 * AUTHORITY: src/platform/stability/ is the canonical source for all stability
 * functionality. This shared/ facade exists solely for backward compatibility
 * with existing import paths.
 *
 * Responsibility boundaries:
 * - platform/stability/ - Contains all stability implementations, patterns, and rehearsals
 * - platform/shared/stability/ - Thin re-export facade (no implementations)
 */

export * from "../../stability/index.js";
