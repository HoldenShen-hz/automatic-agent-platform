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
 * - `danger_full_access`: All operations allowed (use with caution)
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
/**
 * Sandbox operating mode determining what operations are permitted.
 * - read_only: No write operations allowed
 * - workspace_write: Write allowed only within the workspace boundary
 * - danger_full_access: All operations allowed (use with extreme caution)
 */
export type SandboxMode = "read_only" | "workspace_write" | "danger_full_access";
/**
 * Policy for handling symbolic links within sandbox roots.
 * - deny: Symlinks are blocked entirely
 * - allow_explicit: Symlinks allowed only if explicitly configured
 */
export type SymlinkPolicy = "deny" | "allow_explicit";
/**
 * Process execution rule mode.
 * - allow: Process execution is permitted by default
 * - deny: Process execution is blocked by default
 */
export type ProcessRuleMode = "allow" | "deny";
/**
 * Complete sandbox policy configuration defining access boundaries for tool execution.
 * This policy is evaluated before any file system operations are permitted.
 */
export interface SandboxPolicy {
    /** Unique identifier for this policy instance */
    policyId: string;
    /** Operating mode controlling overall access level */
    mode: SandboxMode;
    /** Directory roots where operations are permitted */
    allowedRoots: readonly string[];
    /** Directory roots where operations are explicitly denied */
    deniedRoots: readonly string[];
    /** Whether to enforce realpath resolution (prevents symlink escapes) */
    realpathEnforced: boolean;
    /** Policy for handling symbolic links within allowed roots */
    symlinkPolicy: SymlinkPolicy;
    /** Default rule for process execution */
    processRuleMode: ProcessRuleMode;
}
/**
 * Result of checking a path against the sandbox policy.
 * Contains the normalized path and whether access is permitted.
 */
export interface SandboxPathCheckResult {
    /** Whether the path access is permitted under the policy */
    allowed: boolean;
    /** Canonical path after normalization (resolves symlinks, relative paths) */
    normalizedPath: string;
    /** Error code if access was denied, null if allowed */
    reasonCode: string | null;
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
export declare function resolveSandboxPath(inputPath: string, enforceRealpath: boolean): string;
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
export declare function checkSandboxPath(policy: SandboxPolicy, inputPath: string): SandboxPathCheckResult;
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
export declare function createWorkspaceWritePolicy(workspaceRoot: string): SandboxPolicy;
