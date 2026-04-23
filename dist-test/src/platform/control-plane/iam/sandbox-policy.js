/**
 * Sandbox Policy - Path validation and security enforcement for tool execution.
 *
 * ## Overview
 *
 * Provides path validation against allowed roots, symlink traversal detection,
 * and sandbox enforcement for the tool execution system.
 *
 * ## Key Concepts
 *
 * - **Sandbox**: Execution isolation boundary
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: sandbox}
 *
 * - **Exec Policy**: Ruleset for tool/command execution
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: exec policy}
 *
 * ## Sandbox Modes
 *
 * - `read_only`: Only read operations allowed
 * - `workspace_write`: Write allowed only within designated workspace
 * - `scoped_external_access`: Workspace sandbox plus explicit outbound access contract
 * - `restricted_exec`: Executor-restricted mode for tightly controlled execution runtimes
 *
 * ## Security Features
 *
 * - Realpath enforcement to prevent symlink traversal attacks
 * - Symlink detection within sandbox roots
 * - Path traversal detection outside allowed boundaries
 * - Explicit deny patterns for sensitive paths
 *
 * @see Sandbox Contract: docs_zh/contracts/sandbox_contract.md
 * @see Security Contract: docs_zh/contracts/security_contract.md
 * @see Glossary: docs_zh/governance/glossary_and_terminology.md
 */
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
const sandboxLogger = new StructuredLogger({ retentionLimit: 100 });
/**
 * Normalizes a root directory path by resolving symlinks and ensuring trailing separator.
 * Canonicalization failures are logged but do not block the operation - the unresolved
 * path is used as a fallback to maintain availability at the cost of some security.
 *
 * @param path - The root path to normalize
 * @param canonicalize - Whether to resolve symlinks via realpathSync
 * @returns Normalized path with trailing directory separator
 */
function normalizeRoot(path, canonicalize) {
    let resolved = resolve(path);
    if (canonicalize) {
        try {
            resolved = realpathSync(resolved);
        }
        catch (err) {
            // SEC-01/N01: Fail closed on canonicalization errors. Previously this
            // silently fell through with the unresolved path, which let symlinks
            // that realpath could not resolve bypass the prefix check. ENOENT is
            // treated as "non-existent" and still logged but allowed to fall
            // through (new paths under an allowed root), while permission errors
            // (EACCES/EPERM) and any other unexpected failure throw.
            const errorCode = err.code;
            sandboxLogger.log({
                level: errorCode === "ENOENT" ? "warn" : "error",
                message: "realpathSync failed in sandbox path normalization",
                data: {
                    path: resolved,
                    error: err instanceof Error ? err.message : String(err),
                    errorCode,
                },
            });
            if (errorCode !== "ENOENT") {
                throw new Error(`sandbox.path_canonicalization_failed:${resolved}`);
            }
        }
    }
    return resolved.endsWith(sep) ? resolved : `${resolved}${sep}`;
}
/**
 * Checks if a path is at or within a root directory.
 * Compares the path against the root (with trailing separator removed for exact match).
 *
 * @param path - The path to check
 * @param root - The root directory (should have trailing separator)
 * @returns true if path equals root or starts with root prefix
 */
function isWithinRoot(path, root) {
    return path === root.slice(0, -1) || path.startsWith(root);
}
/**
 * Determines if a path traverses outside all allowed roots.
 * Used to detect path traversal attacks (e.g., ../../../etc/passwd).
 *
 * @param path - The path to check
 * @param roots - The allowed root directories
 * @returns true if path is not contained within any root
 */
function containsPathTraversalOutside(path, roots) {
    return !roots.some((root) => isWithinRoot(path, root));
}
/**
 * Detects if any symbolic link exists along the path from root to the target.
 * This prevents using symlinks to escape sandbox boundaries.
 *
 * @param resolvedPath - The fully resolved target path
 * @param root - The sandbox root to check within
 * @returns true if a symlink was found in the path traversal
 */
function containsSymlinkWithinRoot(resolvedPath, root) {
    const rel = relative(root.slice(0, -1), resolvedPath);
    if (rel.startsWith("..") || rel === "") {
        return false;
    }
    const segments = rel.split(sep).filter(Boolean);
    let current = root.slice(0, -1);
    for (const segment of segments) {
        current = resolve(current, segment);
        try {
            if (lstatSync(current).isSymbolicLink()) {
                return true;
            }
        }
        catch (err) {
            // SEC-02: Fail closed on lstat failures other than ENOENT. A permission
            // error on a segment could mask a symlink we cannot see, so we report
            // "symlink found" (true) to deny the path. ENOENT means the path does
            // not exist yet and therefore cannot contain a symlink, so we allow
            // the loop to continue returning false.
            const errorCode = err.code;
            sandboxLogger.log({
                level: errorCode === "ENOENT" ? "warn" : "error",
                message: "lstatSync failed in symlink traversal check",
                data: {
                    current,
                    error: err instanceof Error ? err.message : String(err),
                    errorCode,
                },
            });
            return errorCode !== "ENOENT";
        }
    }
    return false;
}
/**
 * Resolves a path with optional symlink resolution.
 * Realpath resolution prevents symlink-based sandbox escapes but may fail
 * for non-existent paths or permission-denied scenarios.
 *
 * @param inputPath - The path to resolve
 * @param enforceRealpath - Whether to apply realpathSync resolution
 * @returns Resolved path string
 */
export function resolveSandboxPath(inputPath, enforceRealpath) {
    const resolved = resolve(inputPath);
    if (!enforceRealpath) {
        return resolved;
    }
    try {
        return realpathSync(resolved);
    }
    catch (err) {
        // realpathSync fails with ENOENT when the path doesn't exist yet.
        // Canonicalize the nearest existing parent so newly-created leaf paths
        // still compare against canonical allowed roots (for example /var -> /private/var).
        const errorCode = err.code;
        if (errorCode === "ENOENT") {
            const remainder = [];
            let current = resolved;
            while (!existsSync(current)) {
                const parent = dirname(current);
                if (parent === current) {
                    throw err;
                }
                remainder.unshift(relative(parent, current));
                current = parent;
            }
            return resolve(realpathSync(current), ...remainder);
        }
        // For other errors (permission denied, etc.), propagate the error
        throw err;
    }
}
/**
 * Checks if a path is permitted under the given sandbox policy.
 * This is the main entry point for sandbox path validation - called before
 * any file system operation in the tool execution pipeline.
 *
 * The check evaluates:
 * 1. Denied roots - explicit blocklist takes precedence
 * 2. Allowed roots boundary - path must be within configured roots
 * 3. Symlink traversal - prevents escape via symlinks within roots
 * 4. Realpath enforcement - resolves symlinks for consistent checking
 *
 * @param policy - The sandbox policy to evaluate against
 * @param inputPath - The path requested by the tool
 * @returns Result indicating if access is allowed and the normalized path
 */
export function checkSandboxPath(policy, inputPath) {
    const resolvedInputPath = resolve(inputPath);
    const rawDeniedRoots = policy.deniedRoots.map((root) => normalizeRoot(root, false));
    const rawAllowedRoots = policy.allowedRoots.map((root) => normalizeRoot(root, false));
    const canonicalDeniedRoots = policy.deniedRoots.map((root) => normalizeRoot(root, true));
    const canonicalAllowedRoots = policy.allowedRoots.map((root) => normalizeRoot(root, true));
    // First check: Is path within any denied root?
    if (rawDeniedRoots.some((root) => isWithinRoot(resolvedInputPath, root))) {
        return {
            allowed: false,
            normalizedPath: resolvedInputPath,
            reasonCode: "sandbox.path_in_denied_root",
        };
    }
    // Second check: Is path outside allowed roots (except for restricted_exec mode)?
    if (policy.mode !== "restricted_exec" && containsPathTraversalOutside(resolvedInputPath, rawAllowedRoots)) {
        return {
            allowed: false,
            normalizedPath: resolvedInputPath,
            reasonCode: "sandbox.path_outside_allowed_roots",
        };
    }
    // Third check: Does path contain symlinks that could escape root?
    if (policy.symlinkPolicy === "deny" &&
        rawAllowedRoots.some((root) => containsSymlinkWithinRoot(resolvedInputPath, root))) {
        return {
            allowed: false,
            normalizedPath: resolvedInputPath,
            reasonCode: "sandbox.symlink_denied",
        };
    }
    // Fourth check: Apply realpath resolution if enforced
    let normalizedPath = resolvedInputPath;
    if (policy.realpathEnforced) {
        try {
            normalizedPath = resolveSandboxPath(inputPath, true);
        }
        catch (error) {
            return {
                allowed: false,
                normalizedPath: resolvedInputPath,
                reasonCode: `sandbox.path_unresolvable:${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }
    // Fifth check: Is resolved path within denied roots?
    if (canonicalDeniedRoots.some((root) => isWithinRoot(normalizedPath, root))) {
        return {
            allowed: false,
            normalizedPath,
            reasonCode: "sandbox.path_in_denied_root",
        };
    }
    // Sixth check: Is resolved path outside allowed roots?
    if (policy.mode !== "restricted_exec" &&
        containsPathTraversalOutside(normalizedPath, canonicalAllowedRoots)) {
        return {
            allowed: false,
            normalizedPath,
            reasonCode: "sandbox.path_outside_allowed_roots",
        };
    }
    return {
        allowed: true,
        normalizedPath,
        reasonCode: null,
    };
}
/**
 * Creates a sandbox policy for workspace write operations.
 * This is the standard policy for agent tool execution - allows read/write
 * access only within the designated workspace root.
 *
 * Security properties:
 * - Realpath enforcement enabled (prevents symlink escapes)
 * - Symlinks denied (could be used to escape workspace)
 * - Process rules set to allow (controlled by separate process policy)
 *
 * @param workspaceRoot - The root directory of the workspace
 * @returns A configured SandboxPolicy for workspace operations
 */
export function createWorkspaceWritePolicy(workspaceRoot) {
    return {
        policyId: "workspace_write",
        mode: "workspace_write",
        allowedRoots: [workspaceRoot],
        deniedRoots: [],
        realpathEnforced: true,
        symlinkPolicy: "deny",
        processRuleMode: "allow",
    };
}
export function createScopedExternalAccessPolicy(workspaceRoot) {
    return {
        policyId: "scoped_external_access",
        mode: "scoped_external_access",
        allowedRoots: [workspaceRoot],
        deniedRoots: [],
        realpathEnforced: true,
        symlinkPolicy: "deny",
        processRuleMode: "allow",
    };
}
export function createRestrictedExecPolicy(workspaceRoot) {
    return {
        policyId: "restricted_exec",
        mode: "restricted_exec",
        allowedRoots: [workspaceRoot],
        deniedRoots: [],
        realpathEnforced: true,
        symlinkPolicy: "deny",
        processRuleMode: "allow",
    };
}
/**
 * Creates a sandbox policy for reading configuration files within a specific root.
 * This policy is appropriate for config loaders that need to read files from a
 * designated config directory while preventing path traversal attacks.
 *
 * Security properties:
 * - Realpath enforcement enabled (prevents symlink escapes)
 * - Symlinks denied (could be used to escape config root)
 * - Mode is read_only (only read operations allowed)
 *
 * @param configRoot - The root directory containing configuration files
 * @returns A configured SandboxPolicy for config file operations
 */
export function createConfigReadPolicy(configRoot) {
    return {
        policyId: "config_read",
        mode: "read_only",
        allowedRoots: [configRoot],
        deniedRoots: [],
        realpathEnforced: true,
        symlinkPolicy: "deny",
        processRuleMode: "deny",
    };
}
//# sourceMappingURL=sandbox-policy.js.map