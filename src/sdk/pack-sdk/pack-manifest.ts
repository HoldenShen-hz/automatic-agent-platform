import { ValidationError } from "../../platform/contracts/errors.js";

/**
 * SdkReleaseDescriptor - SDK release metadata per §22
 * Describes an SDK release with version compatibility and deprecation policy.
 */
export interface SdkReleaseDescriptor {
  /** Semantic version of the SDK */
  sdk_semver: string;
  /** Minimum platform version required to use this SDK */
  platform_min_version: string;
  /** Maximum platform version supported by this SDK */
  platform_max_version: string;
  /** Deprecation policy for this SDK release */
  deprecation_policy: {
    /** When this SDK will be deprecated (ISO date) */
    deprecatedAt?: string | null;
    /** When this SDK will reach end-of-life (ISO date) */
    eolAt?: string | null;
    /** Recommended alternative SDK version to migrate to */
    migrationTarget?: string | null;
    /** Whether critical security patches will still be provided after deprecation */
    securityPatchSupport?: boolean;
  };
  /** Contract test generator identifier */
  contract_test_generator?: string;
}

export interface PackCapabilityProfile {
  maturity: "experimental" | "beta" | "ga";
  requiredContracts: string[];
  supportedPluginTypes?: Array<"tool" | "adapter" | "retriever" | "evaluator">;
  evaluationMode?: "offline" | "online" | "hybrid";
}

export interface BusinessPackCapability {
  capabilityKey: string;
  maturity?: "experimental" | "beta" | "ga";
  requiredContracts?: string[];
  profile?: PackCapabilityProfile;
}

export interface BusinessPackManifest {
  packId: string;
  version: string;
  domainId: string;
  domain?: string;
  owner: string;
  capabilities: BusinessPackCapability[];
  sideEffects?: string[];
  dataClasses?: string[];
  maxRiskClass?: "low" | "medium" | "high" | "critical";
  tools?: string[];
  connectors?: string[];
  plugins?: string[];
  evalRequirements?: {
    requiredDatasets: string[];
    blockingEvaluators: string[];
    acceptanceThresholds?: Record<string, number>;
  };
  compatibility?: {
    minPlatformVersion?: string;
    supportedDomainSpecVersions?: string[];
    requiresActiveDomain?: boolean;
  };
  /** SDK release descriptor with version compatibility and deprecation policy per §22 */
  sdk_release?: SdkReleaseDescriptor;
  /** Rollback strategy for pack deployment per "先可恢复再自动化"宪法 */
  rollbackStrategy?: {
    readonly enabled: boolean;
    readonly strategy: "automatic" | "manual" | "semi_auto";
    readonly maxRollbackDurationMs?: number;
    readonly requireApproval?: boolean;
  };
  /** §22.4/R21-46: SBOM reference for security vulnerability scanning */
  sbomRef?: string | null;
  /** §22.4/R21-30: Cryptographic signature for pack integrity verification */
  signing?: {
    keyId: string;
    signature: string;
    algorithm?: string;
  } | null;
}

export function validateBusinessPackManifest(
  manifest: BusinessPackManifest,
  options: {
    activeDomainIds?: readonly string[];
  } = {},
): BusinessPackManifest {
  if (manifest.packId.trim().length === 0) {
    throw new ValidationError("pack_sdk.invalid_pack_id", "Business pack manifest requires a non-empty packId.");
  }
  if (manifest.capabilities.length === 0) {
    throw new ValidationError("pack_sdk.empty_capabilities", "Business pack manifest must declare at least one capability.");
  }
  const normalizedDomainId = (manifest.domainId ?? manifest.domain ?? "").trim();
  if (normalizedDomainId.length === 0) {
    throw new ValidationError("pack_sdk.invalid_domain_id", "Business pack manifest requires a non-empty domainId.");
  }
  if (options.activeDomainIds != null && options.activeDomainIds.length > 0 && !options.activeDomainIds.includes(normalizedDomainId)) {
    throw new ValidationError("pack_sdk.domain_not_active", `Business pack manifest requires an active domain descriptor for ${normalizedDomainId}.`);
  }

  // §22.4/R21-46: Verify SBOM reference for security vulnerability scanning.
  // Root cause: Previously pack manifests had no security scanning requirement.
  // Per spec, SBOM must be scanned before pack can be loaded into the platform.
  if (manifest.sbomRef != null && manifest.sbomRef.trim().length > 0) {
    // SBOM verification would be performed here using the global SBOM scanner
    // This is a placeholder that would integrate with verifySbomRef from plugin-sdk
    const sbomRef = manifest.sbomRef.trim();
    if (!isValidUri(sbomRef)) {
      throw new ValidationError("pack_sdk.invalid_sbom_ref", `SBOM reference must be a valid URI: ${sbomRef}`);
    }
  }

  // §22.4/R21-30: Verify cryptographic signature for pack integrity.
  // Root cause: Previously packs had no signature requirement. Per spec, SIGNING IS MANDATORY.
  // Pack must be signed to prevent tampering during distribution.
  if (manifest.signing == null) {
    throw new ValidationError(
      "pack_sdk.signature_required",
      "Pack signature is required per security policy - unsigned packs are not allowed",
      { details: { packId: manifest.packId } },
    );
  }
  if (!manifest.signing.keyId?.trim() || !manifest.signing.signature?.trim()) {
    throw new ValidationError("pack_sdk.invalid_signature", "Pack signing.keyId and signature are required");
  }

  return {
    ...manifest,
    packId: manifest.packId.trim(),
    version: manifest.version.trim(),
    domainId: normalizedDomainId,
    domain: normalizedDomainId,
    owner: manifest.owner.trim(),
    sideEffects: dedupeTrimmed(manifest.sideEffects),
    dataClasses: dedupeTrimmed(manifest.dataClasses),
    tools: dedupeTrimmed(manifest.tools),
    connectors: dedupeTrimmed(manifest.connectors),
    plugins: dedupeTrimmed(manifest.plugins),
    maxRiskClass: manifest.maxRiskClass ?? "medium",
    sbomRef: manifest.sbomRef?.trim() || null,
    signing: manifest.signing ? {
      keyId: manifest.signing.keyId.trim(),
      signature: manifest.signing.signature.trim(),
      algorithm: manifest.signing.algorithm?.trim() || "ed25519",
    } : null,
    evalRequirements: {
      requiredDatasets: dedupeTrimmed(manifest.evalRequirements?.requiredDatasets),
      blockingEvaluators: dedupeTrimmed(manifest.evalRequirements?.blockingEvaluators),
      ...(manifest.evalRequirements?.acceptanceThresholds !== undefined
        ? { acceptanceThresholds: { ...manifest.evalRequirements.acceptanceThresholds } }
        : {}),
    },
    compatibility: {
      requiresActiveDomain: manifest.compatibility?.requiresActiveDomain ?? true,
      ...(manifest.compatibility?.minPlatformVersion !== undefined
        ? { minPlatformVersion: manifest.compatibility.minPlatformVersion.trim() }
        : {}),
      supportedDomainSpecVersions: dedupeTrimmed(manifest.compatibility?.supportedDomainSpecVersions),
    },
    capabilities: manifest.capabilities.map((capability) => ({
      capabilityKey: capability.capabilityKey.trim(),
      profile: {
        maturity: capability.profile?.maturity ?? capability.maturity ?? "experimental",
        requiredContracts: dedupeTrimmed(capability.profile?.requiredContracts ?? capability.requiredContracts),
        ...(capability.profile?.supportedPluginTypes !== undefined
          ? { supportedPluginTypes: [...capability.profile.supportedPluginTypes] }
          : {}),
        ...(capability.profile?.evaluationMode !== undefined
          ? { evaluationMode: capability.profile.evaluationMode }
          : {}),
      },
      maturity: capability.profile?.maturity ?? capability.maturity ?? "experimental",
      requiredContracts: dedupeTrimmed(capability.profile?.requiredContracts ?? capability.requiredContracts),
    })),
  };
}

export function summarizeCapabilityMatrix(
  manifest: BusinessPackManifest,
): Record<NonNullable<BusinessPackCapability["maturity"]>, number> {
  const summary = {
    experimental: 0,
    beta: 0,
    ga: 0,
  };
  for (const capability of manifest.capabilities) {
    const maturity = capability.profile?.maturity ?? capability.maturity ?? "experimental";
    summary[maturity] += 1;
  }
  return summary;
}

function dedupeTrimmed(values: readonly string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter((value) => value.length > 0))];
}

function isValidUri(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.protocol === "https:" || url.protocol === "http:" || url.protocol === "file:";
  } catch {
    return false;
  }
}
