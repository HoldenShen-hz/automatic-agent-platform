/**
 * Provider Credential Pool
 *
 * Manages API credentials for multiple LLM providers with support for:
 * - Multiple credentials per provider with failover
 * - Credential leasing with expiration for managed secrets
 * - Automatic cooldown on rate limit (429) and server (5xx) errors
 * - Environment-based credential loading
 * - Secret reference resolution for external secret stores
 *
 * ## Credential Selection Strategy
 *
 * 1. Preferred credential (if specified and available)
 * 2. First available active credential
 * 3. Reactivated credential after cooldown
 *
 * ## Failure Handling
 *
 * - HTTP 402 (Payment Required): Credential is permanently disabled
 * - HTTP 429 (Rate Limited): Credential enters cooldown period
 * - HTTP 5xx (Server Error): Credential enters cooldown period
 *
 * ## Secret Management
 *
 * Supports two modes for managed secrets:
 * - Lease mode: Credentials are leased for a limited time via secretLeaseIssuer
 * - Direct resolution: Credentials are resolved directly via secretResolver
 */
import { ProviderError, ValidationError } from "../../contracts/errors.js";
/**
 * Derives the environment variable name for a provider's single API key
 * Example: "anthropic" -> "ANTHROPIC_API_KEY"
 */
export function deriveProviderApiKeyEnvName(providerId) {
    return `${providerId.replace(/[^a-zA-Z0-9]+/g, "_").replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()}_API_KEY`;
}
/**
 * Derives the environment variable name for a provider's JSON-encoded API keys
 * Example: "anthropic" -> "ANTHROPIC_API_KEYS_JSON"
 */
export function deriveProviderApiKeysJsonEnvName(providerId) {
    return `${providerId.replace(/[^a-zA-Z0-9]+/g, "_").replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()}_API_KEYS_JSON`;
}
/**
 * Derives the environment variable name for a provider's single secret reference
 * Example: "anthropic" -> "ANTHROPIC_API_KEY_SECRET_REF"
 */
export function deriveProviderApiKeySecretRefEnvName(providerId) {
    return `${providerId.replace(/[^a-zA-Z0-9]+/g, "_").replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()}_API_KEY_SECRET_REF`;
}
/**
 * Derives the environment variable name for a provider's JSON-encoded secret references
 * Example: "anthropic" -> "ANTHROPIC_API_KEY_SECRET_REFS_JSON"
 */
export function deriveProviderApiKeySecretRefsJsonEnvName(providerId) {
    return `${providerId.replace(/[^a-zA-Z0-9]+/g, "_").replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()}_API_KEY_SECRET_REFS_JSON`;
}
// Throws a validation error for credential configuration issues
export function throwProviderCredentialValidation(provider, suffix, details = {}) {
    const code = `provider.credentials_invalid:${provider}:${suffix}`;
    throw new ValidationError(code, code, {
        retryable: false,
        source: "provider",
        details: {
            provider,
            ...details,
        },
    });
}
// Throws a runtime error for credential access failures
export function throwProviderCredentialRuntimeError(provider, suffix, details = {}) {
    const code = `provider.credentials_invalid:${provider}:${suffix}`;
    throw new ProviderError(code, code, {
        retryable: false,
        details: {
            provider,
            ...details,
        },
    });
}
/**
 * Normalizes a credential input record to internal format
 * Validates and sanitizes string fields, sets defaults
 */
export function normalizeCredentialRecord(input) {
    const apiKey = typeof input.apiKey === "string" && input.apiKey.trim().length > 0 ? input.apiKey.trim() : null;
    const secretRef = typeof input.secretRef === "string" && input.secretRef.trim().length > 0 ? input.secretRef.trim() : null;
    return {
        credentialId: input.credentialId,
        apiKey,
        secretRef,
        label: input.label ?? null,
        status: input.status ?? "active",
        cooldownUntil: input.cooldownUntil ?? null,
        resetAt: input.resetAt ?? null,
        lastFailureCode: input.lastFailureCode ?? null,
        retryAfterMs: input.retryAfterMs ?? null,
        activeLeaseId: null,
        activeLeaseExpiresAt: null,
        activeLeaseSource: null,
    };
}
// Adds milliseconds to a timestamp, returning new ISO string
export function addMilliseconds(timestamp, deltaMs) {
    return new Date(new Date(timestamp).getTime() + deltaMs).toISOString();
}
/**
 * Computes the effective status of a credential considering cooldown
 */
export function computeEffectiveStatus(record, now) {
    if (record.status === "disabled") {
        return "disabled";
    }
    if (record.status === "cooling_down" && record.cooldownUntil != null && record.cooldownUntil > now) {
        return "cooling_down";
    }
    return "active";
}
/**
 * Determines if a failure is retryable within the credential pool
 * Returns true if the error should trigger failover to another credential
 */
export function isRetryableCredentialFailure(statusCode, retryAfterMs, resetAt) {
    // If explicit retry timing is provided, always retry
    if (retryAfterMs != null || resetAt != null) {
        return true;
    }
    // Otherwise, retry on specific status codes
    return statusCode === 402 || statusCode === 429 || statusCode === 500 || statusCode === 502 || statusCode === 503 || statusCode === 504;
}
/**
 * Parses a credential entry from JSON format
 * Supports both string (API key) and object (full record) formats
 */
function parseJsonCredentialRecord(provider, item, index) {
    // Simple format: just the API key as a string
    if (typeof item === "string") {
        if (item.trim().length === 0) {
            throwProviderCredentialValidation(provider, `empty_api_key:${index}`, { index });
        }
        return {
            credentialId: `${provider}-${index + 1}`,
            apiKey: item.trim(),
            label: `credential-${index + 1}`,
        };
    }
    // Invalid format: null, non-object, or array
    if (item == null || typeof item !== "object" || Array.isArray(item)) {
        throwProviderCredentialValidation(provider, `invalid_entry:${index}`, { index });
    }
    const entry = item;
    // Support both "credentialId" and "id" as the identifier field
    const credentialId = typeof entry.credentialId === "string"
        ? entry.credentialId
        : typeof entry.id === "string"
            ? entry.id
            : `${provider}-${index + 1}`;
    const apiKey = typeof entry.apiKey === "string" ? entry.apiKey.trim() : "";
    if (apiKey.length === 0) {
        throwProviderCredentialValidation(provider, `missing_api_key:${index}`, { index });
    }
    // Validate status value
    const statusValue = entry.status;
    const status = statusValue === "active" || statusValue === "cooling_down" || statusValue === "disabled"
        ? statusValue
        : undefined;
    return {
        credentialId,
        apiKey,
        label: typeof entry.label === "string" ? entry.label : null,
        ...(status != null ? { status } : {}),
        cooldownUntil: typeof entry.cooldownUntil === "string" ? entry.cooldownUntil : null,
        resetAt: typeof entry.resetAt === "string" ? entry.resetAt : null,
        lastFailureCode: typeof entry.lastFailureCode === "string" ? entry.lastFailureCode : null,
        retryAfterMs: typeof entry.retryAfterMs === "number" && Number.isFinite(entry.retryAfterMs) ? entry.retryAfterMs : null,
    };
}
// Resolves a secret reference to its actual value using the provided resolver
export function requireResolvedSecretValue(provider, secretRef, resolver) {
    if (resolver == null) {
        throwProviderCredentialValidation(provider, "secret_resolver_missing");
    }
    const resolved = resolver(secretRef);
    if (typeof resolved !== "string" || resolved.trim().length === 0) {
        throwProviderCredentialValidation(provider, `secret_value_missing:${secretRef}`, { secretRef });
    }
    return resolved.trim();
}
/**
 * Parses a secret reference credential entry from JSON format
 * Supports string (secret ref) and object (full record) formats
 */
function parseJsonSecretRefCredentialRecord(provider, item, index, options) {
    // Simple format: just the secret reference as a string
    if (typeof item === "string") {
        const secretRef = item.trim();
        if (secretRef.length === 0) {
            throwProviderCredentialValidation(provider, `empty_secret_ref:${index}`, { index });
        }
        // If preserving refs, keep the reference; otherwise resolve immediately
        if (options.preserveManagedSecretRefs === true) {
            if (options.secretResolver == null && options.secretLeaseIssuer == null) {
                throwProviderCredentialValidation(provider, "secret_resolver_missing");
            }
            if (options.secretResolver != null) {
                requireResolvedSecretValue(provider, secretRef, options.secretResolver);
            }
            return {
                credentialId: `${provider}-secret-${index + 1}`,
                secretRef,
                label: `managed-credential-${index + 1}`,
            };
        }
        return {
            credentialId: `${provider}-secret-${index + 1}`,
            apiKey: requireResolvedSecretValue(provider, secretRef, options.secretResolver),
            label: `managed-credential-${index + 1}`,
        };
    }
    // Invalid format
    if (item == null || typeof item !== "object" || Array.isArray(item)) {
        throwProviderCredentialValidation(provider, `invalid_secret_ref_entry:${index}`, { index });
    }
    const entry = item;
    const credentialId = typeof entry.credentialId === "string"
        ? entry.credentialId
        : typeof entry.id === "string"
            ? entry.id
            : `${provider}-secret-${index + 1}`;
    const secretRef = typeof entry.secretRef === "string" ? entry.secretRef.trim() : "";
    if (secretRef.length === 0) {
        throwProviderCredentialValidation(provider, `missing_secret_ref:${index}`, { index });
    }
    const statusValue = entry.status;
    const status = statusValue === "active" || statusValue === "cooling_down" || statusValue === "disabled"
        ? statusValue
        : undefined;
    // Validate secret ref exists if preserving
    if (options.preserveManagedSecretRefs === true) {
        if (options.secretResolver == null && options.secretLeaseIssuer == null) {
            throwProviderCredentialValidation(provider, "secret_resolver_missing");
        }
        if (options.secretResolver != null) {
            requireResolvedSecretValue(provider, secretRef, options.secretResolver);
        }
    }
    return {
        credentialId,
        ...(options.preserveManagedSecretRefs === true
            ? {
                secretRef,
            }
            : {
                apiKey: requireResolvedSecretValue(provider, secretRef, options.secretResolver),
            }),
        label: typeof entry.label === "string" ? entry.label : null,
        ...(status != null ? { status } : {}),
        cooldownUntil: typeof entry.cooldownUntil === "string" ? entry.cooldownUntil : null,
        resetAt: typeof entry.resetAt === "string" ? entry.resetAt : null,
        lastFailureCode: typeof entry.lastFailureCode === "string" ? entry.lastFailureCode : null,
        retryAfterMs: typeof entry.retryAfterMs === "number" && Number.isFinite(entry.retryAfterMs) ? entry.retryAfterMs : null,
    };
}
/**
 * Loads credential records from environment variables
 *
 * Supports four environment variable formats:
 * 1. {PROVIDER}_API_KEY - single API key
 * 2. {PROVIDER}_API_KEYS_JSON - JSON array of credentials
 * 3. {PROVIDER}_API_KEY_SECRET_REF - single secret reference
 * 4. {PROVIDER}_API_KEY_SECRET_REFS_JSON - JSON array of secret references
 */
export function loadProviderCredentialRecordsFromEnv(provider, providerEnv, options = {}) {
    const records = [];
    // Format 1: Single API key
    const singleKeyEnv = deriveProviderApiKeyEnvName(provider);
    const singleKey = providerEnv[singleKeyEnv];
    if (typeof singleKey === "string" && singleKey.trim().length > 0) {
        records.push({
            credentialId: `${provider}-default`,
            apiKey: singleKey.trim(),
            label: "default",
        });
    }
    // Format 2: JSON array of API keys
    const jsonEnvName = deriveProviderApiKeysJsonEnvName(provider);
    const rawJson = providerEnv[jsonEnvName];
    if (typeof rawJson === "string" && rawJson.trim().length > 0) {
        let parsed;
        try {
            parsed = JSON.parse(rawJson);
        }
        catch (error) {
            throw new ValidationError(`provider.credentials_invalid:${provider}:json_parse`, `provider.credentials_invalid:${provider}:json_parse`, {
                retryable: false,
                source: "provider",
                details: {
                    provider,
                    originalError: error instanceof Error ? error.message : String(error),
                },
            });
        }
        if (!Array.isArray(parsed)) {
            throwProviderCredentialValidation(provider, "expected_array");
        }
        parsed.forEach((item, index) => {
            records.push(parseJsonCredentialRecord(provider, item, index));
        });
    }
    // Format 3: Single secret reference
    const singleSecretRefEnv = deriveProviderApiKeySecretRefEnvName(provider);
    const singleSecretRef = providerEnv[singleSecretRefEnv];
    if (typeof singleSecretRef === "string" && singleSecretRef.trim().length > 0) {
        if (options.preserveManagedSecretRefs === true && options.secretResolver == null && options.secretLeaseIssuer == null) {
            throwProviderCredentialValidation(provider, "secret_resolver_missing");
        }
        if (options.preserveManagedSecretRefs === true && options.secretResolver != null) {
            requireResolvedSecretValue(provider, singleSecretRef.trim(), options.secretResolver);
        }
        records.push({
            credentialId: `${provider}-managed-default`,
            ...(options.preserveManagedSecretRefs === true
                ? { secretRef: singleSecretRef.trim() }
                : { apiKey: requireResolvedSecretValue(provider, singleSecretRef.trim(), options.secretResolver) }),
            label: "managed-default",
        });
    }
    // Format 4: JSON array of secret references
    const secretRefsJsonEnv = deriveProviderApiKeySecretRefsJsonEnvName(provider);
    const rawSecretRefsJson = providerEnv[secretRefsJsonEnv];
    if (typeof rawSecretRefsJson === "string" && rawSecretRefsJson.trim().length > 0) {
        let parsed;
        try {
            parsed = JSON.parse(rawSecretRefsJson);
        }
        catch (error) {
            throw new ValidationError(`provider.credentials_invalid:${provider}:secret_refs_json_parse`, `provider.credentials_invalid:${provider}:secret_refs_json_parse`, {
                retryable: false,
                source: "provider",
                details: {
                    provider,
                    originalError: error instanceof Error ? error.message : String(error),
                },
            });
        }
        if (!Array.isArray(parsed)) {
            throwProviderCredentialValidation(provider, "secret_refs_expected_array");
        }
        parsed.forEach((item, index) => {
            records.push(parseJsonSecretRefCredentialRecord(provider, item, index, options));
        });
    }
    return records;
}
/**
 * Credential Pool - manages multiple credentials for a provider with failover
 *
 * Features:
 * - Maintains credential state (active, cooling_down, disabled)
 * - Selects credentials with retry-aware failover
 * - Supports managed secrets with lease-based access
 * - Tracks failure history for cooldown decisions
 */
//# sourceMappingURL=provider-credential-pool-support.js.map