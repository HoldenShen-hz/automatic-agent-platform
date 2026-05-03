/**
 * @fileoverview Certification Gate Service
 *
 * Implements §55: Certification gates for agents and packs in the marketplace.
 * This service validates that agents and packs meet certification requirements
 * before being allowed to release to the marketplace.
 *
 * Provides three main validation methods:
 * - validateAgentCertification: Validates agent certification status
 * - validatePackCertification: Validates pack certification status
 * - checkSecurityScanStatus: Checks security scan status for artifacts
 *
 * @see docs_zh/architecture/00-platform-architecture.md §55
 */

import { type AgentCertification, type PackCertification } from "./index.js";
import { getAgentCertification, getPackCertification, CertificationGate } from "./index.js";

// Re-export the types from index.ts
export type { CertificationResult, SecurityScanStatus } from "./index.js";

/**
 * Certification Gate Service
 *
 * Provides certification validation for marketplace releases.
 * Per §55, agents and packs must be certified before release.
 */
export class CertificationGateService {
  private readonly gate = new CertificationGate();

  /**
   * Validates that an agent is certified for marketplace release.
   *
   * @param agentId - The agent to validate
   * @returns Certification result with allowed status and reasons
   */
  public async validateAgentCertification(agentId: string): Promise<CertificationResult> {
    const certification = getAgentCertification(agentId);

    if (!certification) {
      return {
        success: false,
        allowed: false,
        reasons: ["Agent certification not found"],
        blockedBy: ["certification_not_found"],
        certificationId: null,
        expiresAt: null,
      };
    }

    const result = this.gate.checkAgentCertification(certification);

    return {
      success: result.allowed,
      allowed: result.allowed,
      reasons: result.reasons,
      blockedBy: result.blockedBy,
      certificationId: certification.certificationId,
      expiresAt: this.extractExpiration(certification),
    };
  }

  /**
   * Validates that a pack is certified for marketplace release.
   *
   * @param packId - The pack to validate
   * @returns Certification result with allowed status and reasons
   */
  public async validatePackCertification(packId: string): Promise<CertificationResult> {
    const certification = getPackCertification(packId);

    if (!certification) {
      return {
        success: false,
        allowed: false,
        reasons: ["Pack certification not found"],
        blockedBy: ["certification_not_found"],
        certificationId: null,
        expiresAt: null,
      };
    }

    const result = this.gate.checkPackCertification(certification);

    return {
      success: result.allowed,
      allowed: result.allowed,
      reasons: result.reasons,
      blockedBy: result.blockedBy,
      certificationId: certification.certificationId,
      expiresAt: this.extractPackExpiration(certification),
    };
  }

  /**
   * Checks the security scan status for an artifact.
   *
   * @param artifactId - The artifact to check
   * @returns Security scan status
   */
  public async checkSecurityScanStatus(artifactId: string): Promise<SecurityScanStatus> {
    // Check agent certifications for this artifact
    const agentCert = getAgentCertification(artifactId);
    if (agentCert && agentCert.securityScan) {
      const scan = agentCert.securityScan;
      return {
        artifactId,
        scanId: scan.scanId,
        status: scan.passed ? "completed" : "failed",
        passed: scan.passed,
        findingsCount: scan.findings.length,
        scannedAt: scan.scannedAt,
        expiresAt: scan.expiresAt,
      };
    }

    // Check pack certifications for this artifact
    const packCert = getPackCertification(artifactId);
    if (packCert && packCert.securityScan) {
      const scan = packCert.securityScan;
      return {
        artifactId,
        scanId: scan.scanId,
        status: scan.passed ? "completed" : "failed",
        passed: scan.passed,
        findingsCount: scan.findings.length,
        scannedAt: scan.scannedAt,
        expiresAt: scan.expiresAt,
      };
    }

    // No scan found - return pending status
    return {
      artifactId,
      scanId: "",
      status: "pending",
      passed: false,
      findingsCount: 0,
      scannedAt: null,
      expiresAt: null,
    };
  }

  private extractExpiration(certification: AgentCertification): string | null {
    if (!certification.securityScan) {
      return null;
    }
    return certification.securityScan.expiresAt;
  }

  private extractPackExpiration(certification: PackCertification): string | null {
    if (!certification.securityScan) {
      return null;
    }
    return certification.securityScan.expiresAt;
  }
}

// Export singleton for convenience
let certificationGateService: CertificationGateService | null = null;

export function getCertificationGateService(): CertificationGateService {
  if (!certificationGateService) {
    certificationGateService = new CertificationGateService();
  }
  return certificationGateService;
}