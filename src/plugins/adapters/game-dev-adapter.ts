/**
 * Game Dev Unity Cloud Build adapter plugin.
 *
 * Integrates with Unity Cloud Build to retrieve build status, logs, and artifacts.
 *
 * §G8: Game Dev domain adapter — M2 Phase 3.
 */

import type { ExternalAdapterPlugin } from "../../domains/registry/plugin-spi.js";
import { PolicyDeniedError, type ErrorCode } from "../../platform/contracts/errors.js";
import { NetworkEgressPolicyService } from "../../platform/control-plane/iam/network-egress-policy.js";

// R28-13 fix: add auth check and egress policy to game-dev-adapter
let credentialFingerprint: string | null = null;
const gameDevPolicy = new NetworkEgressPolicyService({
  mode: "enforce",
  allowedDomains: ["build-api.unity.com"],
});

export function createGameDevAdapterPlugin(): ExternalAdapterPlugin {
  return {
    pluginId: "plugin.gamedev.unity_adapter",
    spiType: "adapter",
    adapterType: "unity_cloud_build",
    capabilityIds: ["build.status", "build.logs", "build.artifacts"],
    async initialize() {
      // Unity Cloud Build credentials would be validated here
    },
    async healthCheck() {
      return gameDevPolicy.evaluate("https://build-api.unity.com").allowed;
    },
    async shutdown() {
      credentialFingerprint = null;
    },
    async authenticate(credentials: Record<string, unknown>): Promise<void> {
      const token = (credentials["token"] ?? credentials["managedSecretRef"]) as string | undefined;
      if (!token || typeof token !== "string") {
        throw new Error("game_dev_adapter.missing_credentials");
      }
      credentialFingerprint = `unity_${token.slice(0, 8)}`;
    },
    async execute(action: string, params: Record<string, unknown>) {
      // R28-13 fix: enforce auth check
      if (credentialFingerprint === null) {
        throw new Error("game_dev_adapter.not_authenticated");
      }

      const { projectSlug, buildTarget } = params as {
        projectSlug?: string;
        buildTarget?: string;
      };

      // R28-13 fix: enforce egress policy
      const allowed = gameDevPolicy.evaluate("https://build-api.unity.com").allowed;
      if (!allowed) {
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
