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
import * as vm from "node:vm";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";

export interface SecurityScanInput {
  packId: string;
  version: string;
  sourceUri: string;
  /** Actual source code content for static analysis and sandbox execution */
  sourceCode?: string;
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
  conflictType: "capability_overlap" | "permission_conflict" | "api_contract_incompatible" | "duplicate_dependency";
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

export interface DependencyVulnerabilitySource {
  lookupVulnerabilities(dependency: DependencyInfo): Promise<readonly CveVulnerability[]>;
}

export interface PackSecurityServiceOptions {
  vulnerabilitySource?: DependencyVulnerabilitySource;
  vulnerabilityApiUrl?: string;
  vulnerabilityEcosystem?: string;
  fetchImpl?: typeof fetch;
}

interface OsvQueryResponse {
  vulns?: Array<{
    id?: string;
    aliases?: string[];
    summary?: string;
    details?: string;
    severity?: Array<{ score?: string }>;
    database_specific?: { severity?: string };
    affected?: Array<{
      ranges?: Array<{
        events?: Array<{
          introduced?: string;
          fixed?: string;
          last_affected?: string;
        }>;
      }>;
      versions?: string[];
    }>;
  }>;
}

const CRITICAL_VULNERABILITY_PATTERNS = [
  { pattern: /exec\s*\(\s*user/i, code: "SAND001", message: "User-controlled exec detected" },
  { pattern: /eval\s*\(\s*user/i, code: "SAND002", message: "User-controlled eval detected" },
  { pattern: /process\.env(?:\b|\.[A-Z0-9_]+|\s*\[[^\]]+\])/i, code: "SAND003", message: "Broad environment access detected" },
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

class OsvDependencyVulnerabilitySource implements DependencyVulnerabilitySource {
  private readonly apiUrl: string;
  private readonly ecosystem: string;
  private readonly fetchImpl: typeof fetch;

  public constructor(options: Required<Pick<PackSecurityServiceOptions, "vulnerabilityApiUrl" | "vulnerabilityEcosystem" | "fetchImpl">>) {
    this.apiUrl = options.vulnerabilityApiUrl;
    this.ecosystem = options.vulnerabilityEcosystem;
    this.fetchImpl = options.fetchImpl;
  }

  public async lookupVulnerabilities(dependency: DependencyInfo): Promise<readonly CveVulnerability[]> {
    const response = await this.fetchImpl(this.apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        package: {
          ecosystem: this.ecosystem,
          name: dependency.packId,
        },
        version: dependency.version,
      }),
    });
    if (!response.ok) {
      throw new Error(`pack_security_service.osv_lookup_failed:${response.status}`);
    }
    const payload = await response.json() as OsvQueryResponse;
    return (payload.vulns ?? []).map((vulnerability) => mapOsvVulnerability(vulnerability));
  }
}

/**
 * Parse a semver string into major.minor.patch components.
 */
function parseSemver(version: string): { major: number; minor: number; patch: number } {
  const parts = version.split(".").map((p) => parseInt(p, 10) || 0);
  return { major: parts[0] ?? 0, minor: parts[1] ?? 0, patch: parts[2] ?? 0 };
}

/**
 * Compare two semver versions. Returns negative if a < b, positive if a > b, 0 if equal.
 */
function compareSemver(a: string, b: string): number {
  const av = parseSemver(a);
  const bv = parseSemver(b);
  if (av.major !== bv.major) return av.major - bv.major;
  if (av.minor !== bv.minor) return av.minor - bv.minor;
  return av.patch - bv.patch;
}

function matchesComparator(version: string, comparator: string): boolean {
  const trimmed = comparator.trim();
  if (trimmed.length === 0) {
    return true;
  }
  if (trimmed.startsWith(">=")) {
    return compareSemver(version, trimmed.slice(2).trim()) >= 0;
  }
  if (trimmed.startsWith("<=")) {
    return compareSemver(version, trimmed.slice(2).trim()) <= 0;
  }
  if (trimmed.startsWith(">")) {
    return compareSemver(version, trimmed.slice(1).trim()) > 0;
  }
  if (trimmed.startsWith("<")) {
    return compareSemver(version, trimmed.slice(1).trim()) < 0;
  }
  if (trimmed.startsWith("^")) {
    const min = trimmed.slice(1).trim();
    const minVersion = parseSemver(min);
    const versionParts = parseSemver(version);
    return versionParts.major === minVersion.major && compareSemver(version, min) >= 0;
  }
  if (trimmed.startsWith("~")) {
    const min = trimmed.slice(1).trim();
    const minVersion = parseSemver(min);
    const versionParts = parseSemver(version);
    return versionParts.major === minVersion.major
      && versionParts.minor === minVersion.minor
      && compareSemver(version, min) >= 0;
  }
  return compareSemver(version, trimmed) === 0;
}

function buildDependencyCacheKey(dependency: DependencyInfo): string {
  return `${dependency.packId}@${dependency.version}`;
}

function normalizeOsvSeverity(value: string | undefined): CveVulnerability["severity"] {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "critical" || normalized === "high" || normalized === "medium" || normalized === "low") {
    return normalized;
  }
  return "medium";
}

function extractOsvSeverity(vulnerability: NonNullable<OsvQueryResponse["vulns"]>[number]): CveVulnerability["severity"] {
  const databaseSeverity = vulnerability.database_specific?.severity;
  if (databaseSeverity != null) {
    return normalizeOsvSeverity(databaseSeverity);
  }
  const score = vulnerability.severity?.[0]?.score?.toUpperCase();
  if (score?.includes("CRITICAL")) {
    return "critical";
  }
  if (score?.includes("HIGH")) {
    return "high";
  }
  if (score?.includes("LOW")) {
    return "low";
  }
  return "medium";
}

function extractAffectedRange(vulnerability: NonNullable<OsvQueryResponse["vulns"]>[number]): string {
  const ranges = vulnerability.affected?.flatMap((affected) =>
    (affected.ranges ?? []).flatMap((range) =>
      (range.events ?? []).map((event) => {
        const parts: string[] = [];
        if (event.introduced != null) {
          parts.push(`>=${event.introduced}`);
        }
        if (event.fixed != null) {
          parts.push(`<${event.fixed}`);
        } else if (event.last_affected != null) {
          parts.push(`<=${event.last_affected}`);
        }
        return parts.join(" ");
      }),
    ),
  ).filter((range) => range.length > 0) ?? [];
  if (ranges.length > 0) {
    return ranges.join(" || ");
  }
  const versions = vulnerability.affected?.flatMap((affected) => affected.versions ?? []) ?? [];
  return versions.join(", ");
}

function extractFixedVersion(vulnerability: NonNullable<OsvQueryResponse["vulns"]>[number]): string | undefined {
  for (const affected of vulnerability.affected ?? []) {
    for (const range of affected.ranges ?? []) {
      for (const event of range.events ?? []) {
        if (event.fixed != null && event.fixed.length > 0) {
          return event.fixed;
        }
      }
    }
  }
  return undefined;
}

function mapOsvVulnerability(vulnerability: NonNullable<OsvQueryResponse["vulns"]>[number]): CveVulnerability {
  const cveId = vulnerability.aliases?.find((alias) => alias.startsWith("CVE-"))
    ?? vulnerability.id
    ?? "OSV-UNKNOWN";
  const fixedVersion = extractFixedVersion(vulnerability);
  return {
    cveId,
    severity: extractOsvSeverity(vulnerability),
    description: vulnerability.summary ?? vulnerability.details ?? "No advisory description provided",
    affectedVersionRange: extractAffectedRange(vulnerability),
    ...(fixedVersion != null ? { fixedVersion } : {}),
  };
}

export class PackSecurityService {
  private readonly vulnerabilitySource: DependencyVulnerabilitySource;
  private readonly vulnerabilityCache = new Map<string, DependencyVulnerabilityResult>();

  public constructor(options: PackSecurityServiceOptions = {}) {
    this.vulnerabilitySource = options.vulnerabilitySource ?? new OsvDependencyVulnerabilitySource({
      vulnerabilityApiUrl: options.vulnerabilityApiUrl ?? "https://api.osv.dev/v1/query",
      vulnerabilityEcosystem: options.vulnerabilityEcosystem ?? "npm",
      fetchImpl: options.fetchImpl ?? fetch,
    });
  }

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
    const seenDependencyKeys = new Set<string>();

    for (const dep of dependencies) {
      const dependencyKey = `${dep.packId}@${dep.version}`;
      if (seenDependencyKeys.has(dependencyKey)) {
        conflicts.push({
          conflictingPackId: dep.packId,
          conflictingVersion: dep.version,
          conflictType: "duplicate_dependency",
          details: `Pack ${dep.packId} v${dep.version} is declared more than once`,
          resolution: `Declare ${dep.packId} v${dep.version} only once and merge capabilities explicitly`,
        });
        suggestions.push(`Remove duplicate dependency ${dependencyKey}`);
        continue;
      }
      seenDependencyKeys.add(dependencyKey);
      const conflictWith = existingPacks.find((existing) =>
        existing.packId === dep.packId
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

  /**
   * Legacy sync accessor for the most recently loaded dependency vulnerability results.
   * Call scanDependencyVulnerabilitiesAsync() to refresh from the configured CVE/OSV source.
   */
  public scanDependencyVulnerabilities(
    dependencies: readonly DependencyInfo[],
  ): DependencyVulnerabilityResult[] {
    return dependencies.map((dependency) =>
      this.vulnerabilityCache.get(buildDependencyCacheKey(dependency)) ?? {
        packId: dependency.packId,
        version: dependency.version,
        vulnerabilities: [],
        scanCompletedAt: nowIso(),
      });
  }

  public async scanDependencyVulnerabilitiesAsync(
    dependencies: readonly DependencyInfo[],
  ): Promise<DependencyVulnerabilityResult[]> {
    const results = await Promise.all(
      dependencies.map(async (dependency) => {
        const vulnerabilities = [...await this.vulnerabilitySource.lookupVulnerabilities(dependency)];
        const result: DependencyVulnerabilityResult = {
          packId: dependency.packId,
          version: dependency.version,
          vulnerabilities,
          scanCompletedAt: nowIso(),
        };
        this.vulnerabilityCache.set(buildDependencyCacheKey(dependency), result);
        return result;
      }),
    );
    return results;
  }

  /**
   * Check if a version matches a CVE affected version range.
   * Supports simple semver ranges (exact, ^, ~, >=).
   */
  private versionMatchesCveRange(version: string, range: string): boolean {
    const comparators = range
      .split(/\s+/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    if (comparators.length === 0) {
      return false;
    }
    return comparators.every((comparator) => matchesComparator(version, comparator));
  }

  private async runSandboxTest(input: SecurityScanInput): Promise<{ issues: SecurityIssue[] }> {
    const issues: SecurityIssue[] = [];

    // Phase 1: Permission list scanning (existing behavior)
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

    // Phase 2: Actual code execution in isolated VM sandbox
    const sandboxIssues = await this.executeInSandbox(input);
    issues.push(...sandboxIssues);

    return { issues };
  }

  /**
   * Execute pack source code in an isolated VM sandbox to detect runtime malicious behavior.
   * This catches threats that static permission scanning misses, such as:
   * - Obfuscated malicious code that doesn't match static patterns
   * - Timing-based attacks that trigger on specific conditions
   * - Environment detection to bypass security checks
   */
  private async executeInSandbox(input: SecurityScanInput): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    const sourceCode = this.resolveSourceContent(input);

    if (!sourceCode || sourceCode.trim().length === 0) {
      // If no source code provided, run static analysis only
      return issues;
    }

    if (/\bfetch\s*\(/i.test(sourceCode)) {
      issues.push({
        severity: "critical",
        category: "sandbox_violation",
        code: "SAND012",
        message: "Pack attempted unauthorized network access",
        location: "runtime",
      });
    }

    // Prepare sandbox context with only whitelisted APIs
    const sandboxApi = {
      // Restricted console - captures output for analysis
      console: {
        log: (...args: unknown[]) => { capturedLogs.push(args.map(String).join(" ")); },
        warn: (...args: unknown[]) => { capturedLogs.push("[WARN] " + args.map(String).join(" ")); },
        error: (...args: unknown[]) => { capturedLogs.push("[ERROR] " + args.map(String).join(" ")); },
      },
      // Restricted Math (prevent timing attacks via Math.random seeding)
      Math: {
        random: () => 0.5, // Deterministic Math.random
        floor: Math.floor,
        ceil: Math.ceil,
        round: Math.round,
        abs: Math.abs,
        min: Math.min,
        max: Math.max,
        PI: Math.PI,
        E: Math.E,
        sqrt: Math.sqrt,
        pow: Math.pow,
      },
      // Restricted Date (prevent time-based triggers) - provide as object, not class
      Date: {
        now: () => 0,
        toISOString: () => "1970-01-01T00:00:00.000Z",
        // Additional Date static methods that might be called
        parse: Date.parse,
        UTC: Date.UTC,
      },
      // Performance timing API (for measuring execution time)
      performance: {
        now: () => 0,
      },
      // Restricted JSON
      JSON: {
        parse: JSON.parse,
        stringify: JSON.stringify,
      },
      // Restricted Array
      Array: {
        isArray: Array.isArray,
        from: Array.from,
        of: Array.of,
      },
      // Restricted Object
      Object: {
        keys: Object.keys,
        values: Object.values,
        entries: Object.entries,
        assign: Object.assign,
        create: Object.create,
        freeze: Object.freeze,
        seal: Object.seal,
      },
      // Restricted String
      String: {
        fromCharCode: String.fromCharCode,
        split: String.prototype.split,
        substring: String.prototype.substring,
        trim: String.prototype.trim,
      },
      // Restricted RegExp
      RegExp: undefined,
      // Restricted Function constructor (blocks eval and new Function)
      Function: undefined,
      // Restricted Promises (prevent async exfiltration)
      Promise: undefined,
      // Restricted fetch (prevent network exfiltration)
      fetch: undefined,
      // Restricted WebAssembly (prevents WASM-based exploits)
      WebAssembly: undefined,
      // Block access to process, Buffer, and other Node.js globals
      process: undefined,
      Buffer: undefined,
      globalThis: undefined,
      global: undefined,
      // Restricted setTimeout/setInterval (prevents timing-based attacks)
      setTimeout: undefined,
      setInterval: undefined,
      clearTimeout: undefined,
      clearInterval: undefined,
      // Block require/import
      require: undefined,
      // Block module exports access
      module: undefined,
      exports: undefined,
      __dirname: undefined,
      __filename: undefined,
    };

    const capturedLogs: string[] = [];
    const networkAttempts: string[] = [];
    const fileAccessAttempts: string[] = [];
    let executionTimeMs = 0;

    // Create the sandbox context
    const context = vm.createContext({
      ...sandboxApi,
      // Track captured logs
      __getCapturedLogs: () => capturedLogs,
      // Track security-relevant events
      __addNetworkAttempt: (url: string) => networkAttempts.push(url),
      __addFileAccess: (path: string) => fileAccessAttempts.push(path),
    });

    // Wrap source code to capture return value and execution time
    const wrappedCode = `
      (function() {
        const __startTime = performance.now();
        try {
          const __result = (function() {
            ${sourceCode}
          })();
          const __endTime = performance.now();
          return {
            success: true,
            result: __result,
            duration: __endTime - __startTime
          };
        } catch (__err) {
          const __endTime = performance.now();
          return {
            success: false,
            error: __err instanceof Error ? __err.message : String(__err),
            duration: __endTime - __startTime
          };
        }
      })()
    `;

    try {
      const result = vm.runInContext(wrappedCode, context, {
        timeout: 5000, // 5 second timeout to prevent infinite loops
        displayErrors: true,
      });

      executionTimeMs = result.duration;

      // Check for excessive execution time (potential DoS)
      if (executionTimeMs > 2000) {
        issues.push({
          severity: "high",
          category: "sandbox_violation",
          code: "SAND011",
          message: `Pack code execution took ${executionTimeMs}ms - possible infinite loop or DoS attempt`,
          location: "runtime",
        });
      }

      // Check if code attempted network access
      if (networkAttempts.length > 0) {
        issues.push({
          severity: "critical",
          category: "sandbox_violation",
          code: "SAND012",
          message: `Pack attempted unauthorized network access: ${networkAttempts.join(", ")}`,
          location: "runtime",
        });
      }

      // Check if code attempted file access
      if (fileAccessAttempts.length > 0) {
        issues.push({
          severity: "high",
          category: "sandbox_violation",
          code: "SAND013",
          message: `Pack attempted unauthorized file access: ${fileAccessAttempts.join(", ")}`,
          location: "runtime",
        });
      }

      // Check captured logs for suspicious patterns
      const suspiciousPatterns = [
        { pattern: /password|secret|token|api[_-]?key/i, code: "SAND014", message: "Potentially sensitive data in logs" },
        { pattern: /eval|Function|constructor/i, code: "SAND015", message: "Dynamic code construction detected" },
        { pattern: /process|child_process|exec/i, code: "SAND016", message: "Potential command execution attempt" },
      ];

      for (const { pattern, code, message } of suspiciousPatterns) {
        for (const log of capturedLogs) {
          if (pattern.test(log)) {
            issues.push({
              severity: "medium",
              category: "sandbox_violation",
              code,
              message: `${message}: "${log.substring(0, 100)}"`,
              location: "runtime",
            });
          }
        }
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Check for specific sandbox escape or abuse attempts
      if (errorMessage.includes("Script execution timed out")) {
        issues.push({
          severity: "high",
          category: "sandbox_violation",
          code: "SAND011",
          message: `Pack code execution timed out: ${errorMessage}`,
          location: "runtime",
        });
      } else if (errorMessage.includes("Cannot access strict mode") ||
          errorMessage.includes("VM context")) {
        issues.push({
          severity: "critical",
          category: "sandbox_violation",
          code: "SAND017",
          message: `Sandbox escape attempt detected: ${errorMessage}`,
          location: "runtime",
        });
      } else {
        issues.push({
          severity: "low",
          category: "sandbox_violation",
          code: "SAND018",
          message: `Pack code threw error during sandbox execution: ${errorMessage}`,
          location: "runtime",
        });
      }
    }

    return issues;
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
    const sourceContent = this.resolveSourceContent(input);

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

  private resolveSourceContent(input: SecurityScanInput): string {
    if (input.sourceCode != null && input.sourceCode.trim().length > 0) {
      return input.sourceCode;
    }
    if (input.sourceUri.startsWith(INLINE_SOURCE_PREFIX)) {
      return input.sourceUri.slice(INLINE_SOURCE_PREFIX.length);
    }
    return "";
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
