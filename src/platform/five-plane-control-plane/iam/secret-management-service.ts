/**
 * Secret Management Service
 */

export * from "./secret-management-support.js";

import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import { ValidationError, StorageError, PolicyDeniedError, ProviderError } from "../../contracts/errors.js";
import { nowIso, newId } from "../../contracts/types/ids.js";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 200 });
import type {
  SecretLeaseRecord,
  SecretProviderKind,
  SecretRegistryRecord,
  SecretRotationEventRecord,
  SecretUsageAuditRecord,
  SecretVersionRecord,
} from "../../contracts/types/domain.js";
import {
  EnvironmentBackedManagedSecretProvider,
  HybridManagedSecretProvider,
  assertEnum,
  assertNonEmpty,
  computeLeaseExpiry,
  computeNextRotationDueAt,
  createDefaultProviders,
  normalizeLeaseStatus,
  normalizeRotationPolicy,
  toJson,
  type IssueSecretLeaseInput,
  type ManagedSecretDescription,
  type ManagedSecretLease,
  type ManagedSecretProvider,
  type ManagedSecretResolution,
  type ManagedSecretValue,
  type RecordSecretRotationInput,
  type ResolveManagedSecretInput,
  type RevokeSecretLeaseInput,
  type SecretAuditSummary,
  type SecretAuthorizationContext,
  type SecretManagementServiceOptions,
  type SecretRegistryInput,
  type SecretRotationPolicy,
} from "./secret-management-support.js";

/**
 * R12-21: Rate limiter for secret resolution operations.
 * Prevents abuse by limiting the number of secret resolutions per time window.
 */
class SecretResolutionRateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly requests: Map<string, number[]> = new Map();

  constructor(windowMs = 60_000, maxRequests = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * R12-21: Check if a caller is within rate limits.
   * @returns true if allowed, false if rate limited
   */
  check(callerId: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const timestamps = this.requests.get(callerId) ?? [];
    const validTimestamps = timestamps.filter((t) => t > windowStart);

    if (validTimestamps.length >= this.maxRequests) {
      this.requests.set(callerId, validTimestamps);
      return false;
    }

    validTimestamps.push(now);
    this.requests.set(callerId, validTimestamps);
    return true;
  }
}

type RotationSchedulerPhase = "initial" | "interval";

function sanitizeMetadataRecord(value: unknown): Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const safe: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue;
    }
    safe[key] = entry;
  }
  return safe;
}

function parseRotationPolicyOrThrow(secretRef: string, raw: string): SecretRotationPolicy {
  try {
    return normalizeRotationPolicy(JSON.parse(raw) as SecretRotationPolicy);
  } catch {
    throw new ValidationError(`secret.invalid_rotation_policy:${secretRef}`, `secret.invalid_rotation_policy:${secretRef}`, {
      source: "provider",
      details: { secretRef },
    });
  }
}

function buildSchedulerSummary(events: readonly SecretRotationEventRecord[]): {
  count: number;
  secretRefsDigest: string[];
  scopeRefsDigest: string[];
} {
  const secretRefsDigest = [...new Set(events.map((event) => event.secretRef))].sort().slice(0, 10);
  const scopeRefsDigest = secretRefsDigest.map((secretRef) => {
    const normalized = secretRef.replace(/^secret:\/\//, "");
    return normalized.split("/").slice(0, -1).join("/") || normalized;
  });
  return {
    count: events.length,
    secretRefsDigest,
    scopeRefsDigest,
  };
}

export class SecretManagementService {
  private readonly providers: Record<SecretProviderKind, ManagedSecretProvider>;
  private readonly rateLimiter = new SecretResolutionRateLimiter();
  private readonly activeRotationSchedulers = new Set<NodeJS.Timeout>();

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
    options: SecretManagementServiceOptions = {},
  ) {
    this.providers = {
      ...createDefaultProviders(options.providerEnv),
      ...(options.providers ?? {}),
    };
  }

  /**
   * Registers a new secret in the registry.
   *
   * @param input - Secret registration details
   * @returns The created registry record
   */
  public registerSecret(input: SecretRegistryInput): SecretRegistryRecord {
    return this.db.transaction(() => {
      const createdAt = input.createdAt ?? nowIso();
      const normalizedStatus = (input.status ?? "active") as string;
      const status = assertEnum(normalizedStatus, ["active", "rotating", "disabled", "revoked"], "secret.invalid_status");
      const category = assertEnum(
        input.category,
        [
          "provider_api_key",
          "tenant_credential",
          "oauth_client_secret",
          "signing_key",
          "db_connection_secret",
          "break_glass_secret",
        ],
        "secret.invalid_category",
      );
      const providerKind = assertEnum(input.providerKind, ["environment", "vault", "kms", "secret_manager"], "secret.invalid_provider_kind");
      const scopeType = assertEnum(input.scopeType, ["system", "tenant", "workspace", "worker"], "secret.invalid_scope_type");
      const rotationPolicy = normalizeRotationPolicy(input.rotationPolicy);
      const lastRotatedAt = input.lastRotatedAt ?? null;
      const nextRotationDueAt = input.nextRotationDueAt ?? computeNextRotationDueAt(lastRotatedAt, rotationPolicy);
      const existing = this.store.secret.getSecretRegistryRecord(input.secretRef);
      const record: SecretRegistryRecord = {
        secretRef: assertNonEmpty(input.secretRef, "secret.invalid_ref"),
        displayName: assertNonEmpty(input.displayName, "secret.invalid_display_name"),
        category,
        providerKind,
        scopeType,
        scopeRef: assertNonEmpty(input.scopeRef, "secret.invalid_scope_ref"),
        status,
        rotationPolicyJson: JSON.stringify(rotationPolicy),
        metadataJson: toJson(input.metadata),
        currentVersion: input.currentVersion?.trim() || null,
        lastRotatedAt,
        nextRotationDueAt,
        createdAt: existing?.createdAt ?? createdAt,
        updatedAt: createdAt,
      };
      this.store.secret.upsertSecretRegistryRecord(record);
      if (record.currentVersion != null) {
        this.store.secret.upsertSecretVersionRecord({
          secretRef: record.secretRef,
          version: record.currentVersion,
          status: "active",
          createdAt: record.lastRotatedAt ?? createdAt,
          rotatedAt: record.lastRotatedAt,
          metadataJson: null,
        });
      }
      return record;
    });
  }

  /**
   * R12-22: Authorization check for secret resolution.
   * Verifies that the caller's scope matches the secret's access scope.
   *
   * @param registry - The secret registry record
   * @param callerScopeType - Scope type of the caller
   * @param callerScopeRef - Scope reference of the caller
   * @throws PolicyDeniedError if authorization check fails
   */
  private checkSecretAuthorization(
    registry: SecretRegistryRecord,
    callerScopeType: string,
    callerScopeRef: string,
  ): void {
    // System-scoped secrets are accessible only by system-level callers
    if (registry.scopeType === "system") {
      if (callerScopeType !== "system") {
        throw new PolicyDeniedError(
          `secret.unauthorized_scope:${registry.secretRef}`,
          `secret.unauthorized_scope:${registry.secretRef}`,
          {
            details: {
              secretRef: registry.secretRef,
              secretScopeType: registry.scopeType,
              callerScopeType,
            },
          },
        );
      }
      return;
    }

    // Tenant-scoped secrets require caller to be in the same tenant
    if (registry.scopeType === "tenant") {
      if (callerScopeType !== "tenant" || callerScopeRef !== registry.scopeRef) {
        throw new PolicyDeniedError(
          `secret.unauthorized_scope:${registry.secretRef}`,
          `secret.unauthorized_scope:${registry.secretRef}`,
          {
            details: {
              secretRef: registry.secretRef,
              secretScopeType: registry.scopeType,
              secretScopeRef: registry.scopeRef,
              callerScopeType,
              callerScopeRef,
            },
          },
        );
      }
      return;
    }

    // Workspace-scoped secrets require caller to be in the same workspace
    if (registry.scopeType === "workspace") {
      if (callerScopeType !== "workspace" || callerScopeRef !== registry.scopeRef) {
        throw new PolicyDeniedError(
          `secret.unauthorized_scope:${registry.secretRef}`,
          `secret.unauthorized_scope:${registry.secretRef}`,
          {
            details: {
              secretRef: registry.secretRef,
              secretScopeType: registry.scopeType,
              secretScopeRef: registry.scopeRef,
              callerScopeType,
              callerScopeRef,
            },
          },
        );
      }
      return;
    }

    // Worker-scoped secrets require exact worker match
    if (registry.scopeType === "worker") {
      if (callerScopeType !== "worker" || callerScopeRef !== registry.scopeRef) {
        throw new PolicyDeniedError(
          `secret.unauthorized_scope:${registry.secretRef}`,
          `secret.unauthorized_scope:${registry.secretRef}`,
          {
            details: {
              secretRef: registry.secretRef,
              secretScopeType: registry.scopeType,
              secretScopeRef: registry.scopeRef,
              callerScopeType,
              callerScopeRef,
            },
          },
        );
      }
      return;
    }

    // Default deny for unknown scope types
    throw new PolicyDeniedError(
      `secret.unauthorized_scope:${registry.secretRef}`,
      `secret.unauthorized_scope:${registry.secretRef}`,
      {
        details: {
          secretRef: registry.secretRef,
          secretScopeType: registry.scopeType,
          reason: "unknown_scope_type",
        },
      },
    );
  }

  /**
   * Resolves a secret and records the usage.
   *
   * @param input - Resolution request
   * @param authContext - Authorization context with caller's scope (required for R12-22)
   * @returns The secret value with audit record
   */
  public async resolveSecret(
    input: ResolveManagedSecretInput,
    authContext?: SecretAuthorizationContext,
  ): Promise<ManagedSecretResolution> {
    const callerId = assertNonEmpty(input.requestedBy, "secret.invalid_requested_by");
    const rateLimitKey = authContext == null
      ? callerId
      : [
          authContext.callerScopeType,
          authContext.callerScopeRef,
          callerId,
        ].join(":");
    if (!this.rateLimiter.check(rateLimitKey)) {
      throw new PolicyDeniedError("secret.rate_limited", "secret.rate_limited", {
        details: { callerId: rateLimitKey, windowMs: 60_000, maxRequests: 100 },
      });
    }

    return this.db.transaction(async () => {
      const registry = this.requireRegistryRecord(input.secretRef);
      if (registry.status === "disabled" || registry.status === "revoked") {
        throw new PolicyDeniedError(`secret.registry_unavailable:${registry.secretRef}:${registry.status}`, `secret.registry_unavailable:${registry.secretRef}:${registry.status}`, {
          details: { secretRef: registry.secretRef, status: registry.status },
        });
      }

      if (authContext == null) {
        throw new PolicyDeniedError(
          `secret.authorization_required:${registry.secretRef}`,
          `secret.authorization_required:${registry.secretRef}`,
          {
            details: { secretRef: registry.secretRef },
          },
        );
      }
      this.checkSecretAuthorization(registry, authContext.callerScopeType, authContext.callerScopeRef);

      // Resolve specific version or fall back to current version
      const versionToResolve = input.version ?? registry.currentVersion;
      if (versionToResolve == null) {
        throw new ProviderError(`secret.no_version:${registry.secretRef}`, `secret.no_version:${registry.secretRef}`, {
          details: { secretRef: registry.secretRef },
          retryable: false,
        });
      }

      // Verify the requested version exists and is accessible
      const versionRecord = this.store.secret.getSecretVersionRecord(registry.secretRef, versionToResolve);
      if (versionRecord == null) {
        throw new ProviderError(`secret.version_not_found:${registry.secretRef}:${versionToResolve}`, `secret.version_not_found:${registry.secretRef}:${versionToResolve}`, {
          details: { secretRef: registry.secretRef, version: versionToResolve },
          retryable: false,
        });
      }
      if (versionRecord.status !== "active") {
        throw new PolicyDeniedError(`secret.version_unavailable:${registry.secretRef}:${versionToResolve}:${versionRecord.status}`, `secret.version_unavailable:${registry.secretRef}:${versionToResolve}:${versionRecord.status}`, {
          details: { secretRef: registry.secretRef, version: versionToResolve },
        });
      }

      const provider = this.providers[registry.providerKind];
      if (provider == null) {
        throw new ProviderError(`secret.provider_not_registered:${registry.providerKind}`, `secret.provider_not_registered:${registry.providerKind}`, {
          details: { providerKind: registry.providerKind },
          retryable: false,
        });
      }
      const value = await provider.requireSecret(registry.secretRef);
      const usageAudit: SecretUsageAuditRecord = {
        auditId: newId("secret_audit"),
        secretRef: registry.secretRef,
        providerKind: registry.providerKind,
        taskId: input.taskId ?? null,
        executionId: input.executionId ?? null,
        requestedBy: assertNonEmpty(input.requestedBy, "secret.invalid_requested_by"),
        grantedTo: assertNonEmpty(input.grantedTo, "secret.invalid_granted_to"),
        usagePurpose: assertNonEmpty(input.usagePurpose, "secret.invalid_usage_purpose"),
        resolvedAt: nowIso(),
        expiresAt: input.expiresAt ?? null,
        maskedValue: value.maskedValue,
        metadataJson: toJson(input.metadata),
      };
      this.store.secret.insertSecretUsageAudit(usageAudit);
      const { value: _secretValue, ...providerMetadata } = value;
      return {
        metadata: {
          ...providerMetadata,
          providerKind: registry.providerKind,
          registryStatus: registry.status,
          lastRotatedAt: registry.lastRotatedAt,
          nextRotationDueAt: registry.nextRotationDueAt,
          auditId: usageAudit.auditId,
          resolvedVersion: versionToResolve,
        },
        value: value.value,
        registry,
        usageAudit,
      };
    });
  }

  /**
   * Requires a secret value, throwing if not available.
   *
   * @param secretRef - Secret reference
   * @param authContext - Authorization context with caller's scope (required for R12-22)
   * @returns The secret value with metadata
   * @throws PolicyDeniedError if authorization check fails or secret is unavailable
   */
  public async requireSecret(
    secretRef: string,
    authContext?: SecretAuthorizationContext,
  ): Promise<ManagedSecretValue> {
    const registry = this.requireRegistryRecord(secretRef);
    if (registry.status === "disabled" || registry.status === "revoked") {
      throw new PolicyDeniedError(`secret.registry_unavailable:${registry.secretRef}:${registry.status}`, `secret.registry_unavailable:${registry.secretRef}:${registry.status}`, {
        details: { secretRef: registry.secretRef, status: registry.status },
      });
    }

    if (authContext == null) {
      throw new PolicyDeniedError(
        `secret.authorization_required:${registry.secretRef}`,
        `secret.authorization_required:${registry.secretRef}`,
        {
          details: { secretRef: registry.secretRef },
        },
      );
    }
    this.checkSecretAuthorization(registry, authContext.callerScopeType, authContext.callerScopeRef);

    const provider = this.providers[registry.providerKind];
    if (provider == null) {
      throw new ProviderError(`secret.provider_not_registered:${registry.providerKind}`, `secret.provider_not_registered:${registry.providerKind}`, {
        details: { providerKind: registry.providerKind },
        retryable: false,
      });
    }
    const value = await provider.requireSecret(registry.secretRef);
    const { value: secretValue, ...providerMetadata } = value;
    return {
      metadata: {
        ...providerMetadata,
        providerKind: registry.providerKind,
        registryStatus: registry.status,
        lastRotatedAt: registry.lastRotatedAt,
        nextRotationDueAt: registry.nextRotationDueAt,
        auditId: null,
      },
      value: secretValue,
      registry,
    };
  }

  /**
   * Describes a secret without returning the value.
   */
  public async describeSecret(secretRef: string): Promise<ManagedSecretDescription> {
    const registry = this.requireRegistryRecord(secretRef);
    if (registry.status === "disabled" || registry.status === "revoked") {
      throw new PolicyDeniedError(`secret.registry_unavailable:${registry.secretRef}:${registry.status}`, `secret.registry_unavailable:${registry.secretRef}:${registry.status}`, {
        details: { secretRef: registry.secretRef, status: registry.status },
      });
    }
    const provider = this.providers[registry.providerKind];
    if (provider == null) {
      throw new ProviderError(`secret.provider_not_registered:${registry.providerKind}`, `secret.provider_not_registered:${registry.providerKind}`, {
        details: { providerKind: registry.providerKind },
        retryable: false,
      });
    }
    const metadata = await provider.describeSecret(registry.secretRef);
    return {
      metadata: {
        ...metadata,
        providerKind: registry.providerKind,
        registryStatus: registry.status,
        lastRotatedAt: registry.lastRotatedAt,
        nextRotationDueAt: registry.nextRotationDueAt,
        auditId: null,
      },
      registry,
    };
  }

  /**
   * Records a secret rotation event.
   *
   * Rotation state machine:
   * - requested:     Creates new version record as "rotating", marks old current version
   *                 as "superseded" if a new version was specified
   * - completed:    Marks new version as "active", old version as "superseded"
   * - failed:       Marks new version as "disabled", old version stays "active"
   *
   * Old versions remain accessible until new version is confirmed active.
   */
  public recordRotationEvent(input: RecordSecretRotationInput): SecretRotationEventRecord {
    return this.db.transaction(() => {
      const registry = this.requireRegistryRecord(input.secretRef);
      const occurredAt = input.occurredAt ?? nowIso();
      const event: SecretRotationEventRecord = {
        eventId: newId("secret_rotation"),
        secretRef: registry.secretRef,
        providerKind: registry.providerKind,
        rotationMode: assertEnum(input.rotationMode, ["scheduled", "emergency"], "secret.invalid_rotation_mode"),
        status: assertEnum(input.status, ["requested", "completed", "failed"], "secret.invalid_rotation_status"),
        reasonCode: assertNonEmpty(input.reasonCode, "secret.invalid_rotation_reason_code"),
        requestedBy: assertNonEmpty(input.requestedBy, "secret.invalid_requested_by"),
        previousVersion: input.previousVersion?.trim() || null,
        nextVersion: input.nextVersion?.trim() || null,
        occurredAt,
        metadataJson: toJson(input.metadata),
      };
      this.store.secret.insertSecretRotationEvent(event);

      // Update registry status based on event
      if (event.status === "requested") {
        // Mark old current version as superseded when new rotation begins
        if (registry.currentVersion != null) {
          const oldVersionRecord: SecretVersionRecord = {
            secretRef: registry.secretRef,
            version: registry.currentVersion,
            status: "superseded",
            createdAt: registry.lastRotatedAt ?? registry.createdAt,
            rotatedAt: occurredAt,
            metadataJson: toJson({ supersededBy: input.nextVersion ?? event.eventId }),
          };
          this.store.secret.upsertSecretVersionRecord(oldVersionRecord);
        }

        // Create new version record as "rotating" if nextVersion specified
        if (input.nextVersion?.trim()) {
          const newVersionRecord: SecretVersionRecord = {
            secretRef: registry.secretRef,
            version: input.nextVersion.trim()!,
            status: "rotating",
            createdAt: occurredAt,
            rotatedAt: null,
            metadataJson: toJson({ rotationEventId: event.eventId }),
          };
          this.store.secret.upsertSecretVersionRecord(newVersionRecord);
        }

        this.store.secret.upsertSecretRegistryRecord({
          ...registry,
          status: "rotating",
          updatedAt: occurredAt,
        });
      } else if (event.status === "completed") {
        const policy = parseRotationPolicyOrThrow(registry.secretRef, registry.rotationPolicyJson);

        // Mark the new version as active
        if (event.nextVersion?.trim()) {
          const completedVersionRecord: SecretVersionRecord = {
            secretRef: registry.secretRef,
            version: event.nextVersion.trim()!,
            status: "active",
            createdAt: occurredAt,
            rotatedAt: occurredAt,
            metadataJson: null,
          };
          this.store.secret.upsertSecretVersionRecord(completedVersionRecord);
        }

        // Ensure old version is marked superseded
        if (registry.currentVersion != null && registry.currentVersion !== event.nextVersion?.trim()) {
          const oldVersionRecord: SecretVersionRecord = {
            secretRef: registry.secretRef,
            version: registry.currentVersion,
            status: "superseded",
            createdAt: registry.lastRotatedAt ?? registry.createdAt,
            rotatedAt: occurredAt,
            metadataJson: toJson({ supersededBy: event.nextVersion ?? event.eventId }),
          };
          this.store.secret.upsertSecretVersionRecord(oldVersionRecord);
        }

        this.store.secret.upsertSecretRegistryRecord({
          ...registry,
          status: "active",
          currentVersion: event.nextVersion ?? registry.currentVersion,
          lastRotatedAt: occurredAt,
          nextRotationDueAt: computeNextRotationDueAt(occurredAt, normalizeRotationPolicy(policy)),
          updatedAt: occurredAt,
        });
      } else if (event.status === "failed") {
        // Mark new version as disabled on failure, old version stays active
        if (event.nextVersion?.trim()) {
          const failedVersionRecord: SecretVersionRecord = {
            secretRef: registry.secretRef,
            version: event.nextVersion.trim()!,
            status: "disabled",
            createdAt: occurredAt,
            rotatedAt: null,
            metadataJson: toJson({ failedBy: event.eventId, reasonCode: event.reasonCode }),
          };
          this.store.secret.upsertSecretVersionRecord(failedVersionRecord);
        }

        // Revert registry status to active on failure
        this.store.secret.upsertSecretRegistryRecord({
          ...registry,
          status: "active",
          updatedAt: occurredAt,
        });
      }

      return event;
    });
  }

  /**
   * Lists secrets with rotation due.
   */
  public listRotationDueSecrets(asOf: string = nowIso()): SecretRegistryRecord[] {
    return this.store
      .listSecretRegistryRecords()
      .filter((record) => record.status === "active" && record.nextRotationDueAt != null && record.nextRotationDueAt <= asOf);
  }

  /**
   * Builds a complete audit summary for a secret.
   */
  public buildAuditSummary(secretRef: string, generatedAt: string = nowIso()): SecretAuditSummary {
    const registry = this.requireRegistryRecord(secretRef);
    return {
      registry,
      usageAudits: this.store.secret.listSecretUsageAuditsBySecretRef(secretRef),
      rotationEvents: this.store.secret.listSecretRotationEventsBySecretRef(secretRef),
      leases: this.listSecretLeases(secretRef, generatedAt),
      generatedAt,
      rotationDue: registry.nextRotationDueAt != null && registry.nextRotationDueAt <= generatedAt,
    };
  }

  /**
   * Refreshes provider-backed metadata for a registered secret.
   */
  public async refreshSecret(secretRef: string): Promise<ManagedSecretDescription> {
    const registry = this.requireRegistryRecord(secretRef);
    if (registry.status === "disabled" || registry.status === "revoked") {
      throw new PolicyDeniedError(`secret.registry_unavailable:${registry.secretRef}:${registry.status}`, `secret.registry_unavailable:${registry.secretRef}:${registry.status}`, {
        details: { secretRef: registry.secretRef, status: registry.status },
      });
    }
    const provider = this.providers[registry.providerKind];
    if (provider == null) {
      throw new ProviderError(`secret.provider_not_registered:${registry.providerKind}`, `secret.provider_not_registered:${registry.providerKind}`, {
        details: { providerKind: registry.providerKind },
        retryable: false,
      });
    }
    const metadata = provider.refreshSecret == null
      ? await provider.describeSecret(registry.secretRef)
      : await provider.refreshSecret(registry.secretRef) ?? await provider.describeSecret(registry.secretRef);
    return {
      metadata: {
        ...(metadata ?? await provider.describeSecret(registry.secretRef)),
        providerKind: registry.providerKind,
        registryStatus: registry.status,
        lastRotatedAt: registry.lastRotatedAt,
        nextRotationDueAt: registry.nextRotationDueAt,
        auditId: null,
      },
      registry,
    };
  }

  /**
   * Marks all due secrets as rotation-requested.
   */
  public requestDueRotations(asOf: string = nowIso(), requestedBy: string): SecretRotationEventRecord[] {
    const actor = assertNonEmpty(requestedBy, "secret.invalid_requested_by");
    const dueSecrets = this.listRotationDueSecrets(asOf);
    return dueSecrets.map((registry) => this.recordRotationEvent({
      secretRef: registry.secretRef,
      rotationMode: "scheduled",
      status: "requested",
      reasonCode: "secret.rotation_due",
      requestedBy: actor,
      previousVersion: registry.currentVersion,
      occurredAt: asOf,
    }));
  }

  /**
   * Starts a daily scheduler that checks for secrets due for rotation.
   *
   * §23: Daily scheduler for 90-day secret rotation.
   * Uses a simple interval check to trigger rotation requests for secrets
   * whose nextRotationDueAt has passed.
   *
   * @param intervalMs - Check interval in milliseconds (default 24 hours)
   * @returns A timer handle that can be used to stop the scheduler
   */
  public startDailyRotationScheduler(intervalMs: number = 24 * 60 * 60 * 1000): NodeJS.Timeout {
    const runRotationSweep = (phase: RotationSchedulerPhase, timer?: NodeJS.Timeout): void => {
      try {
        const asOf = nowIso();
        const rotated = this.requestDueRotations(asOf, "system.rotation.scheduler");
        if (rotated.length > 0) {
          const summary = buildSchedulerSummary(rotated);
          logger.info(phase === "initial" ? "secret.rotation.scheduled_initial" : "secret.rotation.scheduled", {
            ...summary,
            asOf,
            requestedBy: "system.rotation.scheduler",
          });
        }
      } catch (err) {
        if (timer != null) {
          clearInterval(timer);
          this.activeRotationSchedulers.delete(timer);
        }
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.error(phase === "initial" ? "secret.rotation.initial_check_error" : "secret.rotation.scheduler_error", {
          err: errorMessage,
          phase,
          schedulerStopped: phase === "interval",
        });
        if (phase === "initial") {
          throw err;
        }
      }
    };

    for (const timer of this.activeRotationSchedulers) {
      clearInterval(timer);
      this.activeRotationSchedulers.delete(timer);
    }

    runRotationSweep("initial");

    const rotationInterval = setInterval(() => {
      runRotationSweep("interval", rotationInterval);
    }, intervalMs);
    rotationInterval.unref?.();
    this.activeRotationSchedulers.add(rotationInterval);
    return rotationInterval;
  }

  public stopDailyRotationSchedulers(): void {
    for (const timer of this.activeRotationSchedulers) {
      clearInterval(timer);
      this.activeRotationSchedulers.delete(timer);
    }
  }

  /**
   * Issues a time-limited lease for a secret.
   */
  public async issueSecretLease(
    input: IssueSecretLeaseInput,
    authContext?: SecretAuthorizationContext | null,
  ): Promise<ManagedSecretLease> {
    const registry = this.requireRegistryRecord(input.secretRef);
    if (registry.status === "disabled" || registry.status === "revoked") {
      throw new PolicyDeniedError(`secret.registry_unavailable:${registry.secretRef}:${registry.status}`, `secret.registry_unavailable:${registry.secretRef}:${registry.status}`, {
        details: { secretRef: registry.secretRef, status: registry.status },
      });
    }

    if (authContext != null) {
      this.checkSecretAuthorization(registry, authContext.callerScopeType, authContext.callerScopeRef);
    }

    const provider = this.providers[registry.providerKind];
    if (provider == null) {
      throw new ProviderError(`secret.provider_not_registered:${registry.providerKind}`, `secret.provider_not_registered:${registry.providerKind}`, {
        details: { providerKind: registry.providerKind },
        retryable: false,
      });
    }

    // Fetch secret from provider before transaction
    const providerIssuedLease = await provider.issueSecretLease?.(registry.secretRef) ?? null;
    const value = providerIssuedLease ?? await provider.requireSecret(registry.secretRef);

    return this.db.transaction(() => {
      const issuedAt = nowIso();
      const policy = parseRotationPolicyOrThrow(registry.secretRef, registry.rotationPolicyJson);
      const explicitExpiresAt = input.expiresAt?.trim() || null;
      let expiresAt: string | null = providerIssuedLease?.expiresAt ?? explicitExpiresAt;

      // Compute expiration if not specified
      if (providerIssuedLease == null && expiresAt == null) {
        const ttlMinutes = input.ttlMinutes ?? policy.ttlMinutes;
        if (ttlMinutes == null) {
          throw new ValidationError(`secret.lease_ttl_required:${registry.secretRef}`, `secret.lease_ttl_required:${registry.secretRef}`, {
            source: "provider",
            details: { secretRef: registry.secretRef },
          });
        }
        const normalizedTtl = Math.max(1, Math.trunc(ttlMinutes));
        expiresAt = computeLeaseExpiry(issuedAt, normalizedTtl);
      }

      if (expiresAt == null) {
        throw new ValidationError(`secret.invalid_lease_expiry:${registry.secretRef}`, `secret.invalid_lease_expiry:${registry.secretRef}`, {
          source: "provider",
          details: { secretRef: registry.secretRef },
        });
      }
      if (Date.parse(expiresAt) <= Date.parse(issuedAt)) {
        throw new ValidationError(`secret.invalid_lease_expiry:${registry.secretRef}`, `secret.invalid_lease_expiry:${registry.secretRef}`, {
          source: "provider",
          details: { secretRef: registry.secretRef, issuedAt, expiresAt },
        });
      }

      // Create lease record
      const lease: SecretLeaseRecord = {
        leaseId: newId("secret_lease"),
        secretRef: registry.secretRef,
        providerKind: registry.providerKind,
        taskId: input.taskId ?? null,
        executionId: input.executionId ?? null,
        requestedBy: assertNonEmpty(input.requestedBy, "secret.invalid_requested_by"),
        grantedTo: assertNonEmpty(input.grantedTo, "secret.invalid_granted_to"),
        usagePurpose: assertNonEmpty(input.usagePurpose, "secret.invalid_usage_purpose"),
        issuedAt,
        expiresAt,
        status: "active",
        revokedAt: null,
        revokedBy: null,
        revocationReasonCode: null,
        sourceVersion: registry.currentVersion,
        maskedValue: value.maskedValue,
        metadataJson: toJson({
          ...(input.metadata ?? {}),
          ...(providerIssuedLease == null
            ? {}
            : {
                leaseSource: "provider_issued",
                providerLeaseId: providerIssuedLease.leaseId,
                renewable: providerIssuedLease.renewable,
                issuedBy: providerIssuedLease.issuedBy,
              }),
        }),
      };
      this.store.secret.upsertSecretLeaseRecord(lease);

      const { value: secretValue, ...providerMetadata } = value;
      return {
        lease,
        metadata: {
          ...providerMetadata,
          providerKind: registry.providerKind,
          registryStatus: registry.status,
          lastRotatedAt: registry.lastRotatedAt,
          nextRotationDueAt: registry.nextRotationDueAt,
          auditId: null,
          leaseId: lease.leaseId,
          leaseStatus: lease.status,
          leaseSource: providerIssuedLease == null ? "wrapped_secret" : "provider_issued",
          providerLeaseId: providerIssuedLease?.leaseId ?? null,
          issuedAt: lease.issuedAt,
          expiresAt: lease.expiresAt,
          revokedAt: lease.revokedAt,
          renewable: providerIssuedLease?.renewable ?? false,
          issuedBy: providerIssuedLease?.issuedBy ?? null,
        },
        value: secretValue,
        registry,
      };
    });
  }

  /**
   * Revokes a secret lease.
   */
  public revokeSecretLease(input: RevokeSecretLeaseInput): SecretLeaseRecord {
    return this.db.transaction(() => {
      const current = this.requireLeaseRecord(input.leaseId);
      const revokedAt = input.revokedAt ?? nowIso();
      const nextStatus = normalizeLeaseStatus(current, revokedAt);

      // Already expired - no action needed
      if (nextStatus === "expired") {
        const expired = {
          ...current,
          status: "expired" as const,
        };
        this.store.secret.upsertSecretLeaseRecord(expired);
        return expired;
      }

      // Already revoked
      if (current.status === "revoked") {
        return current;
      }

      const metadata = this.mergeMetadataJson(current.metadataJson, input.metadata);
      const revoked: SecretLeaseRecord = {
        ...current,
        status: "revoked",
        revokedAt,
        revokedBy: assertNonEmpty(input.revokedBy, "secret.invalid_revoked_by"),
        revocationReasonCode: assertNonEmpty(input.reasonCode, "secret.invalid_revocation_reason_code"),
        metadataJson: metadata,
      };
      this.store.secret.upsertSecretLeaseRecord(revoked);
      return revoked;
    });
  }

  /**
   * Lists leases for a secret, normalizing status.
   */
  public listSecretLeases(secretRef: string, asOf: string = nowIso()): SecretLeaseRecord[] {
    this.requireRegistryRecord(secretRef);
    return this.store.secret.listSecretLeasesBySecretRef(secretRef).map((record) => {
      const normalizedStatus = normalizeLeaseStatus(record, asOf);
      if (normalizedStatus === record.status) {
        return record;
      }
      const updated = {
        ...record,
        status: normalizedStatus,
      };
      this.store.secret.upsertSecretLeaseRecord(updated);
      return updated;
    });
  }

  /**
   * Gets a registry record or throws.
   */
  private requireRegistryRecord(secretRef: string): SecretRegistryRecord {
    const registry = this.store.secret.getSecretRegistryRecord(secretRef);
    if (registry == null) {
      throw new StorageError(`secret.registry_not_found:${secretRef}`, `secret.registry_not_found:${secretRef}`, {
        details: { secretRef },
      });
    }
    return registry;
  }

  /**
   * Gets a lease record or throws.
   */
  private requireLeaseRecord(leaseId: string): SecretLeaseRecord {
    const lease = this.store.secret.getSecretLeaseRecord(leaseId);
    if (lease == null) {
      throw new StorageError(`secret.lease_not_found:${leaseId}`, `secret.lease_not_found:${leaseId}`, {
        details: { leaseId },
      });
    }
    return lease;
  }

  /**
   * Merges metadata JSON objects.
   */
  private mergeMetadataJson(
    current: string | null,
    next: Record<string, unknown> | null | undefined,
  ): string | null {
    if (next == null) {
      return current;
    }
    let parsed: unknown = {};
    if (current != null) {
      try {
        parsed = JSON.parse(current) as unknown;
      } catch {
        parsed = {};
      }
    }
    const currentValue = sanitizeMetadataRecord(parsed);
    const nextValue = sanitizeMetadataRecord(next);
    return JSON.stringify({
      ...currentValue,
      ...nextValue,
    });
  }
}
