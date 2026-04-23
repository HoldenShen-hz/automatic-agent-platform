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
export { VersionCompatibilityMatrix, createDefaultCompatibilityMatrix } from "./version-compatibility-matrix.js";
//# sourceMappingURL=index.js.map