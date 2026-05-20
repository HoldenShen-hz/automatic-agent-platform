// Secret Management CLI Entry Point
// Provides secret lifecycle management: registration, resolution, rotation, leasing, and revocation.
// Supports audit reporting and rotation scheduling for credential management.

import { pathToFileURL } from "node:url";

import { withCliStorageAsync } from "./authoritative-storage.js";
import { CLI_EXIT_SUCCESS, runCliMain } from "./cli-exit.js";
import { loadSecretManagementCliEnv } from "../../platform/five-plane-control-plane/config-center/remaining-cli-env.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import type {
  SecretCategory,
  SecretProviderKind,
  SecretRotationEventStatus,
  SecretRotationMode,
  SecretScopeType,
} from "../../platform/contracts/types/domain.js";
import { SecretManagementService } from "../../platform/five-plane-control-plane/iam/secret-management-service.js";
import { assertEnum } from "../../platform/five-plane-control-plane/iam/secret-management-support.js";

const SECRET_CATEGORIES = [
  "provider_api_key",
  "tenant_credential",
  "oauth_client_secret",
  "signing_key",
  "db_connection_secret",
  "break_glass_secret",
] as const satisfies readonly SecretCategory[];
const SECRET_PROVIDER_KINDS = ["environment", "vault", "kms", "secret_manager"] as const satisfies readonly SecretProviderKind[];
const SECRET_SCOPE_TYPES = ["system", "tenant", "workspace", "worker"] as const satisfies readonly SecretScopeType[];
const SECRET_ROTATION_MODES = ["scheduled", "emergency"] as const satisfies readonly SecretRotationMode[];
const SECRET_ROTATION_STATUSES = ["requested", "completed", "failed"] as const satisfies readonly SecretRotationEventStatus[];

function buildSecretAuthorizationContext(envConfig: ReturnType<typeof loadSecretManagementCliEnv>) {
  return {
    callerScopeType: envConfig.callerScopeType ?? "system",
    callerScopeRef: envConfig.callerScopeRef ?? "system",
  };
}

export async function main(): Promise<number> {
  const envConfig = loadSecretManagementCliEnv();
  await withCliStorageAsync(async (storage) => {
    const service = new SecretManagementService(storage.sql, storage.store);

    let result: unknown;
    // Supported actions: register, resolve, rotate, issue, revoke, leases, due, request_due, refresh, summary
    switch (envConfig.action) {
      case "register":
        result = service.registerSecret({
          secretRef: envConfig.secretRef ?? "",
          displayName: envConfig.displayName ?? "",
          category: assertEnum(envConfig.category ?? "", SECRET_CATEGORIES, "secret.invalid_category"),
          providerKind: assertEnum(envConfig.providerKind ?? "", SECRET_PROVIDER_KINDS, "secret.invalid_provider_kind"),
          scopeType: assertEnum(envConfig.scopeType ?? "", SECRET_SCOPE_TYPES, "secret.invalid_scope_type"),
          scopeRef: envConfig.scopeRef ?? "",
          rotationPolicy: {
            cadenceDays: envConfig.rotationCadenceDays,
            ttlMinutes: envConfig.ttlMinutes,
            breakGlass: envConfig.breakGlass,
          },
          metadata: envConfig.metadata,
          ...(envConfig.currentVersion ? { currentVersion: envConfig.currentVersion } : {}),
        });
        break;
      case "resolve": {
        const resolved = await service.resolveSecret({
          secretRef: envConfig.secretRef ?? "",
          requestedBy: envConfig.requestedBy ?? "",
          grantedTo: envConfig.grantedTo ?? "",
          usagePurpose: envConfig.usagePurpose ?? "",
          ...(envConfig.taskId ? { taskId: envConfig.taskId } : {}),
          ...(envConfig.executionId ? { executionId: envConfig.executionId } : {}),
          ...(envConfig.expiresAt ? { expiresAt: envConfig.expiresAt } : {}),
          ...(envConfig.usageMetadata ? { metadata: envConfig.usageMetadata } : {}),
        }, buildSecretAuthorizationContext(envConfig));
        result = {
          metadata: resolved.metadata,
          registry: resolved.registry,
          usageAudit: resolved.usageAudit,
        };
        break;
      }
      case "rotate":
        result = service.recordRotationEvent({
          secretRef: envConfig.secretRef ?? "",
          rotationMode: assertEnum(envConfig.rotationMode ?? "", SECRET_ROTATION_MODES, "secret.invalid_rotation_mode"),
          status: assertEnum(envConfig.rotationStatus ?? "", SECRET_ROTATION_STATUSES, "secret.invalid_rotation_status"),
          reasonCode: envConfig.rotationReasonCode ?? "",
          requestedBy: envConfig.requestedBy ?? "",
          ...(envConfig.previousVersion ? { previousVersion: envConfig.previousVersion } : {}),
          ...(envConfig.nextVersion ? { nextVersion: envConfig.nextVersion } : {}),
          ...(envConfig.rotationMetadata ? { metadata: envConfig.rotationMetadata } : {}),
        });
        break;
      case "issue": {
        const issued = await service.issueSecretLease({
          secretRef: envConfig.secretRef ?? "",
          requestedBy: envConfig.requestedBy ?? "",
          grantedTo: envConfig.grantedTo ?? "",
          usagePurpose: envConfig.usagePurpose ?? "",
          ...(envConfig.leaseTtlMinutes != null ? { ttlMinutes: envConfig.leaseTtlMinutes } : {}),
          ...(envConfig.expiresAt ? { expiresAt: envConfig.expiresAt } : {}),
          ...(envConfig.taskId ? { taskId: envConfig.taskId } : {}),
          ...(envConfig.executionId ? { executionId: envConfig.executionId } : {}),
          ...(envConfig.usageMetadata ? { metadata: envConfig.usageMetadata } : {}),
        }, buildSecretAuthorizationContext(envConfig));
        result = {
          metadata: issued.metadata,
          registry: issued.registry,
          lease: issued.lease,
        };
        break;
      }
      case "revoke":
        result = service.revokeSecretLease({
          leaseId: envConfig.leaseId ?? "",
          revokedBy: envConfig.requestedBy ?? "",
          reasonCode: envConfig.revocationReasonCode ?? envConfig.rotationReasonCode ?? "",
          ...(envConfig.revokedAt ? { revokedAt: envConfig.revokedAt } : {}),
          ...(envConfig.usageMetadata ? { metadata: envConfig.usageMetadata } : {}),
        });
        break;
      case "leases":
        result = {
          generatedAt: new Date().toISOString(),
          leases: service.listSecretLeases(envConfig.secretRef ?? "", envConfig.asOf ?? undefined),
        };
        break;
      case "due":
        result = {
          generatedAt: new Date().toISOString(),
          dueSecrets: service.listRotationDueSecrets(envConfig.asOf ?? undefined),
        };
        break;
      case "request_due":
        result = {
          generatedAt: new Date().toISOString(),
          events: service.requestDueRotations(envConfig.asOf ?? undefined, envConfig.requestedBy ?? "system.rotation"),
        };
        break;
      case "refresh":
        result = await service.refreshSecret(envConfig.secretRef ?? "");
        break;
      case "summary":
        result = service.buildAuditSummary(envConfig.secretRef ?? "", envConfig.asOf ?? undefined);
        break;
      default:
        throw new ValidationError(`unsupported_secret_action:${envConfig.action}`, `unsupported_secret_action:${envConfig.action}`);
    }

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }, { dbPath: envConfig.dbPath });
  return CLI_EXIT_SUCCESS;
}

if (process.argv[1] != null && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void runCliMain(main, {
    onError: (error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    },
  });
}
