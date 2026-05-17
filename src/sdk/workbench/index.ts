import { ValidationError } from "../../platform/contracts/errors.js";
import type { ApiClientConfig } from "../client-sdk/index.js";
import { buildApiUrl } from "../client-sdk/index.js";
import type { BusinessPackManifest } from "../pack-sdk/index.js";
import { validateBusinessPackManifest } from "../pack-sdk/index.js";
import {
  PluginManifestSchema,
  type PluginManifest,
  type PluginSpiType,
} from "../../domains/registry/plugin-spi.js";

const VALID_SPI_TYPES = new Set<PluginSpiType>(["tool", "retriever", "validator", "planner", "presenter", "adapter", "evaluator"]);
const VALID_TRUST_LEVELS = new Set(["internal", "trusted", "community", "unverified"]);

function normalizeRequiredManifestString(
  value: unknown,
  fallback: string,
): string {
  if (typeof value === "string") {
    return value;
  }
  return fallback;
}

function normalizePluginManifest(manifest: PluginManifest): PluginManifest {
  const raw = manifest as PluginManifest & {
    spiType?: string;
    type?: string;
    domainId?: string;
  };
  const pluginId = typeof raw.pluginId === "string" ? raw.pluginId : "";
  const spiTypes = Array.isArray(raw.spiTypes)
    ? raw.spiTypes.filter((spiType): spiType is PluginSpiType => VALID_SPI_TYPES.has(spiType))
    : [];
  const legacySpiType = typeof raw.spiType === "string" && VALID_SPI_TYPES.has(raw.spiType as PluginSpiType)
    ? raw.spiType as PluginSpiType
    : typeof raw.type === "string" && VALID_SPI_TYPES.has(raw.type as PluginSpiType)
      ? raw.type as PluginSpiType
      : null;

  return {
    pluginId,
    name: normalizeRequiredManifestString(raw.name, pluginId || "plugin"),
    version: normalizeRequiredManifestString(raw.version, ""),
    owner: normalizeRequiredManifestString(raw.owner, "sdk-workbench"),
    domainIds: Array.isArray(raw.domainIds)
      ? raw.domainIds.filter((domainId): domainId is string => typeof domainId === "string" && domainId.length > 0)
      : typeof raw.domainId === "string" && raw.domainId.length > 0
        ? [raw.domainId]
        : [],
    capabilityIds: Array.isArray(raw.capabilityIds)
      ? raw.capabilityIds.filter((capabilityId): capabilityId is string => typeof capabilityId === "string" && capabilityId.length > 0)
      : [],
    spiTypes: spiTypes.length > 0
      ? spiTypes
      : legacySpiType != null
        ? [legacySpiType]
        : ["tool"],
    extensionKind: raw.extensionKind === "external_adapter" ? "external_adapter" : "domain_plugin",
    trustLevel: typeof raw.trustLevel === "string" && VALID_TRUST_LEVELS.has(raw.trustLevel)
      ? raw.trustLevel
      : "trusted",
    publicSdkSurface: normalizeRequiredManifestString(raw.publicSdkSurface, `${pluginId || "plugin"}.sdk`),
    settingsSchema: raw.settingsSchema != null && typeof raw.settingsSchema === "object" && !Array.isArray(raw.settingsSchema)
      ? raw.settingsSchema as Record<string, unknown>
      : {},
    sandbox: raw.sandbox,
  };
}

function validatePluginManifest(manifest: PluginManifest): PluginManifest {
  const parsed = PluginManifestSchema.safeParse(normalizePluginManifest(manifest));
  if (!parsed.success) {
    throw new ValidationError(
      "sdk_workbench.invalid_plugin_manifest",
      `SDK workbench received an invalid plugin manifest: ${parsed.error.issues.map((issue) => issue.path.join(".") || "root").join(", ")}`,
    );
  }
  return parsed.data;
}

export interface WorkbenchInstallPlan {
  packId: string;
  pluginAssignments: Array<{
    capabilityKey: string;
    pluginId: string;
    pluginCapability: string;
  }>;
  unresolvedCapabilities: string[];
  ready: boolean;
}

export interface SdkWorkbenchShortcut {
  shortcutId: string;
  label: string;
  kind: "api" | "cli" | "docs";
  command: string;
  previewUrl: string | null;
}

export interface SdkWorkbenchSnapshot {
  apiBaseUrl: string;
  apiVersion: string;
  tenantId: string | null;
  pluginIds: string[];
  packIds: string[];
  capabilityCatalog: string[];
  requiredContracts: string[];
  missingContracts: string[];
  installPlans: WorkbenchInstallPlan[];
  workbenchShortcuts: SdkWorkbenchShortcut[];
}

export interface PublishReadinessReport {
  ready: boolean;
  findings: string[];
  previewUrls: string[];
  coveredContracts: string[];
  missingContracts: string[];
}

export class SdkWorkbenchService {
  public buildSnapshot(input: {
    client: ApiClientConfig;
    plugins: PluginManifest[];
    packs: BusinessPackManifest[];
    availableContracts: string[];
  }): SdkWorkbenchSnapshot {
    const plugins = input.plugins.map((plugin) => validatePluginManifest(plugin));
    const packs = input.packs.map((pack) => validateBusinessPackManifest(pack));
    const installPlans = packs.map((pack) => this.createInstallPlan({ pack, plugins }));
    const requiredContracts = [...new Set(packs.flatMap((pack) => pack.capabilities.flatMap((capability) => capability.requiredContracts ?? [])))];
    const availableContracts = new Set(input.availableContracts.map((contract) => contract.trim()).filter((contract) => contract.length > 0));
    const missingContracts = requiredContracts.filter((contract) => !availableContracts.has(contract));

    return {
      apiBaseUrl: input.client.baseUrl,
      apiVersion: input.client.apiVersion,
      tenantId: input.client.tenantId ?? null,
      pluginIds: plugins.map((plugin) => plugin.pluginId),
      packIds: packs.map((pack) => pack.packId),
      capabilityCatalog: [...new Set(plugins.flatMap((plugin) => plugin.capabilityIds))].sort(),
      requiredContracts,
      missingContracts,
      installPlans,
      workbenchShortcuts: this.listWorkbenchShortcuts(input.client),
    };
  }

  public createInstallPlan(input: {
    pack: BusinessPackManifest;
    plugins: PluginManifest[];
  }): WorkbenchInstallPlan {
    const pack = validateBusinessPackManifest(input.pack);
    const plugins = input.plugins.map((plugin) => validatePluginManifest(plugin));
    const pluginAssignments: WorkbenchInstallPlan["pluginAssignments"] = [];
    const unresolvedCapabilities: string[] = [];

    for (const capability of pack.capabilities) {
      const match = plugins.find((plugin) =>
        plugin.capabilityIds.some((id) => id === capability.capabilityKey),
      );
      if (match == null) {
        unresolvedCapabilities.push(capability.capabilityKey);
        continue;
      }
      const pluginCapability = match.capabilityIds.find((id) => id === capability.capabilityKey);
      if (pluginCapability == null) {
        unresolvedCapabilities.push(capability.capabilityKey);
        continue;
      }
      pluginAssignments.push({
        capabilityKey: capability.capabilityKey,
        pluginId: match.pluginId,
        pluginCapability,
      });
    }

    return {
      packId: pack.packId,
      pluginAssignments,
      unresolvedCapabilities,
      ready: unresolvedCapabilities.length === 0,
    };
  }

  public buildPublishReadiness(input: {
    client: ApiClientConfig;
    plugins: PluginManifest[];
    packs: BusinessPackManifest[];
    availableContracts: string[];
  }): PublishReadinessReport {
    if (input.plugins.length === 0 && input.packs.length === 0) {
      throw new ValidationError("sdk_workbench.empty_workspace", "SDK workbench requires at least one plugin or pack.");
    }
    const snapshot = this.buildSnapshot(input);
    const findings: string[] = [];
    for (const plan of snapshot.installPlans) {
      if (!plan.ready) {
        findings.push(`unresolved capabilities for ${plan.packId}: ${plan.unresolvedCapabilities.join(", ")}`);
      }
    }
    if (snapshot.missingContracts.length > 0) {
      findings.push(`missing contracts: ${snapshot.missingContracts.join(", ")}`);
    }

    const previewUrls = [
      buildApiUrl(input.client, { path: "/harness-runs", query: { limit: 10 } }),
      buildApiUrl(input.client, { path: "/packs", query: { limit: 10 } }),
      buildApiUrl(input.client, { path: "/skills/registry/summary" }),
    ];

    return {
      ready: findings.length === 0,
      findings,
      previewUrls,
      coveredContracts: snapshot.requiredContracts.filter((contract) => !snapshot.missingContracts.includes(contract)),
      missingContracts: snapshot.missingContracts,
    };
  }

  public listWorkbenchShortcuts(client: ApiClientConfig): SdkWorkbenchShortcut[] {
    return [
      {
        shortcutId: "sdk.tasks.list",
        label: "List Harness Runs",
        kind: "api",
        command: "GET /v1/harness-runs",
        previewUrl: buildApiUrl(client, { path: "/harness-runs", query: { limit: 10 } }),
      },
      {
        shortcutId: "sdk.packs.list",
        label: "List Packs",
        kind: "api",
        command: "GET /v1/packs",
        previewUrl: buildApiUrl(client, { path: "/packs", query: { limit: 10 } }),
      },
      {
        shortcutId: "sdk.pack.test",
        label: "Run Pack Fixture Test",
        kind: "cli",
        command: "npm run test:integration -- dist/tests/integration/sdk/workbench-sdk-integration.test.js",
        previewUrl: null,
      },
      {
        shortcutId: "sdk.readme.contracts",
        label: "SDK Surface Contract",
        kind: "docs",
        command: "open docs_zh/contracts/sdk_surface_contract.md",
        previewUrl: null,
      },
    ];
  }
}
