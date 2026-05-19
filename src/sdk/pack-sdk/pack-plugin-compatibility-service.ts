import { ValidationError } from "../../platform/contracts/errors.js";
import { createBuiltinPlugin, listBuiltinPluginIds } from "../../plugins/builtin-plugin-registry.js";
import type { RegisteredPlugin } from "../../domains/registry/plugin-spi.js";
import {
  summarizeCapabilityMatrix,
  validateBusinessPackManifest,
  type BusinessPackCapability,
  type BusinessPackManifest,
} from "./pack-manifest.js";

export type LicenseTier = "community" | "professional" | "enterprise";

export interface BuiltinPluginInventoryEntry {
  pluginId: string;
  spiType: RegisteredPlugin["spiType"];
  domainId: string | null;
  capabilityIds: string[];
  lifecycleHooks: Array<"initialize" | "healthCheck" | "shutdown">;
  minimumLicenseTier: LicenseTier;
  boundaryClass: "core" | "shared" | "domain";
}

export interface PackCapabilityCompatibility {
  capabilityKey: string;
  maturity: BusinessPackCapability["maturity"];
  requiredContracts: string[];
  matchedPluginIds: string[];
  candidatePluginIds: string[];
  requiredLicenseTier: LicenseTier;
  compatible: boolean;
  reasons: string[];
}

export interface PackCompatibilityReport {
  manifest: BusinessPackManifest;
  selectedLicenseTier: LicenseTier;
  requiredLicenseTier: LicenseTier;
  capabilityMatrix: Record<NonNullable<BusinessPackCapability["maturity"]>, number>;
  selectedPlugins: BuiltinPluginInventoryEntry[];
  availablePlugins: BuiltinPluginInventoryEntry[];
  capabilityCoverage: PackCapabilityCompatibility[];
  missingPluginCapabilities: string[];
  blockedByLicense: string[];
  requiredContracts: string[];
  verdict: "compatible" | "missing_plugins" | "license_blocked";
}

export interface PackPluginCompatibilityPolicy {
  recommendationLimit: number;
  exactMatchScore: number;
  tokenOverlapScore: number;
  minimumTokenOverlap: number;
  sameDomainBonus: number;
  sharedDomainBonus: number;
  pluginLicenseTiers: Partial<Record<string, LicenseTier>>;
}

const LICENSE_RANK: Record<LicenseTier, number> = {
  community: 0,
  professional: 1,
  enterprise: 2,
};

const ENTERPRISE_KEYWORDS = [
  "tenant",
  "organization",
  "org",
  "sso",
  "scim",
  "audit",
  "compliance",
  "governance",
  "residency",
  "private",
  "dedicated",
  "enterprise",
];

const PROFESSIONAL_KEYWORDS = [
  "external",
  "github",
  "crm",
  "marketplace",
  "revenue",
  "quota",
  "concurrency",
  "adapter",
  "ops",
];

export class PackPluginCompatibilityService {
  public constructor(
    private readonly policy: PackPluginCompatibilityPolicy = {
      recommendationLimit: 5,
      exactMatchScore: 10,
      tokenOverlapScore: 2,
      minimumTokenOverlap: 2,
      sameDomainBonus: 3,
      sharedDomainBonus: 1,
      pluginLicenseTiers: {
        "plugin.shared.github_adapter": "professional",
      },
    },
  ) {}

  public listAvailablePlugins(): BuiltinPluginInventoryEntry[] {
    return listBuiltinPluginIds()
      .map((pluginId) => this.inspectBuiltinPlugin(pluginId))
      .filter((entry): entry is BuiltinPluginInventoryEntry => entry != null)
      .sort((left, right) => left.pluginId.localeCompare(right.pluginId));
  }

  public inspectBuiltinPlugin(pluginId: string): BuiltinPluginInventoryEntry | null {
    const plugin = createBuiltinPlugin(pluginId);
    if (plugin == null) {
      return null;
    }
    return {
      pluginId: plugin.pluginId,
      spiType: plugin.spiType,
      domainId: "domainId" in plugin && typeof plugin.domainId === "string" ? plugin.domainId : null,
      capabilityIds: [...(plugin.capabilityIds ?? [])],
      lifecycleHooks: [
        ...(typeof plugin.initialize === "function" ? ["initialize" as const] : []),
        ...(typeof plugin.healthCheck === "function" ? ["healthCheck" as const] : []),
        ...(typeof plugin.shutdown === "function" ? ["shutdown" as const] : []),
      ],
      minimumLicenseTier: this.policy.pluginLicenseTiers[plugin.pluginId] ?? "community",
      boundaryClass: inferBoundaryClass(plugin.pluginId),
    };
  }

  public evaluateManifest(input: {
    manifest: BusinessPackManifest;
    selectedLicenseTier: LicenseTier;
    pluginIds?: readonly string[] | undefined;
  }): PackCompatibilityReport {
    const manifest = validateBusinessPackManifest(input.manifest);
    const availablePlugins = this.listAvailablePlugins();
    const selectedPlugins = (input.pluginIds == null ? availablePlugins : input.pluginIds
      .map((pluginId) => this.inspectBuiltinPlugin(pluginId))
      .filter((entry): entry is BuiltinPluginInventoryEntry => entry != null))
      .sort((left, right) => left.pluginId.localeCompare(right.pluginId));

    if (selectedPlugins.length === 0) {
      throw new ValidationError(
        "pack_plugin_compatibility.empty_plugin_set",
        "Pack compatibility evaluation requires at least one available plugin.",
      );
    }

    const capabilityCoverage = manifest.capabilities.map((capability) =>
      this.evaluateCapability(manifest, capability, selectedPlugins, availablePlugins),
    );
    const requiredContracts = [...new Set(manifest.capabilities.flatMap((capability) => capability.requiredContracts ?? []))].sort();
    const requiredLicenseTier = capabilityCoverage.reduce<LicenseTier>(
      (highest, capability) => maxTier(highest, capability.requiredLicenseTier),
      "community",
    );
    const missingPluginCapabilities = capabilityCoverage
      .filter((capability) => capability.matchedPluginIds.length === 0)
      .map((capability) => capability.capabilityKey);
    const blockedByLicense = capabilityCoverage
      .filter((capability) => LICENSE_RANK[capability.requiredLicenseTier] > LICENSE_RANK[input.selectedLicenseTier])
      .map((capability) => capability.capabilityKey);
    const verdict = blockedByLicense.length > 0
      ? "license_blocked"
      : missingPluginCapabilities.length > 0
        ? "missing_plugins"
        : "compatible";

    return {
      manifest,
      selectedLicenseTier: input.selectedLicenseTier,
      requiredLicenseTier,
      capabilityMatrix: summarizeCapabilityMatrix(manifest),
      selectedPlugins,
      availablePlugins,
      capabilityCoverage,
      missingPluginCapabilities,
      blockedByLicense,
      requiredContracts,
      verdict,
    };
  }

  private evaluateCapability(
    manifest: BusinessPackManifest,
    capability: BusinessPackCapability,
    selectedPlugins: readonly BuiltinPluginInventoryEntry[],
    availablePlugins: readonly BuiltinPluginInventoryEntry[],
  ): PackCapabilityCompatibility {
    const rankedSelected = selectedPlugins
      .map((plugin) => ({ plugin, score: scorePluginForCapability(plugin, manifest.domainId, capability.capabilityKey, this.policy) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.plugin.pluginId.localeCompare(right.plugin.pluginId));
    const rankedCandidates = availablePlugins
      .map((plugin) => ({ plugin, score: scorePluginForCapability(plugin, manifest.domainId, capability.capabilityKey, this.policy) }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.plugin.pluginId.localeCompare(right.plugin.pluginId));
    const matchedPluginIds = rankedSelected.map((item) => item.plugin.pluginId);
    const candidatePluginIds = rankedCandidates.map((item) => item.plugin.pluginId).slice(0, this.policy.recommendationLimit);
    const requiredLicenseTier = [
      inferCapabilityLicenseTier(capability.capabilityKey),
      ...(capability.requiredContracts ?? []).map((contract) => inferCapabilityLicenseTier(contract)),
      ...rankedSelected.map((item) => item.plugin.minimumLicenseTier),
    ].reduce<LicenseTier>((highest, tier) => maxTier(highest, tier), "community");
    const reasons: string[] = [];

    if (matchedPluginIds.length === 0) {
      reasons.push("no_selected_plugin_matches_capability");
    }
    if (candidatePluginIds.length > 0 && matchedPluginIds.length === 0) {
      reasons.push(`suggested_plugins:${candidatePluginIds.join(",")}`);
    }
    if (requiredLicenseTier !== "community") {
      reasons.push(`requires_license:${requiredLicenseTier}`);
    }

    return {
      capabilityKey: capability.capabilityKey,
      maturity: capability.maturity ?? capability.profile?.maturity ?? "experimental",
      requiredContracts: capability.requiredContracts ?? [],
      matchedPluginIds,
      candidatePluginIds,
      requiredLicenseTier,
      compatible: matchedPluginIds.length > 0,
      reasons,
    };
  }
}

function inferCapabilityLicenseTier(value: string): LicenseTier {
  const tokens = tokenize([value]);
  if (tokens.some((token) => ENTERPRISE_KEYWORDS.includes(token))) {
    return "enterprise";
  }
  if (tokens.some((token) => PROFESSIONAL_KEYWORDS.includes(token))) {
    return "professional";
  }
  return "community";
}

function inferBoundaryClass(pluginId: string): BuiltinPluginInventoryEntry["boundaryClass"] {
  if (pluginId.startsWith("plugin.core.")) {
    return "core";
  }
  if (pluginId.startsWith("plugin.shared.")) {
    return "shared";
  }
  return "domain";
}

function scorePluginForCapability(
  plugin: BuiltinPluginInventoryEntry,
  domain: string,
  capabilityKey: string,
  policy: PackPluginCompatibilityPolicy,
): number {
  const exactMatch = plugin.capabilityIds.includes(capabilityKey) ? policy.exactMatchScore : 0;
  const capabilityTokens = new Set(tokenize([capabilityKey]));
  const pluginTokens = tokenize([plugin.pluginId, plugin.domainId ?? "", ...plugin.capabilityIds]);
  const overlap = pluginTokens.filter((token) => capabilityTokens.has(token)).length;
  if (exactMatch === 0 && overlap < policy.minimumTokenOverlap) {
    return 0;
  }
  const baseScore = exactMatch + overlap * policy.tokenOverlapScore;
  if (baseScore === 0) {
    return 0;
  }
  const domainBonus = plugin.domainId === domain ? policy.sameDomainBonus : plugin.domainId == null ? policy.sharedDomainBonus : 0;
  return baseScore + domainBonus;
}

function tokenize(values: readonly string[]): string[] {
  return [...new Set(values.flatMap((value) =>
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 0),
  ))];
}

function maxTier(left: LicenseTier, right: LicenseTier): LicenseTier {
  return LICENSE_RANK[left] >= LICENSE_RANK[right] ? left : right;
}
