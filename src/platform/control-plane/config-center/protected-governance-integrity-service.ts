/**
 * Protected Governance Integrity Service
 *
 * Provides tamper detection for critical governance surfaces (config, divisions, agents).
 * Captures cryptographic snapshots of these surfaces and detects unauthorized changes.
 *
 * This service helps ensure the integrity of governance-critical files by:
 * - Computing SHA-256 hashes of protected surfaces
 * - Detecting drift between expected and actual configuration
 * - Validating paths against sandbox policy before access
 *
 * Used by the stability rehearsal framework to verify governance integrity
 * before and after critical operations.
 */

import { createHash } from "node:crypto";
import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

import { PolicyDeniedError } from "../../contracts/errors.js";
import { checkSandboxPath, createWorkspaceWritePolicy, type SandboxPolicy } from "../iam/sandbox-policy.js";

/** Identifiers for governance surfaces that are protected from tampering */
export type ProtectedGovernanceSurfaceId = "config" | "divisions" | "agents";

/**
 * Snapshot of a single protected governance surface (config, divisions, or agents).
 * Contains hash and metadata for tamper detection.
 */
export interface ProtectedGovernanceSurfaceSnapshot {
  surfaceId: ProtectedGovernanceSurfaceId;
  normalizedPath: string;
  entryType: "directory" | "file";
  exists: boolean;
  hash: string | null;
  fileCount: number;
  issues: string[];
}

/**
 * Complete snapshot of all protected governance surfaces.
 * Used as a baseline for drift detection.
 */
export interface ProtectedGovernanceSnapshot {
  versionId: string;
  bundleHash: string;
  generatedAt: string;
  surfaces: ProtectedGovernanceSurfaceSnapshot[];
  issues: string[];
}

/**
 * Report comparing expected vs actual governance surface state.
 * Indicates whether tampering has occurred since the baseline was captured.
 */
export interface ProtectedGovernanceDriftReport {
  checked: boolean;
  expectedVersion: string | null;
  currentVersion: string | null;
  tampered: boolean;
  issues: string[];
  surfaces: ProtectedGovernanceSurfaceSnapshot[];
}

/** Configuration options for the protected governance integrity service */
export interface ProtectedGovernanceIntegrityServiceOptions {
  configRoot?: string;
  divisionsRoot?: string;
  agentsPath?: string;
  sandboxPolicy?: SandboxPolicy;
}

/**
 * Service for capturing and verifying integrity of protected governance surfaces.
 *
 * Monitors config, divisions, and AGENTS.md files for unauthorized changes
 * by maintaining cryptographic hashes and detecting drift between captures.
 */
export class ProtectedGovernanceIntegrityService {
  private readonly configRoot: string;
  private readonly divisionsRoot: string;
  private readonly agentsPath: string;
  private readonly sandboxPolicy: SandboxPolicy;

  /**
   * Creates a new integrity service with the given options.
   * @param options - Override paths and sandbox policy for protected surfaces
   */
  public constructor(options: ProtectedGovernanceIntegrityServiceOptions = {}) {
    this.configRoot = options.configRoot ?? join(process.cwd(), "config");
    this.divisionsRoot = options.divisionsRoot ?? join(process.cwd(), "divisions");
    this.agentsPath = options.agentsPath ?? join(process.cwd(), "AGENTS.md");
    this.sandboxPolicy = options.sandboxPolicy ?? createWorkspaceWritePolicy(process.cwd());
  }

  /**
   * Captures a snapshot of all protected governance surfaces.
   * Computes hashes for each surface for later drift detection.
   */
  public captureSnapshot(): ProtectedGovernanceSnapshot {
    const surfaces = [
      this.captureDirectorySurface("config", this.configRoot),
      this.captureDirectorySurface("divisions", this.divisionsRoot),
      this.captureFileSurface("agents", this.agentsPath),
    ];
    const issues = surfaces.flatMap((surface) => surface.issues);
    const bundleHash = sha256(
      stableStringify(
        surfaces.map((surface) => ({
          surfaceId: surface.surfaceId,
          exists: surface.exists,
          hash: surface.hash,
          fileCount: surface.fileCount,
          issues: surface.issues,
        })),
      ),
    );

    return {
      versionId: bundleHash.slice(0, 16),
      bundleHash,
      generatedAt: new Date().toISOString(),
      surfaces,
      issues,
    };
  }

  /**
   * Detects whether any protected governance surfaces have been tampered with.
   *
   * Compares the current snapshot against an expected version (previously captured)
   * to determine if unauthorized changes occurred.
   *
   * @param expectedVersion - Version ID from a previous snapshot to compare against
   * @returns Drift report indicating whether tampering was detected
   */
  public detectTampering(expectedVersion: string | null = null): ProtectedGovernanceDriftReport {
    const snapshot = this.captureSnapshot();
    const issues = [...snapshot.issues];
    if (expectedVersion != null && expectedVersion !== snapshot.versionId) {
      issues.unshift("protected.version_mismatch");
    }

    return {
      checked: true,
      expectedVersion,
      currentVersion: snapshot.versionId,
      tampered: issues.length > 0,
      issues,
      surfaces: snapshot.surfaces,
    };
  }

  private captureDirectorySurface(
    surfaceId: Extract<ProtectedGovernanceSurfaceId, "config" | "divisions">,
    inputPath: string,
  ): ProtectedGovernanceSurfaceSnapshot {
    const normalizedPath = this.resolveDeclaredPath(inputPath);
    if (!existsSync(normalizedPath)) {
      return {
        surfaceId,
        normalizedPath,
        entryType: "directory",
        exists: false,
        hash: null,
        fileCount: 0,
        issues: [`protected.surface_missing:${surfaceId}`],
      };
    }

    const stat = lstatSync(normalizedPath);
    if (!stat.isDirectory()) {
      return {
        surfaceId,
        normalizedPath,
        entryType: "directory",
        exists: true,
        hash: null,
        fileCount: 0,
        issues: [`protected.surface_not_directory:${surfaceId}`],
      };
    }

    const effectivePolicy: SandboxPolicy = {
      ...this.sandboxPolicy,
      allowedRoots: [normalizedPath],
    };
    const files: Array<{ relativePath: string; hash: string }> = [];
    this.walkDirectory(surfaceId, normalizedPath, normalizedPath, effectivePolicy, files);

    return {
      surfaceId,
      normalizedPath,
      entryType: "directory",
      exists: true,
      hash: sha256(stableStringify(files)),
      fileCount: files.length,
      issues: [],
    };
  }

  private captureFileSurface(
    surfaceId: Extract<ProtectedGovernanceSurfaceId, "agents">,
    inputPath: string,
  ): ProtectedGovernanceSurfaceSnapshot {
    const normalizedPath = this.resolveDeclaredPath(inputPath);
    if (!existsSync(normalizedPath)) {
      return {
        surfaceId,
        normalizedPath,
        entryType: "file",
        exists: false,
        hash: null,
        fileCount: 0,
        issues: [`protected.surface_missing:${surfaceId}`],
      };
    }

    const check = checkSandboxPath(this.sandboxPolicy, inputPath);
    if (!check.allowed) {
      throw new PolicyDeniedError(
        check.reasonCode ?? `protected.surface_denied:${surfaceId}`,
        check.reasonCode ?? `protected.surface_denied:${surfaceId}`,
      );
    }

    const stat = lstatSync(check.normalizedPath);
    if (!stat.isFile()) {
      return {
        surfaceId,
        normalizedPath: check.normalizedPath,
        entryType: "file",
        exists: true,
        hash: null,
        fileCount: 0,
        issues: [`protected.surface_not_file:${surfaceId}`],
      };
    }

    return {
      surfaceId,
      normalizedPath: check.normalizedPath,
      entryType: "file",
      exists: true,
      hash: sha256(readFileSync(check.normalizedPath)),
      fileCount: 1,
      issues: [],
    };
  }

  private resolveDeclaredPath(inputPath: string): string {
    if (existsSync(inputPath)) {
      const existingPathCheck = checkSandboxPath(this.sandboxPolicy, inputPath);
      if (!existingPathCheck.allowed) {
        throw new PolicyDeniedError(
          existingPathCheck.reasonCode ?? "protected.surface_denied",
          existingPathCheck.reasonCode ?? "protected.surface_denied",
        );
      }
      return existingPathCheck.normalizedPath;
    }

    const parentCheck = checkSandboxPath(this.sandboxPolicy, dirname(inputPath));
    if (!parentCheck.allowed) {
      throw new PolicyDeniedError(
        parentCheck.reasonCode ?? "protected.surface_denied",
        parentCheck.reasonCode ?? "protected.surface_denied",
      );
    }

    return join(parentCheck.normalizedPath, basename(inputPath));
  }

  private walkDirectory(
    surfaceId: ProtectedGovernanceSurfaceId,
    rootPath: string,
    currentPath: string,
    policy: SandboxPolicy,
    files: Array<{ relativePath: string; hash: string }>,
  ): void {
    for (const entry of readdirSync(currentPath, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const entryPath = join(currentPath, entry.name);
      const check = checkSandboxPath(policy, entryPath);
      if (!check.allowed) {
        throw new PolicyDeniedError(
          check.reasonCode ?? `protected.surface_denied:${surfaceId}`,
          check.reasonCode ?? `protected.surface_denied:${surfaceId}`,
        );
      }

      if (entry.isDirectory()) {
        this.walkDirectory(surfaceId, rootPath, check.normalizedPath, policy, files);
        continue;
      }

      if (entry.isFile()) {
        files.push({
          relativePath: relative(rootPath, check.normalizedPath),
          hash: sha256(readFileSync(check.normalizedPath)),
        });
      }
    }
  }
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value != null && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableStringify(nested)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
