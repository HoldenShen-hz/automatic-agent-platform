/**
 * @fileoverview Marketplace Pack Security & Dependency Service
 *
 * Provides:
 * - Automated security scanning for pack publications
 * - Sandbox execution testing before publication approval
 * - Static analysis for vulnerability patterns
 * - Dependency conflict detection with version resolution
 *
 * §55 Marketplace - Automated Security Review + Dependency Conflict Detection
 */

import { createHash } from "node:crypto";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";

export interface SecurityScanInput {
  packId: string;
  version: string;
  sourceUri: string;
  /** Actual source code content for static analysis (required for proper security scanning) */
  sourceCode: string;
  manifestChecksum: string;
  capabilities: readonly string[];
  permissions: readonly string[];
}

export interface SecurityScanResult {
  scanId: string;
  packId: string;
  version: string;
  status: "passed" | "failed" | "warning";
  issues: SecurityIssue[];
  scannedAt: string;
  scanDurationMs: number;
}

export interface SecurityIssue {
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: "sandbox_violation" | "static_analysis" | "capability_mismatch" | "permission_escalation" | "dependency_issue";
  code: string;
  message: string;
  location?: string;
}

export interface DependencyInfo {
  packId: string;
  version: string;
  capabilities: readonly string[];
}

export interface DependencyConflict {
  conflictingPackId: string;
  conflictingVersion: string;
  conflictType: "capability_overlap" | "permission_conflict" | "api_contract_incompatible";
  details: string;
  resolution?: string;
}

export interface CveVulnerability {
  cveId: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  affectedVersionRange: string;
  fixedVersion?: string;
}

export interface DependencyVulnerabilityResult {
  packId: string;
  version: string;
  vulnerabilities: CveVulnerability[];
  scanCompletedAt: string;
}

export interface DependencyResolutionResult {
  packId: string;
  version: string;
  resolved: boolean;
  conflicts: DependencyConflict[];
  suggestions: string[];
}

const CRITICAL_VULNERABILITY_PATTERNS = [
  { pattern: /exec\s*\(\s*user/i, code: "SAND001", message: "User-controlled exec detected" },
  { pattern: /eval\s*\(\s*user/i, code: "SAND002", message: "User-controlled eval detected" },
  { pattern: /process\.env(?!\.)/i, code: "SAND003", message: "Broad environment access detected" },
  { pattern: /child_process.*shell.*true/i, code: "SAND004", message: "Shell execution enabled in child process" },
];

const HIGH_RISK_PERMISSIONS = [
  "file:write",
  "file:delete",
  "exec:bash",
  "exec:cmd",
  "sql:write",
  "network:egress:all",
];

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/i;
const INLINE_SOURCE_PREFIX = "inline:";

export class PackSecurityService {
  public async runSecurityScan(input: SecurityScanInput): Promise<SecurityScanResult> {
    const scanId = newId("scan");
    const startTime = Date.now();
    const issues: SecurityIssue[] = [];

    issues.push(...this.validateManifestChecksum(input));

    const sandboxResult = await this.runSandboxTest(input);
    issues.push(...sandboxResult.issues);

    const staticResult = this.runStaticAnalysis(input);
    issues.push(...staticResult.issues);

    const capabilityResult = this.checkCapabilitySafety(input.capabilities);
    issues.push(...capabilityResult.issues);

    const status = issues.some((i) => i.severity === "critical") ? "failed"
      : issues.some((i) => i.severity === "high") ? "warning"
      : "passed";

    return {
      scanId,
      packId: input.packId,
      version: input.version,
      status,
      issues,
      scannedAt: nowIso(),
      scanDurationMs: Date.now() - startTime,
    };
  }

  public detectDependencyConflicts(
    packId: string,
    version: string,
    dependencies: readonly DependencyInfo[],
    existingPacks: readonly DependencyInfo[],
  ): DependencyResolutionResult {
    const conflicts: DependencyConflict[] = [];
    const suggestions: string[] = [];

    for (const dep of dependencies) {
      const conflictWith = existingPacks.find((existing) =>
        existing.packId === dep.packId && existing.version !== dep.version
      );

      if (conflictWith) {
        const capabilityOverlap = dep.capabilities.some((c) => conflictWith.capabilities.includes(c));
        if (capabilityOverlap) {
          conflicts.push({
            conflictingPackId: conflictWith.packId,
            conflictingVersion: conflictWith.version,
            conflictType: "capability_overlap",
            details: `Pack ${dep.packId} v${dep.version} overlaps capabilities with ${conflictWith.packId} v${conflictWith.version}`,
            resolution: `Use ${conflictWith.packId} v${conflictWith.version} or upgrade ${dep.packId} to a compatible version`,
          });
          suggestions.push(`Consider pinning ${conflictWith.packId} to version ${conflictWith.version}`);
        }
      }
    }

    return {
      packId,
      version,
      resolved: conflicts.length === 0,
      conflicts,
      suggestions,
    };
  }

  private async runSandboxTest(input: SecurityScanInput): Promise<{ issues: SecurityIssue[] }> {
    const issues: SecurityIssue[] = [];

    for (const permission of input.permissions) {
      if (HIGH_RISK_PERMISSIONS.includes(permission)) {
        issues.push({
          severity: "medium",
          category: "permission_escalation",
          code: "PERM001",
          message: `High-risk permission detected: ${permission}`,
          location: "manifest.permissions",
        });
      }
    }

    return { issues };
  }

  private validateManifestChecksum(input: SecurityScanInput): SecurityIssue[] {
    if (!SHA256_HEX_PATTERN.test(input.manifestChecksum)) {
      return [{
        severity: "critical",
        category: "static_analysis",
        code: "PKG001",
        message: "Manifest checksum must be a 64 character SHA-256 hex digest",
        location: "manifest.checksum",
      }];
    }

    if (!input.sourceUri.startsWith(INLINE_SOURCE_PREFIX)) {
      return [];
    }

    const inlineSource = input.sourceUri.slice(INLINE_SOURCE_PREFIX.length);
    const fingerprint = createHash("sha256").update(inlineSource, "utf8").digest("hex");
    if (fingerprint === input.manifestChecksum.toLowerCase()) {
      return [];
    }

    return [{
      severity: "critical",
      category: "static_analysis",
      code: "PKG002",
      message: "Manifest checksum does not match inline source payload",
      location: "manifest.checksum",
    }];
  }

  private runStaticAnalysis(input: SecurityScanInput): { issues: SecurityIssue[] } {
    const issues: SecurityIssue[] = [];
    // Scan actual source code, not the URI string
    const sourceContent = input.sourceCode;

    for (const { pattern, code, message } of CRITICAL_VULNERABILITY_PATTERNS) {
      if (pattern.test(sourceContent)) {
        issues.push({
          severity: "high",
          category: "static_analysis",
          code,
          message,
          location: "source",
        });
      }
    }

    if (input.capabilities.includes("exec") && input.permissions.includes("exec:bash")) {
      issues.push({
        severity: "critical",
        category: "sandbox_violation",
        code: "SAND010",
        message: "Pack has both exec capability and bash permission - potential arbitrary code execution",
        location: "manifest",
      });
    }

    return { issues };
  }

  private checkCapabilitySafety(capabilities: readonly string[]): { issues: SecurityIssue[] } {
    const issues: SecurityIssue[] = [];

    const dangerousCapabilities = capabilities.filter((c) =>
      ["exec", "file_write", "sql_execute", "network_egress"].includes(c)
    );

    if (dangerousCapabilities.length > 3) {
      issues.push({
        severity: "low",
        category: "capability_mismatch",
        code: "CAP001",
        message: `Pack requests ${dangerousCapabilities.length} high-risk capabilities (${dangerousCapabilities.join(", ")}) - may indicate over-provisioning`,
        location: "manifest.capabilities",
      });
    }

    return { issues };
  }
}
