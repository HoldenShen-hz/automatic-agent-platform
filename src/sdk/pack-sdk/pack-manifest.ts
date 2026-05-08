import { ValidationError } from "../../platform/contracts/errors.js";

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
  sdk_semver?: string;
  platform_min_version?: string;
  platform_max_version?: string;
  contract_test_generator?: string;
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
