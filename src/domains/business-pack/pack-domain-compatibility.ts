import { ValidationError } from "../../platform/contracts/errors.js";
import type {
  BusinessPackRiskLevel,
  NormalizedBusinessPackManifest,
  SandboxTier,
} from "./business-pack-manifest.js";
import type { DomainRiskLevel } from "../risk-profile/index.js";

export interface DomainPackCompatibilityDomain {
  readonly domainId: string;
  readonly status: string | null;
  readonly securityLevel: "standard" | "elevated" | "restricted";
  readonly defaultRiskLevel?: DomainRiskLevel | null;
}

const RISK_LEVEL_ORDER: readonly DomainRiskLevel[] = ["low", "medium", "high", "critical"];

function validationError(code: string, message: string, details?: Record<string, unknown>): ValidationError {
  return new ValidationError(code, message, {
    category: "validation",
    source: "internal",
    ...(details != null ? { details } : {}),
  });
}

export function deriveDomainRiskLevelFromSecurityLevel(
  securityLevel: DomainPackCompatibilityDomain["securityLevel"],
): DomainRiskLevel {
  switch (securityLevel) {
    case "restricted":
      return "critical";
    case "elevated":
      return "high";
    default:
      return "low";
  }
}

export function resolveHighestPackRiskLevel(
  pack: Pick<NormalizedBusinessPackManifest, "riskMatrix">,
): BusinessPackRiskLevel | null {
  let highest: BusinessPackRiskLevel | null = null;
  for (const entry of pack.riskMatrix) {
    if (highest == null || RISK_LEVEL_ORDER.indexOf(entry.level) > RISK_LEVEL_ORDER.indexOf(highest)) {
      highest = entry.level;
    }
  }
  return highest;
}

function isSandboxCompatible(
  sandboxTier: SandboxTier,
  securityLevel: DomainPackCompatibilityDomain["securityLevel"],
): boolean {
  switch (sandboxTier) {
    case "restricted_exec":
      return securityLevel === "restricted";
    case "scoped_external_access":
      return securityLevel !== "standard";
    case "workspace_write":
      return securityLevel !== "standard";
    case "read_only":
      return securityLevel !== "restricted";
    default:
      return false;
  }
}

export function assertPackCompatibleWithDomain(
  pack: Pick<NormalizedBusinessPackManifest, "packId" | "domainId" | "sandboxTier" | "riskMatrix">,
  domain: DomainPackCompatibilityDomain,
): void {
  if (domain.status === "archived") {
    throw validationError(
      "pack_domain.archived_domain_forbidden",
      `pack_domain.archived_domain_forbidden: Domain ${domain.domainId} is archived and cannot accept packs.`,
      { domainId: domain.domainId, packId: pack.packId },
    );
  }

  if (!isSandboxCompatible(pack.sandboxTier, domain.securityLevel)) {
    throw validationError(
      "pack_domain.security_level_mismatch",
      `pack_domain.security_level_mismatch: Pack ${pack.packId} sandbox tier ${pack.sandboxTier} is incompatible with domain ${domain.domainId} security level ${domain.securityLevel}.`,
      {
        domainId: domain.domainId,
        packId: pack.packId,
        sandboxTier: pack.sandboxTier,
        securityLevel: domain.securityLevel,
      },
    );
  }

  const packRiskLevel = resolveHighestPackRiskLevel(pack);
  if (packRiskLevel == null) {
    return;
  }
  const domainRiskLevel = domain.defaultRiskLevel ?? deriveDomainRiskLevelFromSecurityLevel(domain.securityLevel);
  const riskDistance = Math.abs(
    RISK_LEVEL_ORDER.indexOf(packRiskLevel) - RISK_LEVEL_ORDER.indexOf(domainRiskLevel),
  );
  if (riskDistance > 1) {
    throw validationError(
      "pack_domain.risk_level_mismatch",
      `pack_domain.risk_level_mismatch: Pack ${pack.packId} highest risk ${packRiskLevel} is incompatible with domain ${domain.domainId} risk ${domainRiskLevel}.`,
      {
        domainId: domain.domainId,
        packId: pack.packId,
        packRiskLevel,
        domainRiskLevel,
      },
    );
  }
}
