/**
 * @fileoverview Domain Types - Core type definitions barrel file.
 *
 * This file re-exports all domain types from the domain/ subdirectory
 * for backward compatibility with existing imports from "../types/domain.js".
 *
 * The domain types have been split into focused modules within domain/.
 * See src/core/types/domain/index.ts for the full barrel re-export.
 */
export * from "./domain/index.js";
