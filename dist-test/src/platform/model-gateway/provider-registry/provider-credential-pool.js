/**
 * Provider Credential Pool
 */
export * from "./provider-credential-pool-support.js";
import { ProviderError } from "../../contracts/errors.js";
import { addMilliseconds, computeEffectiveStatus, isRetryableCredentialFailure, loadProviderCredentialRecordsFromEnv, normalizeCredentialRecord, requireResolvedSecretValue, throwProviderCredentialRuntimeError, } from "./provider-credential-pool-support.js";
export class ProviderCredentialPool {
    provider;
    credentials = new Map();
    orderedIds;
    defaultCooldownMs;
    managedSecretAccess;
    disposed = false;
    constructor(options) {
        this.provider = options.provider;
        // Default cooldown is 60 seconds if not specified
        this.defaultCooldownMs = options.defaultCooldownMs ?? 60_000;
        this.orderedIds = [];
        this.managedSecretAccess = options.managedSecretAccess ?? {};
        // Initialize credential records
        for (const input of options.credentials) {
            const normalized = normalizeCredentialRecord(input);
            // Skip credentials with no API key or secret ref
            if (normalized.apiKey == null && normalized.secretRef == null) {
                continue;
            }
            this.credentials.set(normalized.credentialId, normalized);
            this.orderedIds.push(normalized.credentialId);
        }
    }
    /**
     * Creates a credential pool from environment variables
     * Automatically loads credentials from standard env var patterns
     */
    static fromEnvironment(provider, providerEnv, defaultCooldownMs, options = {}) {
        // Default to preserving secret refs when lease issuer is configured
        const preserveManagedSecretRefs = options.preserveManagedSecretRefs ?? options.secretLeaseIssuer != null;
        return new ProviderCredentialPool({
            provider,
            ...(defaultCooldownMs !== undefined ? { defaultCooldownMs } : {}),
            credentials: loadProviderCredentialRecordsFromEnv(provider, providerEnv, {
                ...options,
                preserveManagedSecretRefs,
            }),
            managedSecretAccess: {
                secretResolver: options.secretResolver ?? null,
                secretLeaseIssuer: options.secretLeaseIssuer ?? null,
                secretLeaseRevoker: options.secretLeaseRevoker ?? null,
            },
        });
    }
    getProvider() {
        return this.provider;
    }
    /**
     * Returns the current state of all credentials
     */
    getStates(now = new Date().toISOString()) {
        this.assertNotDisposed();
        return this.orderedIds.flatMap((credentialId) => {
            const record = this.credentials.get(credentialId);
            if (record == null) {
                return [];
            }
            const effectiveStatus = computeEffectiveStatus(record, now);
            return [
                {
                    ...record,
                    effectiveStatus,
                    available: effectiveStatus === "active",
                },
            ];
        });
    }
    /**
     * Selects an available credential for use
     *
     * Selection priority:
     * 1. Preferred credential (if specified and available)
     * 2. First available active credential
     * 3. Credential reactivated after cooldown
     */
    async selectCredential(options = {}) {
        this.assertNotDisposed();
        const now = options.now ?? new Date().toISOString();
        const states = this.getStates(now);
        const excluded = new Set(options.excludeCredentialIds ?? []);
        // Try preferred credential first
        const preferred = options.preferredCredentialId != null
            ? states.find((state) => state.credentialId === options.preferredCredentialId && state.available && !excluded.has(state.credentialId))
            : null;
        if (preferred != null) {
            return await this.buildSelection(preferred.credentialId, "preferred_credential", now);
        }
        // Find first available credential
        for (const state of states) {
            if (!state.available || excluded.has(state.credentialId)) {
                continue;
            }
            const original = this.credentials.get(state.credentialId);
            return await this.buildSelection(state.credentialId, original?.status === "cooling_down" ? "reactivated_after_cooldown" : "first_active_credential", now);
        }
        return null;
    }
    /**
     * Marks a credential as successfully used
     * Resets cooldown and failure state
     */
    markSuccess(credentialId) {
        const record = this.credentials.get(credentialId);
        if (record == null) {
            return null;
        }
        const updated = {
            ...record,
            status: "active",
            cooldownUntil: null,
            resetAt: null,
            lastFailureCode: null,
            retryAfterMs: null,
        };
        this.credentials.set(credentialId, updated);
        return updated;
    }
    /**
     * Marks a credential as failed with a specific error
     * Updates cooldown based on error type
     */
    markFailure(signal) {
        const record = this.credentials.get(signal.credentialId);
        if (record == null) {
            return null;
        }
        const occurredAt = signal.occurredAt ?? new Date().toISOString();
        let status = record.status;
        let cooldownUntil = record.cooldownUntil;
        const resetAt = signal.resetAt ?? record.resetAt;
        let retryAfterMs = signal.retryAfterMs ?? record.retryAfterMs;
        // HTTP 402 (Payment Required) - permanently disable
        if (signal.statusCode === 402) {
            status = "disabled";
            cooldownUntil = null;
        }
        // HTTP 429 (Rate Limited) or explicit retry timing - enter cooldown
        else if (signal.statusCode === 429 || signal.retryAfterMs != null || signal.resetAt != null) {
            status = "cooling_down";
            cooldownUntil =
                signal.resetAt ?? (signal.retryAfterMs != null ? addMilliseconds(occurredAt, signal.retryAfterMs) : addMilliseconds(occurredAt, this.defaultCooldownMs));
        }
        // HTTP 5xx - server error, enter cooldown
        else if (signal.statusCode >= 500 && signal.statusCode < 600) {
            status = "cooling_down";
            retryAfterMs = signal.retryAfterMs ?? this.defaultCooldownMs;
            cooldownUntil = signal.resetAt ?? addMilliseconds(occurredAt, retryAfterMs);
        }
        const updated = {
            ...record,
            status,
            cooldownUntil,
            resetAt,
            retryAfterMs,
            lastFailureCode: signal.errorCode ?? record.lastFailureCode,
        };
        this.credentials.set(signal.credentialId, updated);
        return updated;
    }
    /**
     * Checks if failover to another credential is possible after a failure
     */
    async canFailoverAfter(signal) {
        this.assertNotDisposed();
        if (!isRetryableCredentialFailure(signal.statusCode, signal.retryAfterMs ?? null, signal.resetAt ?? null)) {
            return false;
        }
        return (await this.selectCredential({
            excludeCredentialIds: signal.excludeCredentialIds ?? [],
            ...(signal.now !== undefined ? { now: signal.now } : {}),
        })) != null;
    }
    /**
     * Releases a credential after request completion
     * For managed secrets with leases, revokes the lease
     */
    releaseCredential(selection, reasonCode = "provider.request_completed") {
        const record = this.credentials.get(selection.credentialId);
        if (record == null) {
            return null;
        }
        // Only release if there's an active lease matching the selection
        if (record.secretRef == null || selection.leaseId == null || record.activeLeaseId !== selection.leaseId) {
            return record;
        }
        // Revoke the lease if a revoker is configured
        if (this.managedSecretAccess.secretLeaseRevoker != null) {
            this.managedSecretAccess.secretLeaseRevoker(selection.leaseId, {
                ...this.buildManagedSecretContext(record),
                reasonCode,
            });
        }
        // Clear the API key and lease info
        const released = {
            ...record,
            apiKey: null,
            activeLeaseId: null,
            activeLeaseExpiresAt: null,
            activeLeaseSource: null,
        };
        this.credentials.set(released.credentialId, released);
        return released;
    }
    /**
     * Returns exhaustion information when no credentials are available
     */
    getExhaustion(now = new Date().toISOString()) {
        this.assertNotDisposed();
        const states = this.getStates(now);
        if (states.length === 0) {
            return {
                provider: this.provider,
                reasonCode: "provider.credentials_missing",
                message: `Provider ${this.provider} has no configured credentials.`,
            };
        }
        if (states.every((state) => state.effectiveStatus === "disabled")) {
            return {
                provider: this.provider,
                reasonCode: "provider.credentials_disabled",
                message: `Provider ${this.provider} has no enabled credentials.`,
            };
        }
        return {
            provider: this.provider,
            reasonCode: "provider.credentials_cooling_down",
            message: `Provider ${this.provider} credentials are cooling down and cannot be selected yet.`,
        };
    }
    /**
     * Releases all active managed-secret leases and rejects subsequent operations.
     */
    dispose(reasonCode = "provider.pool_disposed") {
        if (this.disposed) {
            return;
        }
        for (const credentialId of this.orderedIds) {
            const record = this.credentials.get(credentialId);
            if (record == null) {
                continue;
            }
            this.credentials.set(record.credentialId, this.releaseLeaseState(record, reasonCode));
        }
        this.disposed = true;
    }
    /**
     * Builds a credential selection with resolved API key
     * Handles secret materialization for managed secrets
     */
    async buildSelection(credentialId, routeReason, now) {
        const record = await this.materializeCredential(credentialId, now);
        if (record.apiKey == null) {
            throwProviderCredentialRuntimeError(this.provider, `secret_value_missing:${record.secretRef ?? credentialId}`, {
                credentialId,
                secretRef: record.secretRef,
            });
        }
        return {
            provider: this.provider,
            credentialId: record.credentialId,
            apiKey: record.apiKey,
            secretRef: record.secretRef,
            label: record.label,
            leaseId: record.activeLeaseId,
            leaseExpiresAt: record.activeLeaseExpiresAt,
            leaseSource: record.activeLeaseSource,
            routeReason,
        };
    }
    /**
     * Materializes a credential by resolving its secret reference
     * Uses lease-based access if configured, otherwise direct resolution
     */
    async materializeCredential(credentialId, now) {
        const record = this.credentials.get(credentialId);
        if (record == null) {
            throwProviderCredentialRuntimeError(this.provider, `missing_credential:${credentialId}`, { credentialId });
        }
        // No secret ref means API key is already available
        if (record.secretRef == null) {
            return record;
        }
        // Check if existing lease has expired
        if (record.activeLeaseExpiresAt != null && record.activeLeaseExpiresAt <= now) {
            const expired = {
                ...record,
                apiKey: null,
                activeLeaseId: null,
                activeLeaseExpiresAt: null,
                activeLeaseSource: null,
            };
            this.credentials.set(expired.credentialId, expired);
            // Recursively materialize (will try to acquire new lease)
            return await this.materializeCredential(credentialId, now);
        }
        // API key already available (from valid lease or direct resolution)
        if (record.apiKey != null) {
            return record;
        }
        // Acquire a lease using the configured issuer
        if (this.managedSecretAccess.secretLeaseIssuer != null) {
            const lease = await this.managedSecretAccess.secretLeaseIssuer(record.secretRef, this.buildManagedSecretContext(record));
            const apiKey = lease.apiKey.trim();
            const expiresAtMs = Date.parse(lease.expiresAt);
            if (apiKey.length === 0) {
                throwProviderCredentialRuntimeError(this.provider, `secret_value_missing:${record.secretRef}`, {
                    credentialId,
                    secretRef: record.secretRef,
                });
            }
            if (lease.leaseId.trim().length === 0 || Number.isNaN(expiresAtMs) || expiresAtMs <= Date.parse(now)) {
                throwProviderCredentialRuntimeError(this.provider, `invalid_secret_lease:${record.secretRef}`, {
                    credentialId,
                    secretRef: record.secretRef,
                    leaseId: lease.leaseId,
                    expiresAt: lease.expiresAt,
                });
            }
            const leased = {
                ...record,
                apiKey,
                activeLeaseId: lease.leaseId,
                activeLeaseExpiresAt: lease.expiresAt,
                activeLeaseSource: lease.leaseSource,
            };
            this.credentials.set(leased.credentialId, leased);
            return leased;
        }
        // Direct resolution without leasing
        if (this.managedSecretAccess.secretResolver != null) {
            const resolved = requireResolvedSecretValue(this.provider, record.secretRef, this.managedSecretAccess.secretResolver);
            const materialized = {
                ...record,
                apiKey: resolved,
            };
            this.credentials.set(materialized.credentialId, materialized);
            return materialized;
        }
        throwProviderCredentialRuntimeError(this.provider, "secret_resolver_missing", { credentialId });
    }
    buildManagedSecretContext(record) {
        return {
            provider: this.provider,
            credentialId: record.credentialId,
            label: record.label,
        };
    }
    releaseLeaseState(record, reasonCode) {
        if (record.secretRef != null && record.activeLeaseId != null && this.managedSecretAccess.secretLeaseRevoker != null) {
            try {
                this.managedSecretAccess.secretLeaseRevoker(record.activeLeaseId, {
                    ...this.buildManagedSecretContext(record),
                    reasonCode,
                });
            }
            catch {
                // Teardown must keep clearing local lease state even if external revocation fails.
            }
        }
        return {
            ...record,
            apiKey: record.secretRef == null ? record.apiKey : null,
            activeLeaseId: null,
            activeLeaseExpiresAt: null,
            activeLeaseSource: null,
        };
    }
    assertNotDisposed() {
        if (this.disposed) {
            throw new ProviderError("provider.credential_pool.disposed", `Provider credential pool for ${this.provider} has been disposed.`, {
                source: "provider",
                retryable: false,
                details: { provider: this.provider },
            });
        }
    }
}
//# sourceMappingURL=provider-credential-pool.js.map