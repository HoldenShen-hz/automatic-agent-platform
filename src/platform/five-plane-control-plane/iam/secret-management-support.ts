/**
 * Secret Management Service
 *
 * Central service for managing secrets across multiple providers.
 * Provides unified access to secrets from environment variables, Vault, AWS KMS,
 * and GCP Secret Manager.
 *
 * ## Purpose
 *
 * - Unified secret access across multiple providers
 * - Secret registration and tracking in a registry
 * - Audit trail for secret usage
 * - Secret leasing with time-limited access
 * - Secret rotation tracking
 *
 * ## Providers
 *
 * The service coordinates multiple secret providers:
 * - Environment (env): Development, simple deployments
 * - Vault: Enterprise HashiCorp Vault deployments
 * - KMS: AWS KMS-encrypted secrets
 * - GCP Secret Manager: GCP-native deployments
 *
 * ## Usage
 *
 * 1. Register a secret: `registerSecret({ secretRef, category, ... })`
 * 2. Resolve when needed: `resolveSecret({ secretRef, requestedBy, ... })`
 * 3. Track usage in audit log
 * 4. Issue leases for time-limited access
 *
 * @see ManagedSecretProvider for the provider interface
 */

import {
  EnvSecretProvider,
  type SecretProviderIssuedLease,
  type SecretProviderMetadata,
  type ManagedSecretProvider,
} from "./env-secret-provider.js";
export type { ManagedSecretProvider } from "./env-secret-provider.js";
import { ExternalSecretProvider, ExternalSecretProviderAdapter } from "./external-secret-provider.js";
import { VaultHttpSecretProvider } from "./vault-http-secret-provider.js";
import { AwsKmsHttpSecretProvider } from "./aws-kms-http-secret-provider.js";
import { GcpSecretManagerHttpSecretProvider } from "./gcp-secret-manager-http-secret-provider.js";
import { PolicyDeniedError, ProviderError, StorageError, ValidationError } from "../../contracts/errors.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type {
  SecretCategory,
  SecretProviderKind,
  SecretRegistryRecord,
  SecretLeaseRecord,
  SecretLeaseStatus,
  SecretRotationEventRecord,
  SecretRotationEventStatus,
  SecretRotationMode,
  SecretScopeType,
  SecretStatus,
  SecretUsageAuditRecord,
} from "../../contracts/types/domain.js";
import { newId, nowIso } from "../../contracts/types/ids.js";

/**
 * Rotation policy for a registered secret.
 */
export interface SecretRotationPolicy {
  /** Days between scheduled rotations (null = no scheduled rotation) */
  cadenceDays: number | null;

  /** TTL for secret leases in minutes (null = no lease limit) */
  ttlMinutes: number | null;

  /** Whether break-glass access is permitted */
  breakGlass: boolean;
}

/**
 * Input for registering a new secret.
 */
export interface SecretRegistryInput {
  /** Secret reference (e.g., "secret://my-service/api-key") */
  secretRef: string;

  /** Human-readable display name */
  displayName: string;

  /** Category of the secret */
  category: SecretCategory;

  /** Provider kind for this secret */
  providerKind: SecretProviderKind;

  /** Scope type */
  scopeType: SecretScopeType;

  /** Scope reference */
  scopeRef: string;

  /** Rotation policy */
  rotationPolicy: SecretRotationPolicy;

  /** Additional metadata */
  metadata?: Record<string, unknown> | null;

  /** Current version identifier */
  currentVersion?: string | null;

  /** Initial status (defaults to active) */
  status?: SecretStatus;

  /** Creation timestamp (auto-generated if not provided) */
  createdAt?: string;

  /** Last rotation timestamp */
  lastRotatedAt?: string | null;

  /** Next scheduled rotation */
  nextRotationDueAt?: string | null;
}

/**
 * Input for resolving (retrieving) a secret.
 */
export interface ResolveManagedSecretInput {
  /** Secret reference to resolve */
  secretRef: string;

  /** ID of the entity requesting the secret */
  requestedBy: string;

  /** ID of the entity being granted access */
  grantedTo: string;

  /** Purpose description */
  usagePurpose: string;

  /** Associated task ID */
  taskId?: string | null;

  /** Associated execution ID */
  executionId?: string | null;

  /** When the secret access should expire */
  expiresAt?: string | null;

  /** Additional metadata */
  metadata?: Record<string, unknown> | null;
}

/**
 * Input for recording a rotation event.
 */
export interface RecordSecretRotationInput {
  /** Secret reference */
  secretRef: string;

  /** How rotation was triggered */
  rotationMode: SecretRotationMode;

  /** Status of the rotation event */
  status: SecretRotationEventStatus;

  /** Reason code */
  reasonCode: string;

  /** Who requested the rotation */
  requestedBy: string;

  /** Previous version identifier */
  previousVersion?: string | null;

  /** New version identifier */
  nextVersion?: string | null;

  /** Additional metadata */
  metadata?: Record<string, unknown> | null;

  /** When the rotation occurred */
  occurredAt?: string;
}

/**
 * Input for issuing a secret lease.
 */
export interface IssueSecretLeaseInput {
  /** Secret reference */
  secretRef: string;

  /** Who is requesting the lease */
  requestedBy: string;

  /** Who is being granted the lease */
  grantedTo: string;

  /** Purpose description */
  usagePurpose: string;

  /** TTL in minutes (overrides policy) */
  ttlMinutes?: number | null;

  /** Fixed expiration timestamp */
  expiresAt?: string | null;

  /** Associated task ID */
  taskId?: string | null;

  /** Associated execution ID */
  executionId?: string | null;

  /** Additional metadata */
  metadata?: Record<string, unknown> | null;
}

/**
 * Input for revoking a secret lease.
 */
export interface RevokeSecretLeaseInput {
  /** Lease ID to revoke */
  leaseId: string;

  /** Who is revoking the lease */
  revokedBy: string;

  /** Reason for revocation */
  reasonCode: string;

  /** When revocation occurred */
  revokedAt?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown> | null;
}

/**
 * Extended metadata for a managed secret.
 */
export interface ManagedSecretMetadata extends SecretProviderMetadata {
  /** Provider kind */
  providerKind: SecretProviderKind;

  /** Registry status */
  registryStatus: SecretStatus;

  /** Last rotation timestamp */
  lastRotatedAt: string | null;

  /** Next scheduled rotation */
  nextRotationDueAt: string | null;

  /** Audit trail ID */
  auditId: string | null;
}

/**
 * Result of resolving a secret.
 */
export interface ManagedSecretResolution {
  /** Secret metadata */
  metadata: ManagedSecretMetadata;

  /** The actual secret value */
  value: string;

  /** Registry record */
  registry: SecretRegistryRecord;

  /** Usage audit record */
  usageAudit: SecretUsageAuditRecord;
}

/**
 * Description of a secret without the value.
 */
export interface ManagedSecretDescription {
  /** Secret metadata */
  metadata: ManagedSecretMetadata;

  /** Registry record */
  registry: SecretRegistryRecord;
}

/**
 * Secret value result (includes value).
 */
export interface ManagedSecretValue {
  /** Secret metadata */
  metadata: ManagedSecretMetadata;

  /** The secret value */
  value: string;

  /** Registry record */
  registry: SecretRegistryRecord;
}

/**
 * Complete audit summary for a secret.
 */
export interface SecretAuditSummary {
  /** Registry record */
  registry: SecretRegistryRecord;

  /** Usage audit records */
  usageAudits: SecretUsageAuditRecord[];

  /** Rotation event records */
  rotationEvents: SecretRotationEventRecord[];

  /** Associated leases */
  leases: SecretLeaseRecord[];

  /** When the summary was generated */
  generatedAt: string;

  /** Whether rotation is currently due */
  rotationDue: boolean;
}

/**
 * A secret lease with metadata.
 */
export interface ManagedSecretLease {
  /** The lease record */
  lease: SecretLeaseRecord;

  /** Extended metadata including lease details */
  metadata: ManagedSecretMetadata & {
    leaseId: string;
    leaseStatus: SecretLeaseStatus;
    leaseSource: "provider_issued" | "wrapped_secret";
    providerLeaseId: string | null;
    issuedAt: string;
    expiresAt: string;
    revokedAt: string | null;
    renewable: boolean;
    issuedBy: string | null;
  };

  /** The secret value */
  value: string;

  /** Registry record */
  registry: SecretRegistryRecord;
}

/**
 * Configuration for the secret management service.
 */
export interface SecretManagementServiceOptions {
  /** Override specific providers */
  providers?: Partial<Record<SecretProviderKind, ManagedSecretProvider>>;

  /** Environment for provider configuration */
  providerEnv?: NodeJS.ProcessEnv;
}

/**
 * Validates that a string is non-empty.
 */
export function assertNonEmpty(value: string, code: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new ValidationError(code, code, {
      source: "provider",
    });
  }
  return normalized;
}

/**
 * Validates that a value is one of the allowed enum values.
 */
export function assertEnum<T extends string>(value: string, allowed: readonly T[], code: string): T {
  if ((allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new ValidationError(code, code, {
    source: "provider",
    details: { value, allowed },
  });
}

/**
 * Converts an object to JSON string or null.
 */
export function toJson(value: Record<string, unknown> | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  return JSON.stringify(value);
}

/**
 * Normalizes a rotation policy with validation.
 */
export function normalizeRotationPolicy(input: SecretRotationPolicy): SecretRotationPolicy {
  const cadenceDays = input.cadenceDays == null ? 90 : Math.max(1, Math.trunc(input.cadenceDays));
  const ttlMinutes = input.ttlMinutes == null ? null : Math.max(1, Math.trunc(input.ttlMinutes));
  return {
    cadenceDays,
    ttlMinutes,
    breakGlass: input.breakGlass === true,
  };
}

/**
 * Computes the next rotation timestamp based on policy.
 */
export function computeNextRotationDueAt(lastRotatedAt: string | null, policy: SecretRotationPolicy): string | null {
  if (policy.cadenceDays == null) {
    return null;
  }
  const anchor = lastRotatedAt == null ? new Date() : new Date(lastRotatedAt);
  if (Number.isNaN(anchor.valueOf())) {
    return null;
  }
  const next = new Date(anchor.valueOf() + policy.cadenceDays * 24 * 60 * 60 * 1000);
  return next.toISOString();
}

/**
 * Computes lease expiration timestamp.
 */
export function computeLeaseExpiry(issuedAt: string, ttlMinutes: number): string {
  const issued = new Date(issuedAt);
  if (Number.isNaN(issued.valueOf())) {
    throw new ValidationError("secret.invalid_lease_issued_at", "secret.invalid_lease_issued_at", {
      source: "provider",
      details: { issuedAt },
    });
  }
  return new Date(issued.valueOf() + ttlMinutes * 60 * 1000).toISOString();
}

/**
 * Normalizes lease status considering expiration time.
 */
export function normalizeLeaseStatus(record: SecretLeaseRecord, asOf: string): SecretLeaseStatus {
  if (record.status !== "active") {
    return record.status;
  }
  return record.expiresAt <= asOf ? "expired" : "active";
}

/**
 * Adapter for environment-based provider.
 */
export class EnvironmentBackedManagedSecretProvider implements ManagedSecretProvider {
  public constructor(
    public readonly providerKind: SecretProviderKind,
    private readonly provider: EnvSecretProvider,
  ) {}

  public async describeSecret(secretRef: string): Promise<SecretProviderMetadata> {
    return this.provider.describeSecret(secretRef);
  }

  public async requireSecret(secretRef: string): Promise<SecretProviderMetadata & { value: string }> {
    return this.provider.requireSecret(secretRef);
  }
}

/**
 * Hybrid provider that tries primary, falls back to secondary.
 */
export class HybridManagedSecretProvider implements ManagedSecretProvider {
  public constructor(
    public readonly providerKind: SecretProviderKind,
    private readonly primaryProvider: ManagedSecretProvider & { isConfigured?: () => boolean },
    private readonly fallbackProvider: ManagedSecretProvider,
  ) {}

  private isPrimaryConfigured(): boolean {
    if (typeof this.primaryProvider.isConfigured === "function") {
      return this.primaryProvider.isConfigured();
    }
    switch (this.providerKind) {
      case "vault":
        return (this.primaryProvider as { env?: NodeJS.ProcessEnv }).env?.["AA_VAULT_ADDR"] != null
          || (this.primaryProvider as { env?: NodeJS.ProcessEnv }).env?.["AA_VAULT_SECRETS_JSON"] != null;
      case "kms": return (this.primaryProvider as { env?: NodeJS.ProcessEnv }).env?.["AA_AWS_ACCESS_KEY_ID"] != null;
      case "secret_manager": return (this.primaryProvider as { env?: NodeJS.ProcessEnv }).env?.["AA_GCP_PROJECT_ID"] != null;
      default: return false;
    }
  }

  public async describeSecret(secretRef: string): Promise<SecretProviderMetadata> {
    if (this.isPrimaryConfigured()) {
      return await this.primaryProvider.describeSecret(secretRef);
    }
    return await this.fallbackProvider.describeSecret(secretRef);
  }

  public async requireSecret(secretRef: string): Promise<SecretProviderMetadata & { value: string }> {
    if (this.isPrimaryConfigured()) {
      return await this.primaryProvider.requireSecret(secretRef);
    }
    return await this.fallbackProvider.requireSecret(secretRef);
  }

  public async issueSecretLease(secretRef: string): Promise<SecretProviderIssuedLease | null> {
    if (this.isPrimaryConfigured()) {
      return await this.primaryProvider.issueSecretLease?.(secretRef) ?? null;
    }
    return null;
  }
}

/**
 * Creates the default provider set based on environment configuration.
 */
export function createDefaultProviders(env: NodeJS.ProcessEnv = process.env): Record<SecretProviderKind, ManagedSecretProvider> {
  const environmentProvider = new EnvSecretProvider({ env });

  // Vault: HTTP provider if configured, else JSON file fallback
  function tryVaultProvider(): ManagedSecretProvider {
    if (!env["AA_VAULT_ADDR"]) {
      return new HybridManagedSecretProvider(
        "vault",
        new ExternalSecretProviderAdapter(new ExternalSecretProvider({ providerKind: "vault", env })),
        environmentProvider,
      );
    }
    return new HybridManagedSecretProvider(
      "vault",
      new VaultHttpSecretProvider({ env }),
      new ExternalSecretProviderAdapter(new ExternalSecretProvider({ providerKind: "vault", env })),
    );
  }

  // KMS: HTTP provider if configured, else JSON file fallback
  function tryKmsProvider(): ManagedSecretProvider {
    if (!env["AA_AWS_ACCESS_KEY_ID"]) {
      return new HybridManagedSecretProvider(
        "kms",
        new ExternalSecretProviderAdapter(new ExternalSecretProvider({ providerKind: "kms", env })),
        environmentProvider,
      );
    }
    return new HybridManagedSecretProvider(
      "kms",
      new AwsKmsHttpSecretProvider({ env }),
      new ExternalSecretProviderAdapter(new ExternalSecretProvider({ providerKind: "kms", env })),
    );
  }

  // GCP: HTTP provider if configured, else JSON file fallback
  function trySecretManagerProvider(): ManagedSecretProvider {
    if (!env["AA_GCP_PROJECT_ID"]) {
      return new HybridManagedSecretProvider(
        "secret_manager",
        new ExternalSecretProviderAdapter(new ExternalSecretProvider({ providerKind: "secret_manager", env })),
        environmentProvider,
      );
    }
    return new HybridManagedSecretProvider(
      "secret_manager",
      new GcpSecretManagerHttpSecretProvider({ env }),
      new ExternalSecretProviderAdapter(new ExternalSecretProvider({ providerKind: "secret_manager", env })),
    );
  }

  return {
    environment: new EnvironmentBackedManagedSecretProvider("environment", environmentProvider),
    vault: tryVaultProvider(),
    kms: tryKmsProvider(),
    secret_manager: trySecretManagerProvider(),
  };
}

/**
 * Secret Management Service
 *
 * Central service for managing secrets across their lifecycle.
 */
