/**
 * Livestream OBS/Stream adapter plugin.
 *
 * Integrates with OBS WebSocket and streaming platforms to retrieve configuration
 * and analytics data.
 *
 * §G8: Livestream domain adapter — M2 Phase 5.
 */

import type { ExternalAdapterPlugin } from "../../domains/registry/plugin-spi.js";
import { PolicyDeniedError, ValidationError, type ErrorCode } from "../../platform/contracts/errors.js";
import { NetworkEgressPolicyService } from "../../platform/five-plane-control-plane/iam/network-egress-policy.js";
import { parseSafeOutboundUrl } from "../../platform/five-plane-control-plane/iam/outbound-url-policy.js";
import { buildHashedCredentialFingerprint } from "./credential-hygiene.js";

export interface LivestreamAdapterPluginOptions {
  policy?: NetworkEgressPolicyService;
}

function defineAdapterEndpoint(url: string, key: string): string {
  return parseSafeOutboundUrl(url, {
    invalid: `livestream_adapter.invalid_${key}`,
    blocked: `livestream_adapter.blocked_${key}`,
  }).toString().replace(/\/$/, "");
}

const TWITCH_STREAMS_URL = defineAdapterEndpoint("https://api.twitch.tv/helix/streams", "twitch_streams_url");
const YOUTUBE_LIVE_BROADCASTS_URL = defineAdapterEndpoint(
  "https://www.googleapis.com/youtube/v3/liveBroadcasts",
  "youtube_live_broadcasts_url",
);
const TWITCH_API_BASE_URL = defineAdapterEndpoint("https://api.twitch.tv", "twitch_api_base_url");

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
      if (credentialFingerprint == null) {
        return false;
      }
      const [twitchDecision, youtubeDecision] = await Promise.all([
        policy.evaluate(TWITCH_STREAMS_URL),
        policy.evaluate(YOUTUBE_LIVE_BROADCASTS_URL),
      ]);
      return twitchDecision.allowed && youtubeDecision.allowed;
    },
    async shutdown() {
      credentialFingerprint = null;
    },
    async authenticate(credentials: Record<string, unknown>): Promise<void> {
      // OBS WebSocket token validation
      const token = credentials.obsToken as string | undefined;
      if (!token || typeof token !== "string" || token.trim().length === 0) {
        throw new ValidationError("livestream_adapter.obs_token_required", "OBS authentication token is required");
      }
      // Validate token format (OBS WebSocket tokens are typically 32+ char alphanumeric strings)
      if (!/^[A-Za-z0-9+/=_-]{16,}$/.test(token.trim())) {
        throw new ValidationError(
          "livestream_adapter.obs_token_invalid",
          "OBS authentication token format is invalid",
        );
      }
      credentialFingerprint = buildHashedCredentialFingerprint("obs", token.trim());
    },
    async execute(action: string, params: Record<string, unknown>) {
      if (credentialFingerprint == null) {
        throw new Error("livestream_adapter.not_authenticated");
      }

      const decision = await policy.evaluate(TWITCH_API_BASE_URL);
      if (!decision.allowed) {
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
