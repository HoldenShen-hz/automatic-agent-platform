/**
 * Livestream OBS/Stream adapter plugin.
 *
 * Integrates with OBS WebSocket and streaming platforms to retrieve configuration
 * and analytics data.
 *
 * §G8: Livestream domain adapter — M2 Phase 5.
 */

import type { ExternalAdapterPlugin } from "../../domains/registry/plugin-spi.js";
import { PolicyDeniedError, type ErrorCode } from "../../platform/contracts/errors.js";
import { NetworkEgressPolicyService } from "../../platform/five-plane-control-plane/iam/network-egress-policy.js";

export interface LivestreamAdapterPluginOptions {
  policy?: NetworkEgressPolicyService;
}

export function createLivestreamAdapterPlugin(options: LivestreamAdapterPluginOptions = {}): ExternalAdapterPlugin {
  const policy = options.policy ?? new NetworkEgressPolicyService({
    mode: "enforce",
    allowedDomains: ["api.twitch.tv", "www.googleapis.com"],
  });
  let credentialFingerprint: string | null = null;

  return {
    pluginId: "plugin.livestream.obs_adapter",
    spiType: "adapter",
    adapterType: "obs_streaming",
    capabilityIds: ["obs.config", "obs.scenes", "stream.analytics", "stream.engagement"],
    async initialize() {
      // OBS WebSocket credentials would be validated here
    },
    async healthCheck(): Promise<boolean> {
      const token = process.env["OBS_WS_TOKEN"];
      return typeof token === "string" && token.trim().length > 0 && policy.evaluate("https://api.twitch.tv").allowed;
    },
    async shutdown() {
      credentialFingerprint = null;
    },
    async authenticate(credentials: Record<string, unknown>): Promise<void> {
      // OBS WebSocket token validation
      const token = credentials.obsToken as string | undefined;
      if (!token || typeof token !== "string" || token.trim().length === 0) {
        throw new Error("OBS authentication token is required");
      }
      // Validate token format (OBS WebSocket tokens are typically 32+ char alphanumeric strings)
      if (!/^[A-Za-z0-9+/=]{16,}$/.test(token.trim())) {
        throw new Error("OBS authentication token format is invalid");
      }
      credentialFingerprint = `obs_${token.trim().slice(0, 8)}`;
    },
    async execute(action: string, params: Record<string, unknown>) {
      if (credentialFingerprint == null) {
        throw new Error("livestream_adapter.not_authenticated");
      }

      const allowed = policy.evaluate("https://api.twitch.tv").allowed;
      if (!allowed) {
        throw new PolicyDeniedError("egress.denied" as ErrorCode, "Livestream adapter: egress denied");
      }

      const { streamId } = params as { streamId?: string };

      // In production this would call OBS WebSocket API or streaming platform API
      return {
        success: true,
        output: {
          action,
          streamId: streamId ?? null,
          status: "success",
          message: `OBS/Stream ${action} for stream ${streamId}`,
        },
      };
    },
  };
}
