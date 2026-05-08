import { z } from "zod";

export const CertificationRecordSchema = z.object({
  listingId: z.string().min(1),
  certificationId: z.string().min(1),
  status: z.enum(["pending", "approved", "revoked"]),
  approvedAt: z.string().nullable().default(null),
});

export type CertificationRecord = z.infer<typeof CertificationRecordSchema>;

export function isMarketplaceListingCertified(record: CertificationRecord): boolean {
  return record.status === "approved";
}

// Agent and Pack certification types
export interface SecurityScan {
  scanId: string;
  passed: boolean;
  findings: string[];
  scannedAt: string;
  expiresAt: string | null;
}

export interface AgentCertification {
  certificationId: string;
  agentId: string;
  status: "pending" | "approved" | "revoked";
  securityScan?: SecurityScan;
  approvedAt: string | null;
  expiresAt: string | null;
}

export interface PackCertification {
  certificationId: string;
  packId: string;
  status: "pending" | "approved" | "revoked";
  securityScan?: SecurityScan;
  approvedAt: string | null;
  expiresAt: string | null;
}

export interface CertificationResult {
  success: boolean;
  allowed: boolean;
  reasons: string[];
  blockedBy: string[];
  certificationId: string | null;
  expiresAt: string | null;
}

export interface SecurityScanStatus {
  artifactId: string;
  scanId: string;
  status: "pending" | "completed" | "failed";
  passed: boolean;
  findingsCount: number;
  scannedAt: string | null;
  expiresAt: string | null;
}

// Certification gate implementation
export class CertificationGate {
  checkAgentCertification(certification: AgentCertification): {
    allowed: boolean;
    reasons: string[];
    blockedBy: string[];
  } {
    if (certification.status === "revoked") {
      return {
        allowed: false,
        reasons: ["Agent certification has been revoked"],
        blockedBy: ["certification_revoked"],
      };
    }

    if (certification.status === "pending") {
      return {
        allowed: false,
        reasons: ["Agent certification is pending approval"],
        blockedBy: ["certification_pending"],
      };
    }

    if (certification.securityScan && !certification.securityScan.passed) {
      return {
        allowed: false,
        reasons: ["Agent failed security scan", `Found ${certification.securityScan.findings.length} issues`],
        blockedBy: ["security_scan_failed"],
      };
    }

    return {
      allowed: true,
      reasons: ["Agent certification approved"],
      blockedBy: [],
    };
  }

  checkPackCertification(certification: PackCertification): {
    allowed: boolean;
    reasons: string[];
    blockedBy: string[];
  } {
    if (certification.status === "revoked") {
      return {
        allowed: false,
        reasons: ["Pack certification has been revoked"],
        blockedBy: ["certification_revoked"],
      };
    }

    if (certification.status === "pending") {
      return {
        allowed: false,
        reasons: ["Pack certification is pending approval"],
        blockedBy: ["certification_pending"],
      };
    }

    if (certification.securityScan && !certification.securityScan.passed) {
      return {
        allowed: false,
        reasons: ["Pack failed security scan", `Found ${certification.securityScan.findings.length} issues`],
        blockedBy: ["security_scan_failed"],
      };
    }

    return {
      allowed: true,
      reasons: ["Pack certification approved"],
      blockedBy: [],
    };
  }
}

// Mock certification lookup functions
// In production, these would query a certification registry/database
const agentCertifications = new Map<string, AgentCertification>();
const packCertifications = new Map<string, PackCertification>();

export function getAgentCertification(agentId: string): AgentCertification | undefined {
  return agentCertifications.get(agentId);
}

export function getPackCertification(packId: string): PackCertification | undefined {
  return packCertifications.get(packId);
}
