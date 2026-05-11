// Worker Registration CLI Entry Point
// Handles remote worker registration with challenge-response authentication.
// Supports issuing registration challenges and completing worker registration with capabilities.

import { withCliStorage } from "./authoritative-storage.js";
import { loadWorkerRegisterCliEnv } from "../../platform/control-plane/config-center/remaining-cli-env.js";
import { ConfigGovernanceService } from "../../platform/control-plane/config-center/config-governance-service.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { RemoteWorkerRegistrationService } from "../../platform/execution/worker-pool/remote-worker-registration-service.js";
import { createWorkspaceWritePolicy } from "../../platform/control-plane/iam/sandbox-policy.js";

/**
 * Loads the worker registration policy from the config bundle.
 * Returns the challenge TTL and allowed capabilities for worker registration.
 *
 * @returns Object containing challengeTtlMs and allowedCapabilities
 */
function loadRegistrationPolicy(): { challengeTtlMs: number; allowedCapabilities: string[] } {
  const envConfig = loadWorkerRegisterCliEnv();
  const configRoot = envConfig.configRoot ?? undefined;
  const config = new ConfigGovernanceService(
    configRoot ? { configRoot, sandboxPolicy: createWorkspaceWritePolicy(configRoot) } : {},
  ).loadBundle("dev");
  const security = config.layers.security ?? {};
  const registration =
    security.remoteWorkerRegistration != null
    && typeof security.remoteWorkerRegistration === "object"
    && !Array.isArray(security.remoteWorkerRegistration)
      ? (security.remoteWorkerRegistration as Record<string, unknown>)
      : {};

  return {
    challengeTtlMs:
      typeof registration.challengeTtlMs === "number" && Number.isFinite(registration.challengeTtlMs)
        ? registration.challengeTtlMs
        : 300_000,
    allowedCapabilities: Array.isArray(registration.allowedCapabilities)
      ? registration.allowedCapabilities.filter((item): item is string => typeof item === "string")
      : ["edit", "mcp"],
  };
}

/**
 * Main entry point for the worker registration CLI.
 * Supports two actions: "issue" to create a registration challenge, and "complete"
 * to finalize worker registration with the challenge response.
 */
function main(): void {
  const envConfig = loadWorkerRegisterCliEnv();
  const policy = loadRegistrationPolicy();
  const output = withCliStorage((storage) => {
    const registration = new RemoteWorkerRegistrationService(storage.sql, storage.store, policy);
    switch (envConfig.action) {
      case "issue":
        return registration.issueChallenge({
          workerId: envConfig.workerId ?? "",
          requestedCapabilities: envConfig.capabilities,
          ...(envConfig.challengeTtlMs != null ? { ttlMs: envConfig.challengeTtlMs } : {}),
          ...(envConfig.occurredAt ? { occurredAt: envConfig.occurredAt } : {}),
        });
      case "complete":
        return registration.completeRegistration({
          workerId: envConfig.workerId ?? "",
          challengeId: envConfig.challengeId ?? "",
          challengeToken: envConfig.challengeToken ?? "",
          capabilities: envConfig.capabilities,
          maxConcurrency: envConfig.maxConcurrency ?? 0,
          queueAffinity: envConfig.queueAffinity,
          ...(envConfig.isolationLevel ? { isolationLevel: envConfig.isolationLevel } : {}),
          repoVersion: envConfig.repoVersion,
          ...(envConfig.runtimeInstanceId ? { runtimeInstanceId: envConfig.runtimeInstanceId } : {}),
          ...(envConfig.restartedFromRuntimeInstanceId
            ? { restartedFromRuntimeInstanceId: envConfig.restartedFromRuntimeInstanceId }
            : {}),
          ...(envConfig.remoteSessionStatus ? { remoteSessionStatus: envConfig.remoteSessionStatus } : {}),
          ...(envConfig.lastAcknowledgedStreamOffset != null
            ? { lastAcknowledgedStreamOffset: envConfig.lastAcknowledgedStreamOffset }
            : {}),
          ...(envConfig.sessionConsistencyCheckStatus ? { sessionConsistencyCheckStatus: envConfig.sessionConsistencyCheckStatus } : {}),
          ...(envConfig.sessionConsistencyCheckedAt
            ? { sessionConsistencyCheckedAt: envConfig.sessionConsistencyCheckedAt }
            : {}),
          ...(envConfig.workspaceSyncStatus ? { workspaceSyncStatus: envConfig.workspaceSyncStatus } : {}),
          ...(envConfig.workspaceSyncCheckedAt
            ? { workspaceSyncCheckedAt: envConfig.workspaceSyncCheckedAt }
            : {}),
          ...(envConfig.occurredAt ? { occurredAt: envConfig.occurredAt } : {}),
        });
      default:
        throw new ValidationError(`unknown_worker_register_action:${envConfig.action}`, `unknown_worker_register_action:${envConfig.action}`);
    }
  }, { dbPath: envConfig.dbPath });

  console.log(JSON.stringify(output, null, 2));
}

main();
