/**
 * Shadow Snapshot Service
 *
 * Provides workspace backup capabilities using a shadow git repository.
 * Creates point-in-time snapshots of the workspace that can be restored.
 *
 * Key features:
 * - Creates git commits in a shadow repository (separate from workspace)
 * - Excludes large directories (node_modules, .git, dist, etc.)
 * - Validates workspace paths against sandbox policy
 * - Enforces size limits to prevent snapshot bloat
 * - Supports restore to any previous snapshot
 *
 * The shadow repository is stored separately from the workspace to avoid
 * polluting the workspace itself with version control metadata.
 */

import { execFileSync } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

import { PolicyDeniedError, SandboxError, StorageError, ValidationError } from "../../contracts/errors.js";
import { checkSandboxPath, createWorkspaceWritePolicy, type SandboxPolicy } from "../../five-plane-control-plane/iam/sandbox-policy.js";

/**
 * Configuration options for the shadow snapshot service.
 */
export interface ShadowSnapshotServiceOptions {
  /** Root directory of the workspace to snapshot */
  workspaceRoot: string;

  /** Root directory where shadow git repository is stored */
  shadowRoot: string;

  /** Sandbox policy for path validation (defaults to workspace write policy) */
  sandboxPolicy?: SandboxPolicy;

  /** Maximum size in bytes for any single file/directory entry */
  maxEntryBytes?: number;

  /** Additional paths to exclude from snapshots */
  excludedPaths?: readonly string[];

  /** Path to git binary (defaults to "git") */
  gitBinary?: string;
}

/**
 * Record of a created shadow snapshot.
 */
export interface ShadowSnapshotRecord {
  /** Unique identifier for this snapshot */
  snapshotId: string;

  /** Git commit SHA of this snapshot */
  commitSha: string;

  /** ISO timestamp when snapshot was created */
  createdAt: string;

  /** Workspace root that was snapshotted */
  workspaceRoot: string;

  /** Location of shadow git repository */
  shadowRoot: string;

  /** Optional human-readable label */
  label: string | null;

  /** Reason code for why the snapshot was created */
  reasonCode: string | null;

  /** Actor ID who triggered the snapshot */
  actorId: string | null;

  /** Files that changed in this snapshot */
  changedPaths: string[];

  /** Paths that were excluded */
  excludedPaths: string[];
}

/**
 * Result of restoring a snapshot, includes timing metadata.
 */
export interface ShadowSnapshotRestoreResult extends ShadowSnapshotRecord {
  /** ISO timestamp when restore was performed */
  restoredAt: string;
}

// Default excluded paths for workspace snapshots
const DEFAULT_EXCLUDED_PATHS = [
  ".git/",
  "node_modules/",
  "dist/",
  "coverage/",
  ".next/",
  ".turbo/",
  "tmp/",
  "temp/",
  "data/backups/",
];
const TRUSTED_GIT_BINARY_PREFIXES = [
  "/usr/bin/",
  "/usr/local/bin/",
  "/opt/homebrew/bin/",
  "/bin/",
];
const GIT_COMMAND_TIMEOUT_MS = 15_000;
const GIT_COMMAND_MAX_BUFFER_BYTES = 8 * 1024 * 1024;

/**
 * Returns current time as ISO string.
 */
function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Generates a unique snapshot ID.
 */
function newSnapshotId(): string {
  const suffix = randomUUID();
  return `shadow-${Date.now()}-${suffix}`;
}

/**
 * Validates and normalizes an excluded path pattern.
 */
function normalizeExcludedPath(path: string): string {
  const trimmed = path.trim().replaceAll("\\", "/").replace(/^\.?\//, "");
  if (trimmed.length === 0) {
    throw new ValidationError("shadow_snapshot.invalid_excluded_path", "shadow_snapshot.invalid_excluded_path", {
      source: "tool",
    });
  }
  return trimmed.endsWith("/") ? trimmed : trimmed;
}

/**
 * Sanitizes a path for use in error reason codes.
 */
function sanitizePathForReason(path: string): string {
  return path.replaceAll(":", "_");
}

/**
 * Checks if a path is at or within a root directory.
 */
function isWithin(candidate: string, root: string): boolean {
  const normalizedRoot = root.endsWith(sep) ? root : `${root}${sep}`;
  return candidate === root || candidate.startsWith(normalizedRoot);
}

function ensureExistingPathChainIsNotSymlink(targetPath: string): void {
  const normalized = resolve(targetPath);
  let nearestExistingAncestor = normalized;
  while (!existsSync(nearestExistingAncestor)) {
    const parent = dirname(nearestExistingAncestor);
    if (parent === nearestExistingAncestor) {
      break;
    }
    nearestExistingAncestor = parent;
  }
  const relativePath = normalized === nearestExistingAncestor
    ? ""
    : normalized.slice(nearestExistingAncestor.length).replace(/^[/\\]+/, "");
  const segments = relativePath.length === 0 ? [] : relativePath.split(/[\\/]+/);
  let current = nearestExistingAncestor;
  if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
    throw new PolicyDeniedError("shadow_snapshot.shadow_root_symlink_denied", "shadow_snapshot.shadow_root_symlink_denied", {
      details: { shadowRoot: normalized, symlinkPath: current },
    });
  }
  for (const segment of segments) {
    current = join(current, segment);
    if (!existsSync(current)) {
      continue;
    }
    if (lstatSync(current).isSymbolicLink()) {
      throw new PolicyDeniedError("shadow_snapshot.shadow_root_symlink_denied", "shadow_snapshot.shadow_root_symlink_denied", {
        details: { shadowRoot: normalized, symlinkPath: current },
      });
    }
  }
}

function writeJsonAtomically(path: string, value: unknown): void {
  const tempPath = `${path}.${randomUUID()}.tmp`;
  writeFileSync(tempPath, JSON.stringify(value, null, 2), "utf8");
  renameSync(tempPath, path);
}

/**
 * Checks if a relative path matches an excluded path pattern.
 */
function isIgnoredRelativePath(relativePath: string, excludedPaths: readonly string[]): boolean {
  return excludedPaths.some((pattern) => {
    const normalized = pattern.endsWith("/") ? pattern.slice(0, -1) : pattern;
    return relativePath === normalized || relativePath.startsWith(`${normalized}/`);
  });
}

/**
 * Computes the total size of a file or directory recursively.
 * Stops counting once the budget is exceeded.
 */
function computeEntrySizeBytes(path: string, budget: number): number {
  const stats = statSync(path);
  if (!stats.isDirectory()) {
    return stats.size;
  }

  let total = 0;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const childPath = join(path, entry.name);
    total += computeEntrySizeBytes(childPath, budget - total);
    if (total > budget) {
      return total;
    }
  }
  return total;
}

/**
 * Creates and manages shadow snapshots of a workspace.
 */
export class ShadowSnapshotService {
  private readonly workspaceRoot: string;
  private readonly shadowRoot: string;
  private readonly sandboxPolicy: SandboxPolicy;
  private readonly maxEntryBytes: number;
  private readonly excludedPaths: string[];
  private readonly gitBinary: string;

  public constructor(options: ShadowSnapshotServiceOptions) {
    this.workspaceRoot = resolve(options.workspaceRoot);
    this.shadowRoot = resolve(options.shadowRoot);
    this.sandboxPolicy = options.sandboxPolicy ?? createWorkspaceWritePolicy(this.workspaceRoot);
    this.maxEntryBytes = options.maxEntryBytes ?? 50 * 1024 * 1024;
    // Combine defaults with user-specified exclusions
    this.excludedPaths = Array.from(new Set([...DEFAULT_EXCLUDED_PATHS, ...(options.excludedPaths ?? [])].map(normalizeExcludedPath)));
    this.gitBinary = this.validateGitBinary(options.gitBinary ?? "git");
  }

  /**
   * Creates a new shadow snapshot of the workspace.
   */
  public createSnapshot(input: {
    snapshotId?: string;
    label?: string | null;
    reasonCode?: string | null;
    actorId?: string | null;
  } = {}): ShadowSnapshotRecord {
    const workspaceRoot = this.validateWorkspaceRoot();
    const shadowRoot = this.validateShadowRoot(workspaceRoot);
    this.guardWorkspaceEntrySizes(workspaceRoot);
    this.ensureRepository(workspaceRoot, shadowRoot);

    const snapshotId = input.snapshotId ?? newSnapshotId();
    const createdAt = nowIso();
    const label = input.label?.trim() || null;
    const reasonCode = input.reasonCode?.trim() || null;
    const actorId = input.actorId?.trim() || null;

    // Stage all changes in the workspace
    this.git(["add", "-A", "."], workspaceRoot, shadowRoot);

    // Get list of files that changed
    const changedPaths = this.git(["diff", "--cached", "--name-only"], workspaceRoot, shadowRoot)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    // Create commit with metadata
    const message = [
      `shadow snapshot ${snapshotId}`,
      ...(label ? [`label=${label}`] : []),
      ...(reasonCode ? [`reason=${reasonCode}`] : []),
      ...(actorId ? [`actor=${actorId}`] : []),
    ].join(" | ");

    this.git(["commit", "--allow-empty", "-m", message], workspaceRoot, shadowRoot);
    const commitSha = this.git(["rev-parse", "HEAD"], workspaceRoot, shadowRoot);

    const record: ShadowSnapshotRecord = {
      snapshotId,
      commitSha,
      createdAt,
      workspaceRoot,
      shadowRoot,
      label,
      reasonCode,
      actorId,
      changedPaths,
      excludedPaths: [...this.excludedPaths],
    };
    this.persistRecord(record, shadowRoot);
    return record;
  }

  /**
   * Lists all shadow snapshots in reverse chronological order.
   */
  public listSnapshots(): ShadowSnapshotRecord[] {
    const workspaceRoot = this.validateWorkspaceRoot();
    const shadowRoot = this.validateShadowRoot(workspaceRoot);
    if (!existsSync(this.snapshotMetadataDir(shadowRoot))) {
      return [];
    }

    return readdirSync(this.snapshotMetadataDir(shadowRoot))
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => this.loadRecordByPath(join(this.snapshotMetadataDir(shadowRoot), entry)))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  /**
   * Restores the workspace to a previous snapshot state.
   */
  public restoreSnapshot(input: { snapshotId: string }): ShadowSnapshotRestoreResult {
    const workspaceRoot = this.validateWorkspaceRoot();
    const shadowRoot = this.validateShadowRoot(workspaceRoot);
    this.ensureRepository(workspaceRoot, shadowRoot);

    const record = this.loadRecord(input.snapshotId, shadowRoot);

    // Reset workspace to the snapshot's commit
    this.git(["reset", "--hard", record.commitSha], workspaceRoot, shadowRoot);
    this.git(["clean", "-fd"], workspaceRoot, shadowRoot);

    return {
      ...record,
      restoredAt: nowIso(),
    };
  }

  /**
   * Validates that workspace root is accessible under sandbox policy.
   */
  private validateWorkspaceRoot(): string {
    const check = checkSandboxPath(this.sandboxPolicy, this.workspaceRoot);
    if (!check.allowed) {
      const code = check.reasonCode ?? "shadow_snapshot.workspace_denied";
      throw new SandboxError(code, code, {
        details: { workspaceRoot: this.workspaceRoot },
      });
    }
    return check.normalizedPath;
  }

  /**
   * Validates shadow root location and creates it if needed.
   * Ensures shadow root is outside the workspace.
   */
  private validateShadowRoot(workspaceRoot: string): string {
    const resolvedShadowRoot = resolve(this.shadowRoot);
    const workspaceCandidates = new Set([resolve(this.workspaceRoot), workspaceRoot]);

    // Shadow root must not be inside workspace
    if (Array.from(workspaceCandidates).some((candidate) => isWithin(resolvedShadowRoot, candidate))) {
      throw new PolicyDeniedError(
        "shadow_snapshot.shadow_root_inside_workspace",
        "shadow_snapshot.shadow_root_inside_workspace",
        {
          details: { shadowRoot: resolvedShadowRoot, workspaceRoot },
        },
      );
    }

    ensureExistingPathChainIsNotSymlink(resolvedShadowRoot);

    mkdirSync(resolvedShadowRoot, { recursive: true });
    return resolvedShadowRoot;
  }

  /**
   * Checks that no single entry in the workspace exceeds the size limit.
   */
  private guardWorkspaceEntrySizes(workspaceRoot: string): void {
    const entries = readdirSync(workspaceRoot, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = entry.name;
      if (isIgnoredRelativePath(relativePath, this.excludedPaths)) {
        continue;
      }

      const absolutePath = join(workspaceRoot, relativePath);
      const sizeBytes = computeEntrySizeBytes(absolutePath, this.maxEntryBytes + 1);
      if (sizeBytes > this.maxEntryBytes) {
        throw new ValidationError(
          `shadow_snapshot.entry_too_large:${sanitizePathForReason(relativePath)}`,
          `shadow_snapshot.entry_too_large:${sanitizePathForReason(relativePath)}`,
          {
            source: "tool",
            details: {
              relativePath,
              sizeBytes,
              maxEntryBytes: this.maxEntryBytes,
            },
          },
        );
      }
    }
  }

  /**
   * Initializes the shadow git repository if it doesn't exist.
   */
  private ensureRepository(workspaceRoot: string, shadowRoot: string): void {
    if (!existsSync(join(shadowRoot, "HEAD"))) {
      this.git(["init", "-q"], workspaceRoot, shadowRoot);
      this.git(["config", "user.email", "shadow-snapshot@automatic-agent.local"], workspaceRoot, shadowRoot);
      this.git(["config", "user.name", "Automatic Agent Shadow Snapshot"], workspaceRoot, shadowRoot);
      this.git(["config", "commit.gpgsign", "false"], workspaceRoot, shadowRoot);
    }

    // Write exclude patterns for large directories
    const excludesPath = join(shadowRoot, "shadow-excludes");
    const expectedContents = `${this.excludedPaths.join("\n")}\n`;
    if (!existsSync(excludesPath) || readFileSync(excludesPath, "utf8") !== expectedContents) {
      writeFileSync(excludesPath, expectedContents, "utf8");
    }
    let configuredExcludes = "";
    try {
      configuredExcludes = this.git(["config", "--get", "core.excludesFile"], workspaceRoot, shadowRoot);
    } catch {
      configuredExcludes = "";
    }
    if (configuredExcludes !== excludesPath) {
      this.git(["config", "core.excludesFile", excludesPath], workspaceRoot, shadowRoot);
    }
  }

  /**
   * Returns the path to the snapshot metadata directory.
   */
  private snapshotMetadataDir(shadowRoot: string): string {
    return join(shadowRoot, "snapshots");
  }

  /**
   * Persists a snapshot record as JSON.
   */
  private persistRecord(record: ShadowSnapshotRecord, shadowRoot: string): void {
    const directory = this.snapshotMetadataDir(shadowRoot);
    mkdirSync(directory, { recursive: true });
    writeJsonAtomically(join(directory, `${record.snapshotId}.json`), record);
  }

  /**
   * Loads a snapshot record by ID.
   */
  private loadRecord(snapshotId: string, shadowRoot: string): ShadowSnapshotRecord {
    return this.loadRecordByPath(join(this.snapshotMetadataDir(shadowRoot), `${snapshotId}.json`));
  }

  /**
   * Loads a snapshot record from a file path.
   */
  private loadRecordByPath(path: string): ShadowSnapshotRecord {
    if (!existsSync(path)) {
      throw new StorageError("shadow_snapshot.snapshot_not_found", "shadow_snapshot.snapshot_not_found", {
        details: { path },
      });
    }
    const parsed = JSON.parse(readFileSync(path, "utf8")) as ShadowSnapshotRecord;
    return parsed;
  }

  /**
   * Executes a git command in the shadow repository.
   */
  private git(args: string[], workspaceRoot: string, shadowRoot: string): string {
    return execFileSync(this.gitBinary, [`--git-dir=${shadowRoot}`, `--work-tree=${workspaceRoot}`, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: GIT_COMMAND_TIMEOUT_MS,
      maxBuffer: GIT_COMMAND_MAX_BUFFER_BYTES,
    }).trim();
  }

  private validateGitBinary(gitBinary: string): string {
    if (gitBinary === "git") {
      return gitBinary;
    }
    const resolvedBinary = resolve(gitBinary);
    const binaryName = basename(resolvedBinary).toLowerCase();
    const trustedPrefix = TRUSTED_GIT_BINARY_PREFIXES.some((prefix) => resolvedBinary.startsWith(prefix));
    if ((binaryName !== "git" && binaryName !== "git.exe") || !trustedPrefix) {
      throw new ValidationError(
        `shadow_snapshot.invalid_git_binary:${gitBinary}`,
        `shadow_snapshot.invalid_git_binary:${gitBinary}`,
        { source: "provider", details: { gitBinary } },
      );
    }
    return resolvedBinary;
  }
}
