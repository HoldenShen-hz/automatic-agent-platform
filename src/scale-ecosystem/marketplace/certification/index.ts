import { z } from "zod";

/**
 * Extended lifecycle states for marketplace certifications including sunset and threshold-based states.
 */
export const CertificationStatusSchema = z.enum([
  "pending",
  "reviewing",
  "under_review",
  "published",
  "suspended",
  "approved",
  "rejected",
  "revoked",
  "expired",
  "sunset",
  "degraded",
]);
export type CertificationStatus = z.infer<typeof CertificationStatusSchema>;

/**
 * Certification health score thresholds for determining certification status.
 */
export interface CertificationHealthThresholds {
  minHealthScore: number;
  maxFindingsAllowed: number;
  minReviewIntervalDays: number;
}

export const DEFAULT_HEALTH_THRESHOLDS: CertificationHealthThresholds = {
  minHealthScore: 0.7,
  maxFindingsAllowed: 5,
  minReviewIntervalDays: 90,
};

export const CertificationRecordSchema = z.object({
  listingId: z.string().min(1),
  certificationId: z.string().min(1),
  status: CertificationStatusSchema,
  approvedAt: z.string().nullable().default(null),
  /** Health score [0-1] based on security scan, review recency, and compliance history. */
  healthScore: z.number().min(0).max(1).default(1.0),
  /** Timestamp when certification sun-setting begins (must be renewed before this date). */
  sunsetAt: z.string().nullable().default(null),
  /** Timestamp when certification expires and becomes invalid. */
  expiresAt: z.string().nullable().default(null),
  /** Last review timestamp for interval-based re-certification checks. */
  lastReviewedAt: z.string().nullable().default(null),
  /** Number of active findings against this certification. */
  activeFindings: z.number().int().nonnegative().default(0),
  /** Quality & Security Gate evidence per §55.1 */
  sbomVerified: z.boolean().default(false),
  signatureVerified: z.boolean().default(false),
  compatibilityVerified: z.boolean().default(false),
  sandboxVerified: z.boolean().default(false),
  egressPolicyReviewed: z.boolean().default(false),
});

export type CertificationRecord = z.infer<typeof CertificationRecordSchema>;

/**
 * Determines if a listing is certified based on full certification record including health score,
 * sunset/ expiration dates, and findings count.
 */
export function isMarketplaceListingCertified(record: CertificationRecord): boolean {
  if (record.status !== "approved") {
    return false;
  }
  const now = new Date();

  // Check if expired
  if (record.expiresAt != null && new Date(record.expiresAt) < now) {
    return false;
  }

  // Check if sunset (should be renewed)
  if (record.sunsetAt != null && new Date(record.sunsetAt) < now) {
    return false;
  }

  // Check health thresholds
  const thresholds = DEFAULT_HEALTH_THRESHOLDS;
  if (record.healthScore < thresholds.minHealthScore) {
    return false;
  }
  if (record.activeFindings > thresholds.maxFindingsAllowed) {
    return false;
  }
  if (!record.sbomVerified || !record.signatureVerified || !record.compatibilityVerified || !record.sandboxVerified || !record.egressPolicyReviewed) {
    return false;
  }

  // Check if re-review is overdue
  if (record.lastReviewedAt != null) {
    const lastReviewed = new Date(record.lastReviewedAt);
    const daysSinceReview = (now.getTime() - lastReviewed.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceReview > thresholds.minReviewIntervalDays) {
      return false;
    }
  }

  return true;
}

/**
 * Returns the detailed certification status including sunset/degraded state.
 */
export function getCertificationHealthStatus(record: CertificationRecord): {
  status: CertificationStatus;
  isValid: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  const now = new Date();

  if (record.status === "revoked" || record.status === "rejected") {
    reasons.push(`Certification status is ${record.status}`);
    return { status: record.status, isValid: false, reasons };
  }

  if (record.status === "expired") {
    reasons.push("Certification has expired");
    return { status: record.status, isValid: false, reasons };
  }

  if (record.status === "sunset") {
    reasons.push("Certification is in sunset period and requires renewal");
    return { status: record.status, isValid: false, reasons };
  }

  if (record.expiresAt != null && new Date(record.expiresAt) < now) {
    reasons.push(`Certification expired at ${record.expiresAt}`);
    return { status: "expired", isValid: false, reasons };
  }

  if (record.sunsetAt != null && new Date(record.sunsetAt) < now) {
    reasons.push(`Certification sunset at ${record.sunsetAt} - renewal required`);
    return { status: "sunset", isValid: false, reasons };
  }

  const thresholds = DEFAULT_HEALTH_THRESHOLDS;
  if (record.healthScore < thresholds.minHealthScore) {
    reasons.push(`Health score ${record.healthScore.toFixed(2)} below threshold ${thresholds.minHealthScore}`);
  }
  if (record.activeFindings > thresholds.maxFindingsAllowed) {
    reasons.push(`Active findings ${record.activeFindings} exceed limit ${thresholds.maxFindingsAllowed}`);
  }
  if (!record.sbomVerified) {
    reasons.push("SBOM verification is required");
  }
  if (!record.signatureVerified) {
    reasons.push("Signature verification is required");
  }
  if (!record.compatibilityVerified) {
    reasons.push("Compatibility verification is required");
  }
  if (!record.sandboxVerified) {
    reasons.push("Sandbox validation is required");
  }
  if (!record.egressPolicyReviewed) {
    reasons.push("Egress policy review is required");
  }

  if (record.lastReviewedAt != null) {
    const lastReviewed = new Date(record.lastReviewedAt);
    const daysSinceReview = (now.getTime() - lastReviewed.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceReview > thresholds.minReviewIntervalDays) {
      reasons.push(`Review overdue: ${Math.floor(daysSinceReview)} days since last review`);
    }
  }

  const isDegraded = record.healthScore < thresholds.minHealthScore
    || record.activeFindings > thresholds.maxFindingsAllowed
    || (record.lastReviewedAt != null && (now.getTime() - new Date(record.lastReviewedAt).getTime()) / (1000 * 60 * 60 * 24) > thresholds.minReviewIntervalDays * 0.8);

  return {
    status: isDegraded ? "degraded" : record.status,
    isValid: reasons.length === 0,
    reasons,
  };
}

// Agent and Pack certification types
export interface SecurityScan {
  scanId: string;
  passed: boolean;
  findings: string[];
  scannedAt: string;
  expiresAt: string | null;
}

export interface CertificationEvidence {
  sbomVerified: boolean;
  signatureVerified: boolean;
  compatibilityVerified: boolean;
  sandboxVerified: boolean;
  egressPolicyReviewed: boolean;
}

export interface AgentCertification {
  certificationId: string;
  agentId: string;
  status: CertificationStatus;
  securityScan?: SecurityScan;
  evidence?: CertificationEvidence;
  approvedAt: string | null;
  expiresAt: string | null;
}

export interface PackCertification {
  certificationId: string;
  packId: string;
  status: CertificationStatus;
  securityScan?: SecurityScan;
  evidence?: CertificationEvidence;
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

    const evidenceFailure = evaluateCertificationEvidence(certification.evidence);
    if (evidenceFailure) {
      return evidenceFailure;
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

    const evidenceFailure = evaluateCertificationEvidence(certification.evidence);
    if (evidenceFailure) {
      return evidenceFailure;
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

function evaluateCertificationEvidence(
  evidence: CertificationEvidence | undefined,
): { allowed: boolean; reasons: string[]; blockedBy: string[] } | null {
  if (evidence == null) {
    return {
      allowed: false,
      reasons: ["Certification evidence bundle is missing"],
      blockedBy: ["certification_evidence_missing"],
    };
  }

  const reasons: string[] = [];
  const blockedBy: string[] = [];
  if (!evidence.sbomVerified) {
    reasons.push("SBOM verification is incomplete");
    blockedBy.push("sbom_verification_required");
  }
  if (!evidence.signatureVerified) {
    reasons.push("Signature verification is incomplete");
    blockedBy.push("signature_verification_required");
  }
  if (!evidence.compatibilityVerified) {
    reasons.push("Compatibility verification is incomplete");
    blockedBy.push("compatibility_verification_required");
  }
  if (!evidence.sandboxVerified) {
    reasons.push("Sandbox validation is incomplete");
    blockedBy.push("sandbox_validation_required");
  }
  if (!evidence.egressPolicyReviewed) {
    reasons.push("Egress policy review is incomplete");
    blockedBy.push("egress_policy_review_required");
  }

  if (blockedBy.length === 0) {
    return null;
  }

  return {
    allowed: false,
    reasons,
    blockedBy,
  };
}
