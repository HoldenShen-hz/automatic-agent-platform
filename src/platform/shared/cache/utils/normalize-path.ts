/**
 * Path Normalization Utility
 *
 * Provides consistent path normalization to ensure file paths
 * produce consistent cache keys regardless of representation.
 */

import path from 'node:path';

/**
 * Normalizes a file path relative to workspace root.
 * Converts to forward slashes, resolves relative paths, and
 * replaces workspace root with /workspace virtual prefix.
 */
export function normalizePath(input: string, workspaceRoot: string): string {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  const resolved = path.resolve(resolvedWorkspaceRoot, input);
  const relativeToWorkspace = path.relative(resolvedWorkspaceRoot, resolved);
  const normalized = resolved.replace(/\\/g, '/');

  if (
    relativeToWorkspace === ""
    || (
      !relativeToWorkspace.startsWith(`..${path.sep}`)
      && relativeToWorkspace !== ".."
      && !path.isAbsolute(relativeToWorkspace)
    )
  ) {
    const normalizedRelative = relativeToWorkspace.replace(/\\/g, "/");
    return normalizedRelative === "" ? "/workspace" : `/workspace/${normalizedRelative}`;
  }

  return normalized;
}

/**
 * Checks if a path is within the workspace.
 */
export function isWithinWorkspace(filePath: string, workspaceRoot: string): boolean {
  const normalized = normalizePath(filePath, workspaceRoot);
  return normalized.startsWith('/workspace');
}

/**
 * Extracts the workspace-relative path.
 */
export function getWorkspaceRelativePath(
  absolutePath: string,
  workspaceRoot: string
): string {
  const normalized = normalizePath(absolutePath, workspaceRoot);
  if (normalized.startsWith('/workspace')) {
    return normalized.slice('/workspace'.length);
  }
  return normalized;
}
