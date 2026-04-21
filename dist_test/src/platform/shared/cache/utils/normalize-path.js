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
export function normalizePath(input, workspaceRoot) {
    // Resolve to absolute path
    const resolved = path.resolve(workspaceRoot, input);
    // Normalize slashes for cross-platform consistency
    const normalized = resolved.replace(/\\/g, '/');
    // Replace workspace root with virtual path
    const normalizedRoot = workspaceRoot.replace(/\\/g, '/');
    if (normalized.startsWith(normalizedRoot)) {
        return normalized.replace(normalizedRoot, '/workspace');
    }
    return normalized;
}
/**
 * Checks if a path is within the workspace.
 */
export function isWithinWorkspace(filePath, workspaceRoot) {
    const normalized = normalizePath(filePath, workspaceRoot);
    return normalized.startsWith('/workspace');
}
/**
 * Extracts the workspace-relative path.
 */
export function getWorkspaceRelativePath(absolutePath, workspaceRoot) {
    const normalized = normalizePath(absolutePath, workspaceRoot);
    if (normalized.startsWith('/workspace')) {
        return normalized.slice('/workspace'.length);
    }
    return normalized;
}
//# sourceMappingURL=normalize-path.js.map