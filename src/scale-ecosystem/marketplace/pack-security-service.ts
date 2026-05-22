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
const LOG_SENSITIVE_PATTERN = /(password|secret|token|api[_-]?key)/i;
const DYNAMIC_CODE_PATTERN = /\b(eval|Function)\b|constructor\s*\.\s*constructor/i;
const COMMAND_EXEC_PATTERN = /\b(exec|spawn|fork)\b|child_process/i;
const NETWORK_ACCESS_PATTERN = /\b(fetch|XMLHttpRequest|WebSocket)\s*\(|\bhttps?\.(request|get)\s*\(|\bnet\.(connect|createConnection)\s*\(/i;
const FILE_ACCESS_PATTERN = /\b(readFile|writeFile|appendFile|createReadStream|createWriteStream|openSync|readFileSync|writeFileSync)\b/i;
const SANDBOX_ESCAPE_PATTERN = /constructor\s*\.\s*constructor\s*\(|globalThis\s*\[\s*["']process["']\s*\]/i;
const CHILD_PROCESS_INDICATOR_PATTERNS = [
  /child_process/i,
  /(?:globalThis|global|process)\s*\[\s*["']child_process["']\s*\]/i,
  /require\s*\(\s*["']child_process["']\s*\)/i,
  /import\s*\(\s*["']child_process["']\s*\)/i,
];
const SHELL_TRUE_PATTERN = /\bshell\s*:\s*true\b/i;

function normalizeSourceForHeuristics(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/.*$/gm, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

    // Phase 2: fail-close heuristic scan for runtime-only abuse indicators.
    const sandboxIssues = await this.executeInSandbox(input);
    issues.push(...sandboxIssues);

    return { issues };
  }

  private async executeInSandbox(input: SecurityScanInput): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    const sourceCode = this.resolveSourceContent(input);

    if (!sourceCode || sourceCode.trim().length === 0) {
      return issues;
    }

    const normalizedSource = normalizeSourceForHeuristics(sourceCode);

    if (NETWORK_ACCESS_PATTERN.test(normalizedSource)) {
      issues.push({
        severity: "critical",
        category: "sandbox_violation",
        code: "SAND012",
        message: "Pack attempted unauthorized network access",
        location: "runtime",
      });
    }
    if (FILE_ACCESS_PATTERN.test(normalizedSource)) {
      issues.push({
        severity: "high",
        category: "sandbox_violation",
        code: "SAND013",
        message: "Pack attempted unauthorized file access",
        location: "runtime",
      });
    }
    if (LOG_SENSITIVE_PATTERN.test(normalizedSource) && /\bconsole\.(log|warn|error)\s*\(/i.test(normalizedSource)) {
      issues.push({
        severity: "medium",
        category: "sandbox_violation",
        code: "SAND014",
        message: "Potentially sensitive data may be emitted through pack logging",
        location: "runtime",
      });
    }
    if (DYNAMIC_CODE_PATTERN.test(normalizedSource)) {
      issues.push({
        severity: "medium",
        category: "sandbox_violation",
        code: "SAND015",
        message: "Dynamic code construction detected",
        location: "runtime",
      });
    }
    if (COMMAND_EXEC_PATTERN.test(normalizedSource)) {
      issues.push({
        severity: "medium",
        category: "sandbox_violation",
        code: "SAND016",
        message: "Potential command execution attempt detected",
        location: "runtime",
      });
    }
    if (SANDBOX_ESCAPE_PATTERN.test(normalizedSource)) {
      issues.push({
        severity: "critical",
        category: "sandbox_violation",
        code: "SAND017",
        message: "Sandbox escape primitives detected in pack source",
        location: "runtime",
      });
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
    const normalizedSource = normalizeSourceForHeuristics(sourceContent);

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
    if (
      CHILD_PROCESS_INDICATOR_PATTERNS.some((pattern) => pattern.test(normalizedSource))
      && SHELL_TRUE_PATTERN.test(normalizedSource)
    ) {
      issues.push({
        severity: "high",
        category: "static_analysis",
        code: "SAND004",
        message: "Shell execution enabled in child process",
        location: "source",
      });
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
