/**
 * Version Management Module
 *
 * Provides semantic versioning enforcement and version compatibility matrix
 * for pack version management.
 *
 * Architecture: §57 Version Management
 * @see docs_zh/architecture/00-platform-architecture.md §57
 */
export { SemverValidator, createSemverValidator } from "./semver-validator.js";
export type { Semver, ParsedVersion, InvalidVersion, VersionParseResult, ComparisonResult } from "./semver-validator.js";
export { VersionCompatibilityMatrix, createDefaultCompatibilityMatrix } from "./version-compatibility-matrix.js";
export type { CompatibilityLevel, VersionCompatibilityEntry, CompatibilityCheckResult, PackVersion, CompatibilityMatrixConfig, } from "./version-compatibility-matrix.js";
