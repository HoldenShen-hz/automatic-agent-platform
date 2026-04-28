/**
 * @fileoverview Marketplace Certification - Agent and Pack Certification Gates
 *
 * Implements §55: Security scan/eval gate/SBOM certification pipeline.
 * Provides certification types and gates for agents and packs in the marketplace.
 */

import { z } from "zod";
import { ValidationError } from "../../../platform/contracts/errors.js";

// =============================================================================
// Certification Types
// =============================================================================

/**
 * Certification status for agents and packs.
 */
export type CertificationStatus = "pending" | "in_review" | "approved" | "revoked" | "expired";

/**
 * Security scan result for a certification.
 */
export interface SecurityScanResult {
  readonly scanId: string;
  readonly passed: boolean;
  readonly findings: readonly SecurityFinding[];
  readonly scannedAt: string;
  readonly expiresAt: string;
}

/**
 * Security finding from a scan.
 */
export interface SecurityFinding {
  readonly severity: "critical" | "high" | "medium" | "low" | "info";
  readonly code: string;
  readonly description: string;
  readonly remediation: string;
}

/**
 * Evaluation result for a certification.
 */
export interface EvaluationResult {
  readonly evalId: string;
  readonly passed: boolean;
  readonly score: number;
  readonly categories: readonly EvalCategoryResult[];
  readonly evaluatedAt: string;
}

export interface EvalCategoryResult {
  readonly category: string;
  readonly score: number;
  readonly maxScore: number;
  readonly passed: boolean;
}

/**
 * SBOM (Software Bill of Materials) reference for a certified item.
 */
export interface SbomRef {
  readonly sbomId: string;
  readonly uri: string;
  readonly hash: string;
  readonly format: "spdx" | "cyclonedx" | "cyclonedx-json";
  readonly version: string;
  readonly createdAt: string;
}

// =============================================================================
// Agent Certification
// =============================================================================

export const AgentCertificationSchema = z.object({
  certificationId: z.string().min(1),
  agentId: z.string().min(1),
  version: z.string().min(1),
  status: z.enum(["pending", "in_review", "approved", "revoked", "expired"]),
  securityScan: z.object({
    scanId: z.string().min(1),
    passed: z.boolean(),
    findings: z.array(z.object({
      severity: z.enum(["critical", "high", "medium", "low", "info"]),
      code: z.string().min(1),
      description: z.string().min(1),
      remediation: z.string().min(1),
    })).default([]),
    scannedAt: z.string().min(1),
    expiresAt: z.string().min(1),
  }).nullable().default(null),
  evaluationResult: z.object({
    evalId: z.string().min(1),
    passed: z.boolean(),
    score: z.number().min(0).max(100),
    categories: z.array(z.object({
      category: z.string().min(1),
      score: z.number().min(0),
      maxScore: z.number().positive(),
      passed: z.boolean(),
    })).default([]),
    evaluatedAt: z.string().min(1),
  }).nullable().default(null),
  sbomRef: z.object({
    sbomId: z.string().min(1),
    uri: z.string().min(1),
    hash: z.string().min(1),
    format: z.enum(["spdx", "cyclonedx", "cyclonedx-json"]),
    version: z.string().min(1),
    createdAt: z.string().min(1),
  }).nullable().default(null),
  trustLevel: z.enum(["internal", "trusted", "community", "unverified"]).default("unverified"),
  approvedAt: z.string().nullable().default(null),
  revokedAt: z.string().nullable().default(null),
  expiresAt: z.string().nullable().default(null),
  approvedBy: z.string().nullable().default(null),
  notes: z.string().default(""),
});

export type AgentCertification = z.infer<typeof AgentCertificationSchema>;

// =============================================================================
// Pack Certification
// =============================================================================

export const PackCertificationSchema = z.object({
  certificationId: z.string().min(1),
  packId: z.string().min(1),
  version: z.string().min(1),
  status: z.enum(["pending", "in_review", "approved", "revoked", "expired"]),
  securityScan: z.object({
    scanId: z.string().min(1),
    passed: z.boolean(),
    findings: z.array(z.object({
      severity: z.enum(["critical", "high", "medium", "low", "info"]),
      code: z.string().min(1),
      description: z.string().min(1),
      remediation: z.string().min(1),
    })).default([]),
    scannedAt: z.string().min(1),
    expiresAt: z.string().min(1),
  }).nullable().default(null),
  evaluationResult: z.object({
    evalId: z.string().min(1),
    passed: z.boolean(),
    score: z.number().min(0).max(100),
    categories: z.array(z.object({
      category: z.string().min(1),
      score: z.number().min(0),
      maxScore: z.number().positive(),
      passed: z.boolean(),
    })).default([]),
    evaluatedAt: z.string().min(1),
  }).nullable().default(null),
  sbomRef: z.object({
    sbomId: z.string().min(1),
    uri: z.string().min(1),
    hash: z.string().min(1),
    format: z.enum(["spdx", "cyclonedx", "cyclonedx-json"]),
    version: z.string().min(1),
    createdAt: z.string().min(1),
  }).nullable().default(null),
  trustLevel: z.enum(["internal", "trusted", "community", "unverified"]).default("unverified"),
  approvedAt: z.string().nullable().default(null),
  revokedAt: z.string().nullable().default(null),
  expiresAt: z.string().nullable().default(null),
  approvedBy: z.string().nullable().default(null),
  notes: z.string().default(""),
});

export type PackCertification = z.infer<typeof PackCertificationSchema>;

// =============================================================================
// Certification Gate
// =============================================================================

/**
 * Certification gate result - determines if an item can be published/purchased.
 */
export interface CertificationGateResult {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
  readonly blockedBy: readonly string[];
}

/**
 * CertificationGate - validates that agents/packs meet certification requirements.
 *
 * Per §55, the release pipeline requires:
 * - Security scan gate
 * - Eval gate
 * - SBOM certification
 */
export class CertificationGate {
  /**
   * Check if an agent can be released to the marketplace.
   */
  public checkAgentCertification(certification: AgentCertification): CertificationGateResult {
    const reasons: string[] = [];
    const blockedBy: string[] = [];

    // Check status
    if (certification.status === "revoked") {
      reasons.push("Certification is revoked");
      blockedBy.push("certification_revoked");
    }
    if (certification.status === "expired") {
      reasons.push("Certification has expired");
      blockedBy.push("certification_expired");
    }
    if (certification.status === "pending" || certification.status === "in_review") {
      reasons.push("Certification is not yet approved");
      blockedBy.push("certification_pending");
    }

    // Security scan gate
    if (!certification.securityScan) {
      reasons.push("Security scan required");
      blockedBy.push("security_scan_missing");
    } else if (!certification.securityScan.passed) {
      reasons.push(`Security scan failed: ${certification.securityScan.findings.length} findings`);
      blockedBy.push("security_scan_failed");
    } else if (new Date(certification.securityScan.expiresAt) < new Date()) {
      reasons.push("Security scan has expired");
      blockedBy.push("security_scan_expired");
    }

    // Evaluation gate
    if (!certification.evaluationResult) {
      reasons.push("Evaluation required");
      blockedBy.push("evaluation_missing");
    } else if (!certification.evaluationResult.passed) {
      reasons.push(`Evaluation failed with score ${certification.evaluationResult.score}`);
      blockedBy.push("evaluation_failed");
    }

    // SBOM gate
    if (!certification.sbomRef) {
      reasons.push("SBOM required for certification");
      blockedBy.push("sbom_missing");
    }

    // Trust level gate
    if (certification.trustLevel === "unverified") {
      reasons.push("Agent is unverified");
      blockedBy.push("trust_level_unverified");
    }

    return {
      allowed: blockedBy.length === 0,
      reasons,
      blockedBy,
    };
  }

  /**
   * Check if a pack can be released to the marketplace.
   */
  public checkPackCertification(certification: PackCertification): CertificationGateResult {
    const reasons: string[] = [];
    const blockedBy: string[] = [];

    // Check status
    if (certification.status === "revoked") {
      reasons.push("Certification is revoked");
      blockedBy.push("certification_revoked");
    }
    if (certification.status === "expired") {
      reasons.push("Certification has expired");
      blockedBy.push("certification_expired");
    }
    if (certification.status === "pending" || certification.status === "in_review") {
      reasons.push("Certification is not yet approved");
      blockedBy.push("certification_pending");
    }

    // Security scan gate
    if (!certification.securityScan) {
      reasons.push("Security scan required");
      blockedBy.push("security_scan_missing");
    } else if (!certification.securityScan.passed) {
      reasons.push(`Security scan failed: ${certification.securityScan.findings.length} findings`);
      blockedBy.push("security_scan_failed");
    } else if (new Date(certification.securityScan.expiresAt) < new Date()) {
      reasons.push("Security scan has expired");
      blockedBy.push("security_scan_expired");
    }

    // Evaluation gate
    if (!certification.evaluationResult) {
      reasons.push("Evaluation required");
      blockedBy.push("evaluation_missing");
    } else if (!certification.evaluationResult.passed) {
      reasons.push(`Evaluation failed with score ${certification.evaluationResult.score}`);
      blockedBy.push("evaluation_failed");
    }

    // SBOM gate
    if (!certification.sbomRef) {
      reasons.push("SBOM required for certification");
      blockedBy.push("sbom_missing");
    }

    return {
      allowed: blockedBy.length === 0,
      reasons,
      blockedBy,
    };
  }
}

// =============================================================================
// Certification Records
// =============================================================================

const agentCertifications = new Map<string, AgentCertification>();
const packCertifications = new Map<string, PackCertification>();

/**
 * Register an agent certification.
 */
export function registerAgentCertification(certification: AgentCertification): AgentCertification {
  const existing = agentCertifications.get(certification.agentId);
  if (existing && existing.version === certification.version) {
    throw new ValidationError("certification.duplicate", "Agent certification already exists for this version.");
  }
  agentCertifications.set(certification.agentId, certification);
  return certification;
}

/**
 * Get agent certification by agent ID.
 */
export function getAgentCertification(agentId: string): AgentCertification | null {
  return agentCertifications.get(agentId) ?? null;
}

/**
 * Register a pack certification.
 */
export function registerPackCertification(certification: PackCertification): PackCertification {
  const existing = packCertifications.get(certification.packId);
  if (existing && existing.version === certification.version) {
    throw new ValidationError("certification.duplicate", "Pack certification already exists for this version.");
  }
  packCertifications.set(certification.packId, certification);
  return certification;
}

/**
 * Get pack certification by pack ID.
 */
export function getPackCertification(packId: string): PackCertification | null {
  return packCertifications.get(packId) ?? null;
}

/**
 * Check if an agent is marketplace-ready using the certification gate.
 */
export function isAgentMarketplaceReady(agentId: string): boolean {
  const cert = getAgentCertification(agentId);
  if (!cert) return false;
  const gate = new CertificationGate();
  return gate.checkAgentCertification(cert).allowed;
}

/**
 * Check if a pack is marketplace-ready using the certification gate.
 */
export function isPackMarketplaceReady(packId: string): boolean {
  const cert = getPackCertification(packId);
  if (!cert) return false;
  const gate = new CertificationGate();
  return gate.checkPackCertification(cert).allowed;
}