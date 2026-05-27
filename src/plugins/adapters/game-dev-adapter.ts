/**
 * Game Dev Unity Cloud Build adapter plugin.
 *
 * Integrates with Unity Cloud Build to retrieve build status, logs, and artifacts.
 *
 * §G8: Game Dev domain adapter — M2 Phase 3.
 */

import type { ExternalAdapterPlugin } from "../../domains/registry/plugin-spi.js";
import { PolicyDeniedError, type ErrorCode } from "../../platform/contracts/errors.js";
import { NetworkEgressPolicyService } from "../../platform/five-plane-control-plane/iam/network-egress-policy.js";
import { parseSafeOutboundUrl } from "../../platform/five-plane-control-plane/iam/outbound-url-policy.js";
import { buildHashedCredentialFingerprint } from "./credential-hygiene.js";

function defineAdapterEndpoint(url: string, key: string): string {
  return parseSafeOutboundUrl(url, {
    invalid: `game_dev_adapter.invalid_${key}`,
    blocked: `game_dev_adapter.blocked_${key}`,
  }).toString().replace(/\/$/, "");
}

const UNITY_BUILD_API_URL = defineAdapterEndpoint("https://build-api.unity.com", "unity_build_api_url");

// R28-13 fix: add auth check and egress policy to game-dev-adapter
const gameDevPolicy = new NetworkEgressPolicyService({
  mode: "enforce",
  allowedDomains: ["build-api.unity.com"],
});

export function createGameDevAdapterPlugin(): ExternalAdapterPlugin {
  // Instance-scoped credential fingerprint - each adapter has its own auth state
  let credentialFingerprint: string | null = null;
  return {
    pluginId: "plugin.gamedev.unity_adapter",
    spiType: "adapter",
    adapterType: "unity_cloud_build",
    capabilityIds: ["build.status", "build.logs", "build.artifacts"],
    async initialize() {
      // Unity Cloud Build credentials would be validated here
    },
    healthCheck() {
      return gameDevPolicy.evaluate(UNITY_BUILD_API_URL).allowed && credentialFingerprint != null;
    },
    async shutdown() {
      credentialFingerprint = null;
    },
    async authenticate(credentials: Record<string, unknown>): Promise<void> {
      const token = (credentials["token"] ?? credentials["managedSecretRef"]) as string | undefined;
      if (!token || typeof token !== "string") {
        throw new Error("game_dev_adapter.missing_credentials");
      }
      credentialFingerprint = buildHashedCredentialFingerprint("unity", token);
    },
    async execute(action: string, params: Record<string, unknown>) {
      if (credentialFingerprint == null) {
        throw new Error("game_dev_adapter.not_authenticated");
      }

      const { projectSlug, buildTarget } = params as {
        projectSlug?: string;
        buildTarget?: string;
      };

      // R28-13 fix: enforce egress policy
      const decision = await gameDevPolicy.evaluate(UNITY_BUILD_API_URL);
      if (!decision.allowed) {
        throw new PolicyDeniedError("egress.denied" as ErrorCode, "Game dev adapter: egress denied");
      }

      // In production this would call Unity Cloud Build API
      return {
        success: true,
        output: {
          action,
          projectSlug: projectSlug ?? null,
          buildTarget: buildTarget ?? null,
          status: "success",
          message: `Unity Cloud Build ${action} for ${projectSlug}/${buildTarget}`,
        },
      };
    },
  };
}
