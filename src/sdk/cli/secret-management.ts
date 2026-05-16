// Secret Management CLI Entry Point
// Provides secret lifecycle management: registration, resolution, rotation, leasing, and revocation.
// Supports audit reporting and rotation scheduling for credential management.

import { withCliStorageAsync } from "./authoritative-storage.js";
import { loadSecretManagementCliEnv } from "../../platform/five-plane-control-plane/config-center/remaining-cli-env.js";
import { ValidationError } from "../../platform/contracts/errors.js";
import { SecretManagementService } from "../../platform/five-plane-control-plane/iam/secret-management-service.js";

(async () => {
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
          category: (envConfig.category ?? "") as never,
          providerKind: (envConfig.providerKind ?? "") as never,
          scopeType: (envConfig.scopeType ?? "") as never,
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
        const authContext = envConfig.callerScopeType && envConfig.callerScopeRef
          ? { callerScopeType: envConfig.callerScopeType, callerScopeRef: envConfig.callerScopeRef }
          : undefined;
        const resolved = await service.resolveSecret({
          secretRef: envConfig.secretRef ?? "",
          requestedBy: envConfig.requestedBy ?? "",
          grantedTo: envConfig.grantedTo ?? "",
          usagePurpose: envConfig.usagePurpose ?? "",
          ...(envConfig.taskId ? { taskId: envConfig.taskId } : {}),
          ...(envConfig.executionId ? { executionId: envConfig.executionId } : {}),
          ...(envConfig.expiresAt ? { expiresAt: envConfig.expiresAt } : {}),
          ...(envConfig.usageMetadata ? { metadata: envConfig.usageMetadata } : {}),
        }, authContext);
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
          rotationMode: (envConfig.rotationMode ?? "") as never,
          status: (envConfig.rotationStatus ?? "") as never,
          reasonCode: envConfig.rotationReasonCode ?? "",
          requestedBy: envConfig.requestedBy ?? "",
          ...(envConfig.previousVersion ? { previousVersion: envConfig.previousVersion } : {}),
          ...(envConfig.nextVersion ? { nextVersion: envConfig.nextVersion } : {}),
          ...(envConfig.rotationMetadata ? { metadata: envConfig.rotationMetadata } : {}),
        });
        break;
      case "issue": {
        const authContext = envConfig.callerScopeType && envConfig.callerScopeRef
          ? { callerScopeType: envConfig.callerScopeType, callerScopeRef: envConfig.callerScopeRef }
          : undefined;
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
        }, authContext);
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
})();
