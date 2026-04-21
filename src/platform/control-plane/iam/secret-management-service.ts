/**
 * Secret Management Service
 */

export * from "./secret-management-support.js";

import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { ValidationError, StorageError, PolicyDeniedError, ProviderError } from "../../contracts/errors.js";
import { nowIso, newId } from "../../contracts/types/ids.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type {
  SecretLeaseRecord,
  SecretProviderKind,
  SecretRegistryRecord,
  SecretRotationEventRecord,
  SecretUsageAuditRecord,
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
  type SecretManagementServiceOptions,
  type SecretRegistryInput,
  type SecretRotationPolicy,
} from "./secret-management-support.js";

export class SecretManagementService {
  private readonly providers: Record<SecretProviderKind, ManagedSecretProvider>;

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
      return record;
    });
  }

  /**
   * Resolves a secret and records the usage.
   *
   * @param input - Resolution request
   * @returns The secret value with audit record
   */
  public async resolveSecret(input: ResolveManagedSecretInput): Promise<ManagedSecretResolution> {
    return this.db.transaction(async () => {
      const registry = this.requireRegistryRecord(input.secretRef);
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
        },
        value: value.value,
        registry,
        usageAudit,
      };
    });
  }

  /**
   * Requires a secret value, throwing if not available.
   */
  public async requireSecret(secretRef: string): Promise<ManagedSecretValue> {
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
        this.store.secret.upsertSecretRegistryRecord({
          ...registry,
          status: "rotating",
          updatedAt: occurredAt,
        });
      } else if (event.status === "completed") {
        const policy = JSON.parse(registry.rotationPolicyJson) as SecretRotationPolicy;
        this.store.secret.upsertSecretRegistryRecord({
          ...registry,
          status: "active",
          currentVersion: event.nextVersion ?? registry.currentVersion,
          lastRotatedAt: occurredAt,
          nextRotationDueAt: computeNextRotationDueAt(occurredAt, normalizeRotationPolicy(policy)),
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
    const metadata = await provider.refreshSecret?.(registry.secretRef) ?? await provider.describeSecret(registry.secretRef);
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
  public requestDueRotations(asOf: string = nowIso(), requestedBy: string = "system.rotation"): SecretRotationEventRecord[] {
    const dueSecrets = this.listRotationDueSecrets(asOf);
    return dueSecrets.map((registry) => this.recordRotationEvent({
      secretRef: registry.secretRef,
      rotationMode: "scheduled",
      status: "requested",
      reasonCode: "secret.rotation_due",
      requestedBy,
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
  public startDailyRotationScheduler(intervalMs: number = 24 * 60 * 60 * 1000): NodeJS.Timer {
    const rotationInterval = setInterval(() => {
      try {
        const asOf = nowIso();
        const rotated = this.requestDueRotations(asOf);
        if (rotated.length > 0) {
          console.log(`secret.rotation.scheduled`, {
            count: rotated.length,
            asOf,
            requestedBy: "system.rotation.scheduler",
          });
        }
      } catch (err) {
        console.error("secret.rotation.scheduler_error", {
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }, intervalMs);

    // Run immediately on start
    try {
      const asOf = nowIso();
      const rotated = this.requestDueRotations(asOf);
      if (rotated.length > 0) {
        console.log(`secret.rotation.scheduled_initial`, {
          count: rotated.length,
          asOf,
        });
      }
    } catch (err) {
      console.error("secret.rotation.initial_check_error", {
        err: err instanceof Error ? err.message : String(err),
      });
    }

    return rotationInterval;
  }

  /**
   * Issues a time-limited lease for a secret.
   */
  public async issueSecretLease(input: IssueSecretLeaseInput): Promise<ManagedSecretLease> {
    const registry = this.requireRegistryRecord(input.secretRef);
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

    // Fetch secret from provider before transaction
    const providerIssuedLease = await provider.issueSecretLease?.(registry.secretRef) ?? null;
    const value = providerIssuedLease ?? await provider.requireSecret(registry.secretRef);

    return this.db.transaction(() => {
      const issuedAt = nowIso();
      const policy = JSON.parse(registry.rotationPolicyJson) as SecretRotationPolicy;
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
    const parsed = current == null ? {} : (JSON.parse(current) as unknown);
    const currentValue =
      parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    return JSON.stringify({
      ...currentValue,
      ...next,
    });
  }
}
