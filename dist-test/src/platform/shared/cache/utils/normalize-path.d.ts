/**
 * Path Normalization Utility
 *
 * Provides consistent path normalization to ensure file paths
 * produce consistent cache keys regardless of representation.
 */
/**
 * Normalizes a file path relative to workspace root.
 * Converts to forward slashes, resolves relative paths, and
 * replaces workspace root with /workspace virtual prefix.
 */
export declare function normalizePath(input: string, workspaceRoot: string): string;
/**
 * Checks if a path is within the workspace.
 */
export declare function isWithinWorkspace(filePath: string, workspaceRoot: string): boolean;
/**
 * Extracts the workspace-relative path.
 */
export declare function getWorkspaceRelativePath(absolutePath: string, workspaceRoot: string): string;
