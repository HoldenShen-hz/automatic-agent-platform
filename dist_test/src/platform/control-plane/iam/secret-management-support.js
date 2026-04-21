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
import { EnvSecretProvider, } from "./env-secret-provider.js";
import { ExternalSecretProvider, ExternalSecretProviderAdapter } from "./external-secret-provider.js";
import { VaultHttpSecretProvider } from "./vault-http-secret-provider.js";
import { AwsKmsHttpSecretProvider } from "./aws-kms-http-secret-provider.js";
import { GcpSecretManagerHttpSecretProvider } from "./gcp-secret-manager-http-secret-provider.js";
import { ValidationError } from "../../contracts/errors.js";
/**
 * Validates that a string is non-empty.
 */
export function assertNonEmpty(value, code) {
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
export function assertEnum(value, allowed, code) {
    if (allowed.includes(value)) {
        return value;
    }
    throw new ValidationError(code, code, {
        source: "provider",
        details: { value, allowed },
    });
}
/**
 * Converts an object to JSON string or null.
 */
export function toJson(value) {
    if (value == null) {
        return null;
    }
    return JSON.stringify(value);
}
/**
 * Normalizes a rotation policy with validation.
 */
export function normalizeRotationPolicy(input) {
    const cadenceDays = input.cadenceDays == null ? null : Math.max(1, Math.trunc(input.cadenceDays));
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
export function computeNextRotationDueAt(lastRotatedAt, policy) {
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
export function computeLeaseExpiry(issuedAt, ttlMinutes) {
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
export function normalizeLeaseStatus(record, asOf) {
    if (record.status !== "active") {
        return record.status;
    }
    return record.expiresAt <= asOf ? "expired" : "active";
}
/**
 * Adapter for environment-based provider.
 */
export class EnvironmentBackedManagedSecretProvider {
    providerKind;
    provider;
    constructor(providerKind, provider) {
        this.providerKind = providerKind;
        this.provider = provider;
    }
    async describeSecret(secretRef) {
        return this.provider.describeSecret(secretRef);
    }
    async requireSecret(secretRef) {
        return this.provider.requireSecret(secretRef);
    }
}
/**
 * Hybrid provider that tries primary, falls back to secondary.
 */
export class HybridManagedSecretProvider {
    providerKind;
    primaryProvider;
    fallbackProvider;
    constructor(providerKind, primaryProvider, fallbackProvider) {
        this.providerKind = providerKind;
        this.primaryProvider = primaryProvider;
        this.fallbackProvider = fallbackProvider;
    }
    isPrimaryConfigured() {
        if (typeof this.primaryProvider.isConfigured === "function") {
            return this.primaryProvider.isConfigured();
        }
        switch (this.providerKind) {
            case "vault":
                return this.primaryProvider.env?.["AA_VAULT_ADDR"] != null
                    || this.primaryProvider.env?.["AA_VAULT_SECRETS_JSON"] != null;
            case "kms": return this.primaryProvider.env?.["AA_AWS_ACCESS_KEY_ID"] != null;
            case "secret_manager": return this.primaryProvider.env?.["AA_GCP_PROJECT_ID"] != null;
            default: return false;
        }
    }
    async describeSecret(secretRef) {
        if (this.isPrimaryConfigured()) {
            return await this.primaryProvider.describeSecret(secretRef);
        }
        return await this.fallbackProvider.describeSecret(secretRef);
    }
    async requireSecret(secretRef) {
        if (this.isPrimaryConfigured()) {
            return await this.primaryProvider.requireSecret(secretRef);
        }
        return await this.fallbackProvider.requireSecret(secretRef);
    }
    async issueSecretLease(secretRef) {
        if (this.isPrimaryConfigured()) {
            return await this.primaryProvider.issueSecretLease?.(secretRef) ?? null;
        }
        return null;
    }
}
/**
 * Creates the default provider set based on environment configuration.
 */
export function createDefaultProviders(env = process.env) {
    const environmentProvider = new EnvSecretProvider({ env });
    // Vault: HTTP provider if configured, else JSON file fallback
    function tryVaultProvider() {
        if (!env["AA_VAULT_ADDR"]) {
            return new HybridManagedSecretProvider("vault", new ExternalSecretProviderAdapter(new ExternalSecretProvider({ providerKind: "vault", env })), environmentProvider);
        }
        return new HybridManagedSecretProvider("vault", new VaultHttpSecretProvider({ env }), new ExternalSecretProviderAdapter(new ExternalSecretProvider({ providerKind: "vault", env })));
    }
    // KMS: HTTP provider if configured, else JSON file fallback
    function tryKmsProvider() {
        if (!env["AA_AWS_ACCESS_KEY_ID"]) {
            return new HybridManagedSecretProvider("kms", new ExternalSecretProviderAdapter(new ExternalSecretProvider({ providerKind: "kms", env })), environmentProvider);
        }
        return new HybridManagedSecretProvider("kms", new AwsKmsHttpSecretProvider({ env }), new ExternalSecretProviderAdapter(new ExternalSecretProvider({ providerKind: "kms", env })));
    }
    // GCP: HTTP provider if configured, else JSON file fallback
    function trySecretManagerProvider() {
        if (!env["AA_GCP_PROJECT_ID"]) {
            return new HybridManagedSecretProvider("secret_manager", new ExternalSecretProviderAdapter(new ExternalSecretProvider({ providerKind: "secret_manager", env })), environmentProvider);
        }
        return new HybridManagedSecretProvider("secret_manager", new GcpSecretManagerHttpSecretProvider({ env }), new ExternalSecretProviderAdapter(new ExternalSecretProvider({ providerKind: "secret_manager", env })));
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
//# sourceMappingURL=secret-management-support.js.map