import { type SandboxPolicy } from "../../control-plane/iam/sandbox-policy.js";
/**
 * Categories of storage that can be quota-managed.
 */
export type StorageQuotaCategoryId = "artifact" | "debug" | "backup";
/**
 * Configuration for a storage quota category.
 */
export interface StorageQuotaCategoryConfig {
    categoryId: StorageQuotaCategoryId;
    /** Root directories for this category */
    roots: readonly string[];
    /** Maximum bytes allowed (null for unlimited) */
    maxBytes: number | null;
    /** Whether cleanup is enabled when over quota */
    cleanupEnabled: boolean;
    /** Paths that should never be cleaned up */
    pinnedPaths?: readonly string[];
}
/**
 * Report for a storage quota category showing current usage.
 */
export interface StorageQuotaCategoryReport {
    categoryId: StorageQuotaCategoryId;
    roots: string[];
    maxBytes: number | null;
    totalBytes: number;
    fileCount: number;
    pinnedFileCount: number;
    overQuotaBytes: number;
    overQuota: boolean;
    cleanupEnabled: boolean;
}
/**
 * Result of enforcing quota for a category, including removed files.
 */
export interface StorageQuotaEnforcementCategoryResult extends StorageQuotaCategoryReport {
    removedFiles: Array<{
        path: string;
        sizeBytes: number;
    }>;
    removedBytes: number;
}
/**
 * Overall quota enforcement report across all categories.
 */
export interface StorageQuotaEnforcementReport {
    generatedAt: string;
    categories: StorageQuotaEnforcementCategoryResult[];
}
/**
 * Options for creating a StorageQuotaService.
 */
export interface StorageQuotaServiceOptions {
    /** Sandbox policy for path validation */
    sandboxPolicy?: SandboxPolicy;
    /** Category configurations (defaults to standard categories) */
    categories?: readonly StorageQuotaCategoryConfig[];
}
/**
 * StorageQuotaService manages disk usage quotas for various storage categories.
 *
 * This service:
 * - Scans configured directories to calculate storage usage
 * - Enforces quotas by removing oldest unpinned files when over limit
 * - Provides reports on storage usage and enforcement actions
 */
export declare class StorageQuotaService {
    private readonly sandboxPolicy;
    private readonly categories;
    constructor(options?: StorageQuotaServiceOptions);
    /**
     * Enforces quotas across all configured categories.
     * Removes oldest unpinned files when over quota (if cleanup is enabled).
     * @returns A report of enforcement actions taken
     */
    enforce(): StorageQuotaEnforcementReport;
    /**
     * Enforces quota for a single category.
     * @param category - The category configuration
     * @returns The enforcement result including any files removed
     */
    private enforceCategory;
    /**
     * Collects all files in a category's configured roots.
     * @param category - The category to collect files for
     * @returns Array of file records with metadata
     */
    private collectFiles;
    /**
     * Recursively walks a directory to collect files.
     * @param currentPath - Current directory being walked
     * @param policy - Sandbox policy to validate paths against
     * @param pinnedPaths - Paths that should be marked as pinned
     * @param files - Array to accumulate file records
     */
    private walkDirectory;
    /**
     * Creates a file record from a path.
     * @param path - The file path
     * @param pinnedPaths - Paths that should be marked as pinned
     * @returns A file record with metadata
     */
    private toFileRecord;
    /**
     * Resolves a declared path against the sandbox policy.
     * @param inputPath - The path to resolve
     * @returns The normalized, sandbox-approved path
     */
    private resolveDeclaredPath;
}
