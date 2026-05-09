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
 * Sandbox operating mode determining what operations are permitted.
 * - read_only: No write operations allowed
 * - workspace_write: Write allowed only within the workspace boundary
 * - scoped_external_access: Workspace sandbox with explicit outbound access allowances
 * - restricted_exec: Execution is constrained by executor policy rather than broad path roots
 */
export type SandboxMode = "read_only" | "workspace_write" | "scoped_external_access" | "restricted_exec";
export type SandboxModeLike = SandboxMode | string;

const SANDBOX_MODE_ALIASES = {
  none: "read_only",
  process: "read_only",
  container: "workspace_write",
  scoped_external_access: "scoped_external_access",
  read_only: "read_only",
  workspace_write: "workspace_write",
  restricted_exec: "restricted_exec",
} as const satisfies Record<string, SandboxMode>;

export function normalizeSandboxMode(mode: SandboxModeLike | null | undefined): SandboxMode {
  if (mode == null) {
    return "read_only";
  }
  return SANDBOX_MODE_ALIASES[mode as keyof typeof SANDBOX_MODE_ALIASES] ?? "read_only";
}

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

  /** R12-15: Time limit for command execution in milliseconds (0 = no limit) */
  timeLimitMs: number;

  /** R12-15: Memory limit for command execution in bytes (0 = no limit) */
  memoryLimitBytes: number;

  /** R12-15: CPU limit as a fraction of available cores (0 = no limit) */
  cpuLimitFraction: number;
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
 * Normalizes a root directory path by resolving symlinks and ensuring trailing separator.
 * Canonicalization failures are logged but do not block the operation - the unresolved
 * path is used as a fallback to maintain availability at the cost of some security.
 *
 * @param path - The root path to normalize
 * @param canonicalize - Whether to resolve symlinks via realpathSync
 * @returns Normalized path with trailing directory separator
 */
function normalizeRoot(path: string, canonicalize: boolean): string {
  let resolved = resolve(path);
  if (canonicalize) {
    try {
      resolved = realpathSync(resolved);
    } catch (err) {
      // SEC-01/N01: Fail closed on canonicalization errors. Previously this
      // silently fell through with the unresolved path, which let symlinks
      // that realpath could not resolve bypass the prefix check. ENOENT is
      // treated as "non-existent" and still logged but allowed to fall
      // through (new paths under an allowed root), while permission errors
      // (EACCES/EPERM) and any other unexpected failure throw.
      const errorCode = (err as NodeJS.ErrnoException).code;
      if (errorCode === "ENOENT") {
        // Walk up the directory tree to find the nearest existing parent
        const remainder: string[] = [];
        let current = resolved;
        while (!existsSync(current)) {
          const parent = dirname(current);
          if (parent === current) {
            // Reached filesystem root, can't go higher
            break;
          }
          remainder.unshift(relative(parent, current));
          current = parent;
        }
        if (existsSync(current)) {
          resolved = resolve(realpathSync(current), ...remainder);
        }
        sandboxLogger.log({
          level: "warn",
          message: "realpathSync failed in sandbox path normalization, used nearest existing parent",
          data: {
            originalPath: path,
            resolvedPath: resolved,
            error: err instanceof Error ? err.message : String(err),
            errorCode,
          },
        });
      } else {
        sandboxLogger.log({
          level: "error",
          message: "realpathSync failed in sandbox path normalization",
          data: {
            path: resolved,
            error: err instanceof Error ? err.message : String(err),
            errorCode,
          },
        });
        throw new Error(`sandbox.path_canonicalization_failed:${resolved}`);
      }
    }
  }
  return resolved.endsWith(sep) ? resolved : `${resolved}${sep}`;
}

function normalizeSandboxInputPath(inputPath: string): string {
  const normalizedUnicode = inputPath.normalize("NFKC");
  try {
    return decodeURIComponent(normalizedUnicode);
  } catch {
    return normalizedUnicode;
  }
}

/**
 * Checks if a path is at or within a root directory.
 * Compares the path against the root (with trailing separator removed for exact match).
 *
 * @param path - The path to check
 * @param root - The root directory (should have trailing separator)
 * @returns true if path equals root or starts with root prefix
 */
function isWithinRoot(path: string, root: string): boolean {
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
function containsPathTraversalOutside(path: string, roots: readonly string[]): boolean {
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
function containsSymlinkWithinRoot(resolvedPath: string, root: string): boolean {
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
    } catch (err) {
      // SEC-02: Fail closed on lstat failures other than ENOENT. A permission
      // error on a segment could mask a symlink we cannot see, so we report
      // "symlink found" (true) to deny the path. ENOENT means the path does
      // not exist yet and therefore cannot contain a symlink, so we allow
      // the loop to continue returning false.
      const errorCode = (err as NodeJS.ErrnoException).code;
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
export function resolveSandboxPath(inputPath: string, enforceRealpath: boolean): string {
  const resolved = resolve(inputPath);
  if (!enforceRealpath) {
    return resolved;
  }
  try {
    return realpathSync(resolved);
  } catch (err) {
    // realpathSync fails with ENOENT when the path doesn't exist yet.
    // Canonicalize the nearest existing parent so newly-created leaf paths
    // still compare against canonical allowed roots (for example /var -> /private/var).
    const errorCode = (err as NodeJS.ErrnoException).code;
    if (errorCode === "ENOENT") {
      const remainder: string[] = [];
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
export function checkSandboxPath(policy: SandboxPolicy, inputPath: string): SandboxPathCheckResult {
  const normalizedInput = normalizeSandboxInputPath(inputPath);
  if (normalizedInput.includes("\0")) {
    return {
      allowed: false,
      normalizedPath: normalizedInput,
      reasonCode: "sandbox.path_invalid_encoding",
    };
  }

  const resolvedInputPath = resolve(normalizedInput);
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

  // Second check: Is path outside allowed roots?
  // R12-14: Path boundary checks are enforced in ALL modes including restricted_exec.
  // The executor policy must not bypass fundamental path containment.
  if (containsPathTraversalOutside(resolvedInputPath, rawAllowedRoots)) {
    return {
      allowed: false,
      normalizedPath: resolvedInputPath,
      reasonCode: "sandbox.path_outside_allowed_roots",
    };
  }

  // Third check: Does path contain symlinks that could escape root?
  if (
    policy.symlinkPolicy === "deny" &&
    rawAllowedRoots.some((root) => containsSymlinkWithinRoot(resolvedInputPath, root))
  ) {
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
      normalizedPath = resolveSandboxPath(normalizedInput, true);
    } catch (error) {
      return {
        allowed: false,
        normalizedPath: resolvedInputPath,
        reasonCode: `sandbox.path_unresolvable:${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  const effectiveDeniedRoots = policy.realpathEnforced ? canonicalDeniedRoots : rawDeniedRoots;
  const effectiveAllowedRoots = policy.realpathEnforced ? canonicalAllowedRoots : rawAllowedRoots;

  // Fifth check: Is resolved path within denied roots?
  if (effectiveDeniedRoots.some((root) => isWithinRoot(normalizedPath, root))) {
    return {
      allowed: false,
      normalizedPath,
      reasonCode: "sandbox.path_in_denied_root",
    };
  }

  // Sixth check: Is resolved path outside allowed roots?
  // R12-14: Path boundary checks are enforced in ALL modes including restricted_exec.
  if (
    containsPathTraversalOutside(normalizedPath, effectiveAllowedRoots)
  ) {
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
export function createWorkspaceWritePolicy(workspaceRoot: string): SandboxPolicy {
  return {
    policyId: "workspace_write",
    mode: "workspace_write",
    allowedRoots: [workspaceRoot],
    deniedRoots: [],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    timeLimitMs: 300_000,   // R12-15: 5 minutes default
    memoryLimitBytes: 512 * 1024 * 1024,  // R12-15: 512MB default
    cpuLimitFraction: 0.5,  // R12-15: 50% of available cores default
  };
}

export function createReadOnlyPolicy(workspaceRoot: string): SandboxPolicy {
  return {
    policyId: "read_only",
    mode: "read_only",
    allowedRoots: [workspaceRoot],
    deniedRoots: [],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    timeLimitMs: 60_000,    // R12-15: 1 minute for read-only
    memoryLimitBytes: 256 * 1024 * 1024,  // R12-15: 256MB for read-only
    cpuLimitFraction: 0.25, // R12-15: 25% for read-only
  };
}

export function createScopedExternalAccessPolicy(workspaceRoot: string): SandboxPolicy {
  return {
    policyId: "scoped_external_access",
    mode: "scoped_external_access",
    allowedRoots: [workspaceRoot],
    deniedRoots: [],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    timeLimitMs: 300_000,   // R12-15: 5 minutes
    memoryLimitBytes: 512 * 1024 * 1024,  // R12-15: 512MB
    cpuLimitFraction: 0.5,  // R12-15: 50%
  };
}

export function createRestrictedExecPolicy(workspaceRoot: string): SandboxPolicy {
  return {
    policyId: "restricted_exec",
    mode: "restricted_exec",
    allowedRoots: [workspaceRoot],
    deniedRoots: [],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "allow",
    timeLimitMs: 60_000,    // R12-15: 1 minute for restricted exec
    memoryLimitBytes: 128 * 1024 * 1024,  // R12-15: 128MB for restricted exec
    cpuLimitFraction: 0.25, // R12-15: 25% for restricted exec
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
export function createConfigReadPolicy(configRoot: string): SandboxPolicy {
  return {
    policyId: "config_read",
    mode: "read_only",
    allowedRoots: [configRoot],
    deniedRoots: [],
    realpathEnforced: true,
    symlinkPolicy: "deny",
    processRuleMode: "deny",
    timeLimitMs: 30_000,    // R12-15: 30 seconds for config read
    memoryLimitBytes: 64 * 1024 * 1024,  // R12-15: 64MB for config read
    cpuLimitFraction: 0.1,  // R12-15: 10% for config read
  };
}
