/**
 * @fileoverview Pack Security Core Types and Interfaces
 *
 * Provides type definitions for pack security scanning, vulnerability tracking,
 * trust evaluation, and compliance verification.
 */

import { z } from "zod";

/**
 * Security scan status values
 */
export const SecurityScanStatusSchema = z.enum(["pending", "running", "passed", "warning", "failed"]);
export type SecurityScanStatus = z.infer<typeof SecurityScanStatusSchema>;

/**
 * Security issue severity levels
 */
export const SecuritySeveritySchema = z.enum(["critical", "high", "medium", "low", "info"]);
export type SecuritySeverity = z.infer<typeof SecuritySeveritySchema>;

/**
 * Security issue categories
 */
export const SecurityIssueCategorySchema = z.enum([
  "sandbox_violation",
  "static_analysis",
  "capability_mismatch",
  "permission_escalation",
  "dependency_issue",
  "supply_chain",
  "signature_invalid",
]);
export type SecurityIssueCategory = z.infer<typeof SecurityIssueCategorySchema>;

/**
 * Input for pack security scan
 */
export interface PackSecurityScanInput {
  readonly packId: string;
  readonly version: string;
  readonly sourceUri: string;
  readonly sourceCode?: string;
  readonly manifestChecksum: string;
  readonly capabilities: readonly string[];
  readonly permissions: readonly string[];
  readonly publisherId?: string;
}

/**
 * Individual security issue found during scan
 */
export interface PackSecurityIssue {
  readonly severity: SecuritySeverity;
  readonly category: SecurityIssueCategory;
  readonly code: string;
  readonly message: string;
  readonly location?: string;
  readonly scannerId?: string;
  readonly scannedAt?: string;
}

/**
 * Result of a pack security scan
 */
export interface PackSecurityScanResult {
  readonly scanId: string;
  readonly packId: string;
  readonly version: string;
  readonly status: SecurityScanStatus;
  readonly issues: readonly PackSecurityIssue[];
  readonly scannedAt: string;
  readonly scanDurationMs: number;
  readonly scannerVersion?: string;
}

/**
 * Trust level for pack verification
 */
export const PackTrustLevelSchema = z.enum(["untrusted", "community", "verified", "internal", "strategic"]);
export type PackTrustLevel = z.infer<typeof PackTrustLevelSchema>;

/**
 * Pack security verification status
 */
export interface PackSecurityVerification {
  readonly packId: string;
  readonly version: string;
  readonly trusted: boolean;
  readonly trustLevel: PackTrustLevel;
  readonly verifiedAt: string;
  readonly verificationMethods: readonly string[];
  readonly blockingReasons: readonly string[];
}

/**
 * CVE vulnerability information
 */
export interface PackCveVulnerability {
  readonly cveId: string;
  readonly severity: SecuritySeverity;
  readonly description: string;
  readonly affectedVersionRange: string;
  readonly fixedVersion?: string;
  readonly cweId?: string;
  readonly cvssScore?: number;
}

/**
 * Dependency vulnerability scan result
 */
export interface PackDependencyVulnerabilityResult {
  readonly packId: string;
  readonly version: string;
  readonly vulnerabilities: readonly PackCveVulnerability[];
  readonly scanCompletedAt: string;
  readonly advisorySource: string;
}

/**
 * Pack security policy configuration
 */
export interface PackSecurityPolicy {
  readonly policyId: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly minTrustLevel: PackTrustLevel;
  readonly blockUnverified: boolean;
  readonly requireSignature: boolean;
  readonly requireSbom: boolean;
  readonly allowCommunityPacks: boolean;
  readonly maxDependencyVulnerabilities: number;
  readonly criticalVulnerabilitiesBlockInstall: boolean;
}

/**
 * Default security policies
 */
export const DEFAULT_SECURITY_POLICIES: readonly PackSecurityPolicy[] = Object.freeze([
  {
    policyId: "default-strict",
    name: "Strict Security Policy",
    enabled: true,
    minTrustLevel: "verified",
    blockUnverified: true,
    requireSignature: true,
    requireSbom: true,
    allowCommunityPacks: false,
    maxDependencyVulnerabilities: 0,
    criticalVulnerabilitiesBlockInstall: true,
  },
  {
    policyId: "default-moderate",
    name: "Moderate Security Policy",
    enabled: true,
    minTrustLevel: "community",
    blockUnverified: false,
    requireSignature: false,
    requireSbom: false,
    allowCommunityPacks: true,
    maxDependencyVulnerabilities: 5,
    criticalVulnerabilitiesBlockInstall: true,
  },
  {
    policyId: "default-permissive",
    name: "Permissive Security Policy",
    enabled: true,
    minTrustLevel: "untrusted",
    blockUnverified: false,
    requireSignature: false,
    requireSbom: false,
    allowCommunityPacks: true,
    maxDependencyVulnerabilities: 20,
    criticalVulnerabilitiesBlockInstall: false,
  },
]);

/**
 * Pack security evaluation input
 */
export interface PackSecurityEvaluationInput {
  readonly packId: string;
  readonly version: string;
  readonly publisherId: string;
  readonly trustLevel: PackTrustLevel;
  readonly signatureVerified: boolean;
  readonly sbomVerified: boolean;
  readonly sandboxVerified: boolean;
  readonly egressPolicyReviewed: boolean;
  readonly dependencyVulnerabilities: readonly PackCveVulnerability[];
}

/**
 * Pack security evaluation result
 */
export interface PackSecurityEvaluationResult {
  readonly allowed: boolean;
  readonly trustLevel: PackTrustLevel;
  readonly confidence: number;
  readonly riskScore: number;
  readonly blockingReasons: readonly string[];
  readonly warnings: readonly string[];
  readonly evaluatedAt: string;
  readonly policyId: string;
}

/**
 * Security report for a pack
 */
export interface PackSecurityReport {
  readonly packId: string;
  readonly version: string;
  readonly generatedAt: string;
  readonly scanResults: readonly PackSecurityScanResult[];
  readonly vulnerabilitySummary: {
    readonly critical: number;
    readonly high: number;
    readonly medium: number;
    readonly low: number;
  };
  readonly trustEvaluation: PackSecurityVerification;
  readonly policyEvaluation: PackSecurityEvaluationResult;
  readonly recommendations: readonly string[];
}

/**
 * Evaluate if a pack passes security policy
 */
export function evaluatePackSecurityPolicy(
  input: PackSecurityEvaluationInput,
  policy: PackSecurityPolicy,
): PackSecurityEvaluationResult {
  const blockingReasons: string[] = [];
  const warnings: string[] = [];

  // Trust level check
  const trustLevelRank = { untrusted: 0, community: 1, verified: 2, internal: 3, strategic: 4 };
  const inputTrustRank = trustLevelRank[input.trustLevel] ?? 0;
  const minTrustRank = trustLevelRank[policy.minTrustLevel] ?? 0;

  if (inputTrustRank < minTrustRank) {
    blockingReasons.push(`Trust level ${input.trustLevel} below minimum ${policy.minTrustLevel}`);
  }

  // Block unverified check
  if (policy.blockUnverified) {
    if (!input.signatureVerified) {
      blockingReasons.push("Signature verification required but not performed");
    }
    if (!input.sbomVerified) {
      blockingReasons.push("SBOM verification required but not performed");
    }
    if (!input.sandboxVerified) {
      blockingReasons.push("Sandbox verification required but not performed");
    }
    if (!input.egressPolicyReviewed) {
      blockingReasons.push("Egress policy review required but not performed");
    }
  }

  // Critical vulnerabilities check
  const criticalVulns = input.dependencyVulnerabilities.filter((v) => v.severity === "critical");
  if (policy.criticalVulnerabilitiesBlockInstall && criticalVulns.length > 0) {
    blockingReasons.push(`${criticalVulns.length} critical vulnerabilities block installation`);
  }

  // Max vulnerability threshold
  if (input.dependencyVulnerabilities.length > policy.maxDependencyVulnerabilities) {
    warnings.push(`Dependency vulnerabilities (${input.dependencyVulnerabilities.length}) exceed threshold (${policy.maxDependencyVulnerabilities})`);
  }

  const allowed = blockingReasons.length === 0;
  const riskScore = calculateRiskScore(input, blockingReasons);
  const confidence = calculateConfidence(input);

  return {
    allowed,
    trustLevel: input.trustLevel,
    confidence,
    riskScore,
    blockingReasons,
    warnings,
    evaluatedAt: new Date().toISOString(),
    policyId: policy.policyId,
  };
}

function calculateRiskScore(input: PackSecurityEvaluationInput, blockingReasons: readonly string[]): number {
  let score = 0;

  // Base score from trust level
  const trustScores = { untrusted: 80, community: 50, verified: 20, internal: 10, strategic: 5 };
  score += trustScores[input.trustLevel] ?? 50;

  // Add for unverified items
  if (!input.signatureVerified) score += 15;
  if (!input.sbomVerified) score += 10;
  if (!input.sandboxVerified) score += 10;
  if (!input.egressPolicyReviewed) score += 10;

  // Add for vulnerabilities
  for (const vuln of input.dependencyVulnerabilities) {
    const severityScores = { critical: 25, high: 15, medium: 8, low: 3, info: 1 };
    score += severityScores[vuln.severity] ?? 5;
  }

  // Cap at 100
  return Math.min(100, score);
}

function calculateConfidence(input: PackSecurityEvaluationInput): number {
  let confidence = 0.5; // Base confidence

  if (input.signatureVerified) confidence += 0.1;
  if (input.sbomVerified) confidence += 0.1;
  if (input.sandboxVerified) confidence += 0.1;
  if (input.egressPolicyReviewed) confidence += 0.1;

  const trustScores = { untrusted: 0, community: 0.6, verified: 0.8, internal: 0.9, strategic: 1.0 };
  confidence *= trustScores[input.trustLevel] ?? 0.5;

  return Math.min(1, Math.max(0, confidence));
}

/**
 * Generate security report for a pack
 */
export function generatePackSecurityReport(
  packId: string,
  version: string,
  scanResults: readonly PackSecurityScanResult[],
  evaluation: PackSecurityEvaluationResult,
): PackSecurityReport {
  const vulnerabilitySummary = {
    critical: scanResults.reduce((sum, r) =>
      sum + r.issues.filter((i) => i.severity === "critical").length, 0),
    high: scanResults.reduce((sum, r) =>
      sum + r.issues.filter((i) => i.severity === "high").length, 0),
    medium: scanResults.reduce((sum, r) =>
      sum + r.issues.filter((i) => i.severity === "medium").length, 0),
    low: scanResults.reduce((sum, r) =>
      sum + r.issues.filter((i) => i.severity === "low").length, 0),
  };

  const recommendations: string[] = [];
  if (evaluation.blockingReasons.length > 0) {
    recommendations.push("Address all blocking issues before installation");
  }
  if (vulnerabilitySummary.critical > 0) {
    recommendations.push("Critical vulnerabilities must be remediated before use");
  }
  if (!evaluation.allowed) {
    recommendations.push("Review security policy and consider upgrading to a trusted pack version");
  }

  return {
    packId,
    version,
    generatedAt: new Date().toISOString(),
    scanResults,
    vulnerabilitySummary,
    trustEvaluation: {
      packId,
      version,
      trusted: evaluation.allowed,
      trustLevel: evaluation.trustLevel,
      verifiedAt: evaluation.evaluatedAt,
      verificationMethods: [],
      blockingReasons: evaluation.blockingReasons,
    },
    policyEvaluation: evaluation,
    recommendations,
  };
}