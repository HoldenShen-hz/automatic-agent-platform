import { existsSync, lstatSync, readdirSync, rmSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

import { checkSandboxPath, createWorkspaceWritePolicy, type SandboxPolicy } from "../../control-plane/iam/sandbox-policy.js";
import { SandboxError } from "../../contracts/errors.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ service: "storage-quota-service" });

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
 * Internal record for tracking file information during quota enforcement.
 */
interface StorageQuotaFileRecord {
  path: string;
  sizeBytes: number;
  modifiedAtMs: number;
  pinned: boolean;
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
 * Returns the default storage quota categories.
 * These define artifact storage, debug evidence, and backup storage limits.
 */
function defaultCategories(): StorageQuotaCategoryConfig[] {
  return [
    {
      categoryId: "artifact",
      roots: [join(process.cwd(), "data", "artifacts")],
      maxBytes: 250 * 1024 * 1024,
      cleanupEnabled: true,
      pinnedPaths: [],
    },
    {
      categoryId: "debug",
      roots: [join(process.cwd(), "data", "stable-evidence"), join(process.cwd(), "data", "debug")],
      maxBytes: 150 * 1024 * 1024,
      cleanupEnabled: true,
      pinnedPaths: [],
    },
    {
      categoryId: "backup",
      roots: [join(process.cwd(), "data", "sqlite"), join(process.cwd(), "data", "backups")],
      maxBytes: 200 * 1024 * 1024,
      cleanupEnabled: true,
      pinnedPaths: [],
    },
  ];
}

/**
 * StorageQuotaService manages disk usage quotas for various storage categories.
 *
 * This service:
 * - Scans configured directories to calculate storage usage
 * - Enforces quotas by removing oldest unpinned files when over limit
 * - Provides reports on storage usage and enforcement actions
 */
export class StorageQuotaService {
  private readonly sandboxPolicy: SandboxPolicy;
  private readonly categories: readonly StorageQuotaCategoryConfig[];

  public constructor(options: StorageQuotaServiceOptions = {}) {
    this.sandboxPolicy = options.sandboxPolicy ?? createWorkspaceWritePolicy(process.cwd());
    this.categories = options.categories ?? defaultCategories();
  }

  /**
   * Enforces quotas across all configured categories.
   * Removes oldest unpinned files when over quota (if cleanup is enabled).
   * @returns A report of enforcement actions taken
   */
  public enforce(): StorageQuotaEnforcementReport {
    return {
      generatedAt: new Date().toISOString(),
      categories: this.categories.map((category) => this.enforceCategory(category)),
    };
  }

  /**
   * Enforces quota for a single category.
   * @param category - The category configuration
   * @returns The enforcement result including any files removed
   */
  private enforceCategory(category: StorageQuotaCategoryConfig): StorageQuotaEnforcementCategoryResult {
    const initialRecords = this.collectFiles(category);
    let totalBytes = initialRecords.reduce((sum, record) => sum + record.sizeBytes, 0);
    const removedFiles: Array<{ path: string; sizeBytes: number }> = [];

    // Clean up oldest unpinned files if over quota
    if (category.cleanupEnabled && category.maxBytes != null && totalBytes > category.maxBytes) {
      for (const record of initialRecords
        .filter((item) => !item.pinned)
        .sort((left, right) => left.modifiedAtMs - right.modifiedAtMs)) {
        if (totalBytes <= category.maxBytes) {
          break;
        }

        try {
          rmSync(record.path, { force: true });
        } catch (err) {
          logger.warn("session_dual_storage.cleanup.rm_failed", {
            path: record.path,
            error: err instanceof Error ? err.message : String(err),
          });
          continue;
        }
        totalBytes -= record.sizeBytes;
        removedFiles.push({
          path: record.path,
          sizeBytes: record.sizeBytes,
        });
      }
    }

    const finalRecords = this.collectFiles(category);
    const summary = summarizeCategory(category, finalRecords);
    return {
      ...summary,
      removedFiles,
      removedBytes: removedFiles.reduce((sum, record) => sum + record.sizeBytes, 0),
    };
  }

  /**
   * Collects all files in a category's configured roots.
   * @param category - The category to collect files for
   * @returns Array of file records with metadata
   */
  private collectFiles(category: StorageQuotaCategoryConfig): StorageQuotaFileRecord[] {
    const files: StorageQuotaFileRecord[] = [];
    const pinnedPaths = (category.pinnedPaths ?? []).map((path) => this.resolveDeclaredPath(path));

    for (const root of category.roots) {
      if (!existsSync(root)) {
        this.resolveDeclaredPath(root);
        continue;
      }

      const declaredRootStats = lstatSync(root);
      if (declaredRootStats.isSymbolicLink()) {
        continue;
      }

      const normalizedRoot = this.resolveDeclaredPath(root);
      if (!existsSync(normalizedRoot)) {
        continue;
      }

      const rootStat = lstatSync(normalizedRoot);
      if (rootStat.isFile()) {
        files.push(this.toFileRecord(normalizedRoot, pinnedPaths));
        continue;
      }

      if (!rootStat.isDirectory()) {
        continue;
      }

      // Create a restricted policy for walking this directory
      const effectivePolicy: SandboxPolicy = {
        ...this.sandboxPolicy,
        allowedRoots: [normalizedRoot],
      };
      this.walkDirectory(normalizedRoot, effectivePolicy, pinnedPaths, files);
    }

    return files;
  }

  /**
   * Recursively walks a directory to collect files.
   * @param currentPath - Current directory being walked
   * @param policy - Sandbox policy to validate paths against
   * @param pinnedPaths - Paths that should be marked as pinned
   * @param files - Array to accumulate file records
   */
  private walkDirectory(
    currentPath: string,
    policy: SandboxPolicy,
    pinnedPaths: readonly string[],
    files: StorageQuotaFileRecord[],
  ): void {
    for (const entry of readdirSync(currentPath, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const entryPath = join(currentPath, entry.name);
      const check = checkSandboxPath(policy, entryPath);
      if (!check.allowed) {
        const errorCode = check.reasonCode === "sandbox.path_outside_allowed_roots" ? check.reasonCode : "storage_quota.path_denied";
        throw new SandboxError(errorCode, `${errorCode}: Path access denied: ${entryPath}`, {
          details: { path: entryPath, reasonCode: check.reasonCode },
        });
      }

      if (entry.isDirectory()) {
        this.walkDirectory(check.normalizedPath, policy, pinnedPaths, files);
      } else if (entry.isFile()) {
        files.push(this.toFileRecord(check.normalizedPath, pinnedPaths));
      }
    }
  }

  /**
   * Creates a file record from a path.
   * @param path - The file path
   * @param pinnedPaths - Paths that should be marked as pinned
   * @returns A file record with metadata
   */
  private toFileRecord(path: string, pinnedPaths: readonly string[]): StorageQuotaFileRecord {
    const stats = statSync(path);
    return {
      path,
      sizeBytes: stats.size,
      modifiedAtMs: stats.mtimeMs,
      pinned: pinnedPaths.some((pinnedPath) => path === pinnedPath || path.startsWith(`${pinnedPath}/`)),
    };
  }

  /**
   * Resolves a declared path against the sandbox policy.
   * @param inputPath - The path to resolve
   * @returns The normalized, sandbox-approved path
   */
  private resolveDeclaredPath(inputPath: string): string {
    if (existsSync(inputPath)) {
      const check = checkSandboxPath(this.sandboxPolicy, inputPath);
      if (!check.allowed) {
        const errorCode = check.reasonCode === "sandbox.path_outside_allowed_roots" ? check.reasonCode : "storage_quota.path_denied";
        throw new SandboxError(errorCode, `${errorCode}: Path access denied: ${inputPath}`, {
          details: { path: inputPath, reasonCode: check.reasonCode },
        });
      }
      return check.normalizedPath;
    }

    // Path doesn't exist yet - find the nearest existing ancestor and verify it's allowed
    let currentPath = inputPath;
    while (!existsSync(currentPath)) {
      const parent = dirname(currentPath);
      if (parent === currentPath) {
        // Reached root without finding an existing directory
        throw new SandboxError("storage_quota.path_denied", `No existing ancestor found for path: ${inputPath}`, {
          details: { path: inputPath },
        });
      }
      currentPath = parent;
    }

    // Found existing ancestor at currentPath, verify it's allowed
    const check = checkSandboxPath(this.sandboxPolicy, currentPath);
    if (!check.allowed) {
      const errorCode = check.reasonCode === "sandbox.path_outside_allowed_roots" ? check.reasonCode : "storage_quota.path_denied";
      throw new SandboxError(errorCode, `${errorCode}: Path access denied: ${currentPath}`, {
        details: { path: currentPath, reasonCode: check.reasonCode },
      });
    }

    // Construct the full path by appending the non-existent segments
    // remainingPath is the portion of inputPath that doesn't exist
    const remainingPath = inputPath.slice(currentPath.length);
    // Remove leading separators from remaining path
    const cleanRemaining = remainingPath.replace(/^[\/\\]+/, "");
    return join(check.normalizedPath, cleanRemaining);
  }
}

/**
 * Creates a summary report for a category.
 * @param category - The category configuration
 * @param records - File records to summarize
 * @returns A category report
 */
function summarizeCategory(
  category: StorageQuotaCategoryConfig,
  records: readonly StorageQuotaFileRecord[],
): StorageQuotaCategoryReport {
  const totalBytes = records.reduce((sum, record) => sum + record.sizeBytes, 0);
  const overQuotaBytes = category.maxBytes == null ? 0 : Math.max(0, totalBytes - category.maxBytes);
  return {
    categoryId: category.categoryId,
    roots: [...category.roots],
    maxBytes: category.maxBytes,
    totalBytes,
    fileCount: records.length,
    pinnedFileCount: records.filter((record) => record.pinned).length,
    overQuotaBytes,
    overQuota: overQuotaBytes > 0,
    cleanupEnabled: category.cleanupEnabled,
  };
}
