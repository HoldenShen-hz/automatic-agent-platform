/**
 * Tool Path Scope Validation
 *
 * Provides path access control for tool executions.
 * Ensures tools can only access files within explicitly declared path roots.
 *
 * This is a secondary access control layer on top of sandbox policy.
 * While sandbox policy determines if a path is accessible at all,
 * path scope determines if it falls within the execution's declared boundaries.
 */

import { lstatSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const toolPathScopeLogger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Result of checking if a path is within the allowed scope.
 */
export interface ToolPathScopeCheckResult {
  /** Whether the path is within scope */
  allowed: boolean;

  /** Canonical path after normalization */
  normalizedPath: string;

  /** Reason code if denied, null if allowed */
  reasonCode: string | null;
}

/**
 * Normalizes a path by resolving symlinks via realpath.
 * Rejects paths where realpath fails - symlinks cannot be safely canonicalized.
 */
function normalizePath(path: string): string {
  const resolvedPath = resolve(path);
  try {
    return realpathSync.native(resolvedPath);
  } catch (err) {
    try {
      if (lstatSync(resolvedPath).isSymbolicLink()) {
        throw err;
      }
    } catch (statErr) {
      const code = typeof statErr === "object" && statErr != null && "code" in statErr
        ? (statErr as { code?: unknown }).code
        : null;
      if (code !== "ENOENT") {
        throw err;
      }
    }
    return resolvedPath;
  }
}

/**
 * Normalizes a root path (directory) by ensuring it ends with a separator.
 */
function normalizeRoot(path: string): string {
  const normalized = normalizePath(path);
  return normalized.endsWith(sep) ? normalized : `${normalized}${sep}`;
}

/**
 * Checks if a path is at or within a root directory.
 */
function isWithinRoot(path: string, root: string): boolean {
  return path === root.slice(0, -1) || path.startsWith(root);
}

/**
 * Normalizes an array of path root strings.
 * Removes empty values, normalizes each path, and deduplicates.
 */
export function normalizeToolPathScopeRoots(roots: readonly string[] | null | undefined): string[] {
  const normalizedRoots = (roots ?? [])
    .map((root) => root.trim())
    .filter((root) => root.length > 0)
    .map((root) => normalizeRoot(root));
  return [...new Set(normalizedRoots)];
}

/**
 * Checks if any path scope restrictions are in effect.
 */
export function hasToolPathScopeRestrictions(roots: readonly string[] | null | undefined): boolean {
  return normalizeToolPathScopeRoots(roots).length > 0;
}

/**
 * Checks if a path is within the allowed path scope.
 *
 * @param inputPath - The path to check
 * @param roots - The allowed path roots (null/empty means allow all)
 * @returns Result indicating if the path is allowed and the normalized path
 */
export function checkToolPathScope(
  inputPath: string,
  roots: readonly string[] | null | undefined,
): ToolPathScopeCheckResult {
  const normalizedRoots = normalizeToolPathScopeRoots(roots);
  if (normalizedRoots.length === 0) {
    return {
      allowed: true,
      normalizedPath: resolve(inputPath),
      reasonCode: null,
    };
  }

  let normalizedPath: string;
  try {
    normalizedPath = normalizePath(inputPath);
  } catch (err) {
    // R32-02 fix: If we cannot canonicalize the path (e.g., broken symlink), deny access.
    return {
      allowed: false,
      normalizedPath: inputPath,
      reasonCode: "tool.path_scope_denied",
    };
  }

  // Check if path is under any allowed root
  if (normalizedRoots.some((root) => isWithinRoot(normalizedPath, root))) {
    return {
      allowed: true,
      normalizedPath,
      reasonCode: null,
    };
  }

  // Path is outside allowed scope
  return {
    allowed: false,
    normalizedPath,
    reasonCode: "tool.path_scope_denied",
  };
}
