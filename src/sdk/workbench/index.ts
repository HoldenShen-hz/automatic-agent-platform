import { ValidationError } from "../../platform/contracts/errors.js";
import type { ApiClientConfig } from "../client-sdk/index.js";
import { buildApiUrl } from "../client-sdk/index.js";
import type { BusinessPackManifest } from "../pack-sdk/index.js";
import { validateBusinessPackManifest } from "../pack-sdk/index.js";
import type { PluginManifest } from "../../domains/registry/plugin-spi.js";

function validatePluginManifest(manifest: PluginManifest): PluginManifest {
  return manifest;
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
    const requiredContracts = [...new Set(packs.flatMap((pack) => pack.capabilities.flatMap((capability) => capability.requiredContracts)))];
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
      const pluginCapability = match.capabilityIds.find((id) => id === capability.capabilityKey)!;
      pluginAssignments.push({
        capabilityKey: capability.capabilityKey,
        pluginId: match.pluginId,
        pluginCapability: pluginCapability,
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
      buildApiUrl(input.client, { path: "/tasks" }),
      buildApiUrl(input.client, { path: "/approvals", query: { limit: 10 } }),
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
        label: "List Tasks",
        kind: "api",
        command: "GET /v1/tasks",
        previewUrl: buildApiUrl(client, { path: "/tasks" }),
      },
      {
        shortcutId: "sdk.approvals.queue",
        label: "Approval Queue",
        kind: "api",
        command: "GET /v1/approvals",
        previewUrl: buildApiUrl(client, { path: "/approvals", query: { limit: 10 } }),
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
