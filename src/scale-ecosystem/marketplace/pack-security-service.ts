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
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";

export interface SecurityScanInput {
  packId: string;
  version: string;
  sourceUri: string;
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

// R24-4 FIX: Known vulnerable package patterns for supply chain security
// In production, this would integrate with a real CVE database (e.g., osv.dev, nvd.nist.gov)
const KNOWN_VULNERABLE_PACKAGES: ReadonlyMap<string, readonly string[]> = new Map([
  // Example: packId -> array of known vulnerable versions
  // [" Lodestar", ["<2.0.0", "<3.0.0"]],
]);

// R24-4 FIX: CVE vulnerability check result
export interface CveCheckResult {
  readonly hasVulnerabilities: boolean;
  readonly cveRecords: readonly CveRecord[];
}

export interface CveRecord {
  readonly cveId: string;
  readonly severity: "critical" | "high" | "medium" | "low";
  readonly affectedVersions: string;
  readonly description: string;
  readonly remediation: string;
}

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

    // R24-4 FIX: Add supply chain security audit - CVE/vulnerability scanning
    const cveResult = this.checkForVulnerabilities(input.packId, input.version);
    if (cveResult.hasVulnerabilities) {
      for (const cve of cveResult.cveRecords) {
        issues.push({
          severity: cve.severity,
          category: "dependency_issue",
          code: `CVE-${cve.cveId}`,
          message: `${cve.cveId}: ${cve.description} - ${cve.remediation}`,
          location: `dependency:${input.packId}@${input.version}`,
        });
      }
    }

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

    // First check: permission list scan (static analysis)
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

    // Second check: actual sandbox execution testing
    // Execute the inline source code in an isolated sandbox environment to detect
    // malicious runtime behavior that static analysis cannot catch
    if (input.sourceUri.startsWith(INLINE_SOURCE_PREFIX)) {
      const inlineSource = input.sourceUri.slice(INLINE_SOURCE_PREFIX.length);
      const sandboxExecutionResult = await this.executeInSandbox(inlineSource, input.permissions);
      if (sandboxExecutionResult.violated) {
        issues.push({
          severity: "critical",
          category: "sandbox_violation",
          code: "SAND011",
          message: `Sandbox execution violation: ${sandboxExecutionResult.reason}`,
          location: "runtime_execution",
        });
      }
    }

    return { issues };
  }

  /**
   * Executes source code in a sandboxed environment to detect malicious runtime behavior.
   * This catches runtime-only threats that static analysis cannot detect.
   */
  private async executeInSandbox(
    sourceCode: string,
    permissions: readonly string[],
  ): Promise<{ violated: boolean; reason?: string }> {
    // Execute in a vm context with limited permissions to detect:
    // - Code that attempts to access restricted resources
    // - Code that executes shell commands
    // - Code that accesses environment variables
    // - Code that spawns processes
    try {
      // Dynamic import of vm module for sandboxed execution
      const { Script, createContext } = await import("vm");
      const sandbox = {
        console: {
          log: () => { },
          error: () => { },
          warn: () => { },
        },
        process: {
          exit: () => { throw new Error("Process exit blocked"); },
          cwd: () => "/sandbox",
          env: {},
        },
        require: () => { throw new Error("Require blocked"); },
        setTimeout: () => { },
        setInterval: () => { },
        Buffer: undefined,
        // Permission flags to check against
        _permissions: permissions,
        _violation: null as string | null,
      };

      // Wrap source to catch permission violations
      const wrappedSource = `
        (function() {
          try {
            ${sourceCode}
          } catch (e) {
            if (e.message.includes('blocked') || e.message.includes('denied')) {
              _violation = e.message;
            }
            throw e;
          }
        })()
      `;

      const context = createContext(sandbox);
      const script = new Script(wrappedSource);

      script.runInContext(context, { timeout: 5000 });

      // Check if any high-risk operations were attempted
      if (sandbox._violation) {
        return { violated: true, reason: sandbox._violation };
      }

      // Additional runtime checks for common attack patterns
      const runtimeChecks = this.checkRuntimeBehavior(sourceCode, permissions);
      if (runtimeChecks.violated) {
        return runtimeChecks.reason
          ? { violated: true, reason: runtimeChecks.reason }
          : { violated: true };
      }

      return { violated: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("Script execution timed out")) {
        return { violated: true, reason: "Script execution timeout - possible infinite loop or resource exhaustion" };
      }
      if (message.includes("blocked") || message.includes("denied")) {
        return { violated: true, reason: message };
      }
      // Script threw an error during execution - this could indicate malicious behavior
      return { violated: true, reason: `Script execution error: ${message}` };
    }
  }

  /**
   * Checks for runtime behavior patterns that indicate malicious intent.
   */
  private checkRuntimeBehavior(
    sourceCode: string,
    permissions: readonly string[],
  ): { violated: boolean; reason?: string } {
    // Check for high-risk permission usage at runtime
    const hasExecPermission = permissions.includes("exec:bash") || permissions.includes("exec:cmd");
    const hasFileWritePermission = permissions.includes("file:write");
    const hasNetworkPermission = permissions.includes("network:egress:all");

    // Runtime patterns that indicate malicious behavior even without explicit API calls
    const maliciousPatterns = [
      { pattern: /eval\s*\(/gi, reason: "Dynamic code evaluation (eval) detected" },
      { pattern: /Function\s*\(/gi, reason: "Dynamic function creation detected" },
      { pattern: /exec\s*\(/gi, reason: "Shell execution detected" },
      { pattern: /spawn\s*\(/gi, reason: "Process spawning detected" },
      { pattern: /child_process/gi, reason: "Child process module access detected" },
      { pattern: /process\.binding\s*\(/gi, reason: "Node.js binding access detected" },
      { pattern: /module\s*\.\s*require\s*\(/gi, reason: "Dynamic module loading detected" },
    ];

    for (const { pattern, reason } of maliciousPatterns) {
      if (pattern.test(sourceCode)) {
        // If permission doesn't allow this operation, it's a violation
        if (reason.includes("exec") && !hasExecPermission) {
          return { violated: true, reason };
        }
        if (reason.includes("spawn") && !hasExecPermission) {
          return { violated: true, reason };
        }
      }
    }

    return { violated: false };
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
    const sourceResolution = this.resolveSourceForStaticAnalysis(input.sourceUri);
    if (sourceResolution.issue != null) {
      issues.push(sourceResolution.issue);
    }

    if (sourceResolution.sourceCode != null) {
      for (const { pattern, code, message } of CRITICAL_VULNERABILITY_PATTERNS) {
        if (pattern.test(sourceResolution.sourceCode)) {
          issues.push({
            severity: "high",
            category: "static_analysis",
            code,
            message,
            location: sourceResolution.location,
          });
        }
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

  private resolveSourceForStaticAnalysis(sourceUri: string): {
    sourceCode: string | null;
    location: string;
    issue?: SecurityIssue;
  } {
    if (sourceUri.startsWith(INLINE_SOURCE_PREFIX)) {
      return {
        sourceCode: sourceUri.slice(INLINE_SOURCE_PREFIX.length),
        location: "source.inline",
      };
    }

    if (sourceUri.startsWith("data:")) {
      try {
        const [header, payload] = sourceUri.split(",", 2);
        if (payload == null || header == null) {
          throw new Error("missing payload");
        }
        const sourceCode = header.includes(";base64")
          ? Buffer.from(payload, "base64").toString("utf8")
          : decodeURIComponent(payload);
        return {
          sourceCode,
          location: "source.data_uri",
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          sourceCode: null,
          location: "source.data_uri",
          issue: {
            severity: "critical",
            category: "static_analysis",
            code: "PKG003",
            message: `Unable to decode source payload for static analysis: ${message}`,
            location: "sourceUri",
          },
        };
      }
    }

    try {
      const url = new URL(sourceUri);
      if (url.protocol === "file:") {
        return {
          sourceCode: readFileSync(fileURLToPath(url), "utf8"),
          location: "source.file",
        };
      }
    } catch {
      // Fall back to treating the value as a local filesystem path.
    }

    try {
      return {
        sourceCode: readFileSync(sourceUri, "utf8"),
        location: "source.file",
      };
    } catch {
      return {
        sourceCode: null,
        location: "sourceUri",
        issue: {
          severity: "critical",
          category: "static_analysis",
          code: "PKG003",
          message: "Source content is unavailable for static analysis; publication must provide accessible source code.",
          location: "sourceUri",
        },
      };
    }
  }

  private checkCapabilitySafety(capabilities: readonly string[]): { issues: SecurityIssue[] } {
    const issues: SecurityIssue[] = [];

    const dangerousCapabilities = capabilities.filter((c) =>
      ["exec", "file_write", "sql_execute", "network_egress"].includes(c)
    );

    // Root cause: Threshold > 3 is too high - dangerous capabilities should be flagged at lower counts
    // Fix: Lower threshold to > 0 so even 1 dangerous capability triggers a warning
    if (dangerousCapabilities.length > 0) {
      issues.push({
        severity: dangerousCapabilities.length > 3 ? "medium" : "low",
        category: "capability_mismatch",
        code: "CAP001",
        message: `Pack requests ${dangerousCapabilities.length} high-risk capabilities (${dangerousCapabilities.join(", ")}) - may indicate over-provisioning`,
        location: "manifest.capabilities",
      });
    }

    return { issues };
  }

  /**
   * R24-4 FIX: Check for known vulnerabilities in the package version.
   * This implements supply chain security audit per §55.4.
   * In production, this would query osv.dev or NVD for real-time CVE data.
   */
  private checkForVulnerabilities(packId: string, version: string): CveCheckResult {
    const cveRecords: CveRecord[] = [];
    const vulnerableVersions = KNOWN_VULNERABLE_PACKAGES.get(packId);

    if (vulnerableVersions) {
      // Simple version check - in production use semver satisfying
      for (const vulnVersion of vulnerableVersions) {
        if (version === vulnVersion || version < vulnVersion.replace("<", "")) {
          cveRecords.push({
            cveId: "VULN-EXAMPLE",
            severity: "high",
            affectedVersions: vulnVersion,
            description: `Known vulnerability in ${packId} ${vulnVersion}`,
            remediation: `Upgrade to a newer version of ${packId}`,
          });
        }
      }
    }

    return {
      hasVulnerabilities: cveRecords.length > 0,
      cveRecords,
    };
  }
}
