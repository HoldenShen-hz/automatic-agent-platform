import { z } from "zod";
import { createDomainModulePreset, requiresPresetReview } from "../domain-module-helper.js";

export const LegalTaskTypeSchema = z.enum(["review", "redline", "advise"]);
export type LegalTaskType = z.infer<typeof LegalTaskTypeSchema>;

/**
 * R16-04 FIX: Domain-specific compliance guards for legal operations.
 * These guards enforce jurisdiction, privilege, and confidentiality requirements
 * per the knowledge boundary门 (§198-2305).
 */
export const LEGAL_COMPLIANCE_GUARDRAILS = Object.freeze({
  /** Required jurisdiction codes for legally binding operations */
  requiredJurisdictions: ["US", "EU", "UK"] as readonly string[],
  /** Require privilege check before processing attorney-client communications */
  privilegeCheckRequired: true,
  /** Require confidentiality classification before handling documents */
  confidentialityCheckRequired: true,
  /** Minimum clearance level for regulated/privileged materials */
  minimumClearanceLevel: "confidential" as const,
});

export interface LegalComplianceContext {
  jurisdiction: string;
  hasPrivilege: boolean;
  confidentialityLevel: "public" | "internal" | "confidential" | "restricted";
}

/**
 * Validates that a legal operation passes all compliance gates.
 * @returns true if the operation is compliant
 */
export function validateLegalCompliance(context: LegalComplianceContext): boolean {
  if (!LEGAL_COMPLIANCE_GUARDRAILS.requiredJurisdictions.includes(context.jurisdiction)) {
    return false;
  }
  if (LEGAL_COMPLIANCE_GUARDRAILS.privilegeCheckRequired && !context.hasPrivilege) {
    return false;
  }
  const clearanceOrder = ["public", "internal", "confidential", "restricted"] as const;
  const requiredIndex = clearanceOrder.indexOf(LEGAL_COMPLIANCE_GUARDRAILS.minimumClearanceLevel);
  const providedIndex = clearanceOrder.indexOf(context.confidentialityLevel);
  if (providedIndex < requiredIndex) {
    return false;
  }
  return true;
}

export const LEGAL_DOMAIN_PRESET = createDomainModulePreset("legal", ["review", "redline", "advise"] as const, ["redline", "advise"] as const);
export type LegalDomainPreset = typeof LEGAL_DOMAIN_PRESET;

export function requiresLegalReview(taskType: LegalTaskType): boolean {
  return requiresPresetReview(LEGAL_DOMAIN_PRESET, taskType);
}
