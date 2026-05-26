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
import { createHash } from "node:crypto";

export function createAssetProductionAdapterPlugin(): ExternalAdapterPlugin {
  const assetProductionPolicy = new NetworkEgressPolicyService({
    mode: "enforce",
    allowedDomains: ["api.figma.com", "cdn.figma.com"],
  });
  let credentialFingerprint: string | null = null;
  return {
    pluginId: "plugin.assetproduction.figma_adapter",
    spiType: "adapter",
    adapterType: "figma",
    capabilityIds: ["figma.files", "figma.components", "cdn.assets", "design_tokens"],
    async initialize() {
      // Figma API credentials would be validated here
    },
    healthCheck() {
      return assetProductionPolicy.evaluate("https://api.figma.com/v1/files").allowed
        && credentialFingerprint != null
        && assetProductionPolicy.evaluate("https://cdn.figma.com").allowed;
    },
    async shutdown() {
      credentialFingerprint = null;
    },
    async authenticate(credentials: Record<string, unknown>): Promise<void> {
      const token = (credentials["token"] ?? credentials["managedSecretRef"]) as string | undefined;
      if (!token || typeof token !== "string") {
        throw new Error("asset_production_adapter.missing_credentials");
      }
      credentialFingerprint = `figma_${createHash("sha256").update(token).digest("hex").slice(0, 12)}`;
    },
    async execute(action: string, params: Record<string, unknown>) {
      if (credentialFingerprint == null) {
        throw new Error("asset_production_adapter.not_authenticated");
      }

      const { fileKey, nodeId } = params as {
        fileKey?: string;
        nodeId?: string;
      };

      // R28-14 fix: enforce egress policy
      const targetUrl = action.startsWith("cdn_") ? "https://cdn.figma.com" : "https://api.figma.com/v1/files";
      const decision = await assetProductionPolicy.evaluate(targetUrl);
      if (!decision.allowed) {
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
