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
import { parseSafeOutboundUrl } from "../../platform/five-plane-control-plane/iam/outbound-url-policy.js";
import { createHash } from "node:crypto";

function defineAdapterEndpoint(url: string, key: string): string {
  return parseSafeOutboundUrl(url, {
    invalid: `asset_production_adapter.invalid_${key}`,
    blocked: `asset_production_adapter.blocked_${key}`,
  }).toString().replace(/\/$/, "");
}

const FIGMA_FILES_URL = defineAdapterEndpoint("https://api.figma.com/v1/files", "figma_files_url");
const FIGMA_CDN_URL = defineAdapterEndpoint("https://cdn.figma.com", "figma_cdn_url");

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
      return assetProductionPolicy.evaluate(FIGMA_FILES_URL).allowed
        && credentialFingerprint != null
        && assetProductionPolicy.evaluate(FIGMA_CDN_URL).allowed;
    },
    async shutdown() {
      credentialFingerprint = null;
    },
    async authenticate(credentials: Record<string, unknown>): Promise<void> {
      const token = (credentials["token"] ?? credentials["managedSecretRef"]) as string | undefined;
      if (!token || typeof token !== "string") {
        throw new Error("asset_production_adapter.missing_credentials");
      }
      credentialFingerprint = `figma_${createHash("sha256").update(token).digest("hex").slice(0, 16)}`;
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
      const targetUrl = action.startsWith("cdn_") ? FIGMA_CDN_URL : FIGMA_FILES_URL;
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
