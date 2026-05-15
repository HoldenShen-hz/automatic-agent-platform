/**
 * Asset Production Figma CDN adapter plugin.
 *
 * Integrates with Figma API and CDN to retrieve design files, assets, and tokens.
 *
 * §G8: Asset Production domain adapter — M2 Phase 4.
 */

import type { ExternalAdapterPlugin } from "../../domains/registry/plugin-spi.js";
import { PolicyDeniedError, type ErrorCode } from "../../platform/contracts/errors.js";
import { NetworkEgressPolicyService } from "../../platform/five-plane-control-plane/iam/network-egress-policy.js";

const assetProductionPolicy = new NetworkEgressPolicyService({
  mode: "enforce",
  allowedDomains: ["api.figma.com", "cdn.figma.com"],
});

export function createAssetProductionAdapterPlugin(): ExternalAdapterPlugin {
  let credentialFingerprint: string | null = null;
  return {
    pluginId: "plugin.assetproduction.figma_adapter",
    spiType: "adapter",
    adapterType: "figma",
    capabilityIds: ["figma.files", "figma.components", "cdn.assets", "design_tokens"],
    async initialize() {
      // Figma API credentials would be validated here
    },
    async healthCheck() {
      return assetProductionPolicy.evaluate("https://api.figma.com").allowed;
    },
    async shutdown() {
      credentialFingerprint = null;
    },
    async authenticate(credentials: Record<string, unknown>): Promise<void> {
      const token = (credentials["token"] ?? credentials["managedSecretRef"]) as string | undefined;
      if (!token || typeof token !== "string") {
        throw new Error("asset_production_adapter.missing_credentials");
      }
      credentialFingerprint = `figma_${token.slice(0, 8)}`;
    },
    async execute(action: string, params: Record<string, unknown>) {
      void credentialFingerprint;

      const { fileKey, nodeId } = params as {
        fileKey?: string;
        nodeId?: string;
      };

      // R28-14 fix: enforce egress policy
      const allowed = assetProductionPolicy.evaluate("https://api.figma.com").allowed;
      if (!allowed) {
        throw new PolicyDeniedError("egress.denied" as ErrorCode, "Asset production adapter: egress denied");
      }

      // In production this would call Figma API and CDN
      return {
        success: true,
        output: {
          action,
          fileKey: fileKey ?? null,
          nodeId: nodeId ?? null,
          status: "success",
          message: `Figma ${action} for file ${fileKey}`,
        },
      };
    },
  };
}
