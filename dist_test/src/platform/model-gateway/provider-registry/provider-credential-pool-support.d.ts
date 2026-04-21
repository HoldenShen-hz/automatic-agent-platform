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
export type ProviderCredentialStatus = "active" | "cooling_down" | "disabled";
/**
 * Input for creating a credential record
 */
export interface ProviderCredentialRecordInput {
    credentialId: string;
    apiKey?: string | null;
    secretRef?: string | null;
    label?: string | null;
    status?: ProviderCredentialStatus;
    cooldownUntil?: string | null;
    resetAt?: string | null;
    lastFailureCode?: string | null;
    retryAfterMs?: number | null;
}
export interface ProviderCredentialManagedSecretContext {
    provider: string;
    credentialId: string;
    label: string | null;
}
/**
 * Lease for a managed secret - obtained from secretLeaseIssuer
 */
export interface ProviderCredentialManagedSecretLease {
    apiKey: string;
    leaseId: string;
    expiresAt: string;
    leaseSource: "provider_issued" | "wrapped_secret";
}
/**
 * Callbacks for accessing managed secrets
 */
export interface ProviderCredentialManagedSecretAccess {
    secretResolver?: ((secretRef: string) => string) | null;
    secretLeaseIssuer?: ((secretRef: string, context: ProviderCredentialManagedSecretContext) => ProviderCredentialManagedSecretLease | Promise<ProviderCredentialManagedSecretLease>) | null;
    secretLeaseRevoker?: ((leaseId: string, context: ProviderCredentialManagedSecretContext & {
        reasonCode: string;
    }) => void) | null;
}
export interface ProviderCredentialRecord extends Omit<ProviderCredentialRecordInput, "apiKey" | "secretRef"> {
    apiKey: string | null;
    secretRef: string | null;
    label: string | null;
    status: ProviderCredentialStatus;
    cooldownUntil: string | null;
    resetAt: string | null;
    lastFailureCode: string | null;
    retryAfterMs: number | null;
    activeLeaseId: string | null;
    activeLeaseExpiresAt: string | null;
    activeLeaseSource: "provider_issued" | "wrapped_secret" | null;
}
export interface ProviderCredentialPoolState extends ProviderCredentialRecord {
    effectiveStatus: ProviderCredentialStatus;
    available: boolean;
}
/**
 * Result of credential selection - contains the API key to use
 */
export interface ProviderCredentialSelection {
    provider: string;
    credentialId: string;
    apiKey: string;
    secretRef: string | null;
    label: string | null;
    leaseId: string | null;
    leaseExpiresAt: string | null;
    leaseSource: "provider_issued" | "wrapped_secret" | null;
    routeReason: "preferred_credential" | "first_active_credential" | "reactivated_after_cooldown";
}
/**
 * Signal representing a credential failure
 */
export interface ProviderCredentialFailureSignal {
    credentialId: string;
    statusCode: number;
    errorCode?: string | null;
    occurredAt?: string;
    retryAfterMs?: number | null;
    resetAt?: string | null;
}
export interface ProviderCredentialPoolOptions {
    provider: string;
    credentials: ProviderCredentialRecordInput[];
    defaultCooldownMs?: number;
    managedSecretAccess?: ProviderCredentialManagedSecretAccess;
}
export interface ProviderCredentialEnvLoadOptions extends ProviderCredentialManagedSecretAccess {
    preserveManagedSecretRefs?: boolean;
}
export interface ProviderCredentialPoolExhaustion {
    provider: string;
    reasonCode: "provider.credentials_missing" | "provider.credentials_cooling_down" | "provider.credentials_disabled";
    message: string;
}
/**
 * Derives the environment variable name for a provider's single API key
 * Example: "anthropic" -> "ANTHROPIC_API_KEY"
 */
export declare function deriveProviderApiKeyEnvName(providerId: string): string;
/**
 * Derives the environment variable name for a provider's JSON-encoded API keys
 * Example: "anthropic" -> "ANTHROPIC_API_KEYS_JSON"
 */
export declare function deriveProviderApiKeysJsonEnvName(providerId: string): string;
/**
 * Derives the environment variable name for a provider's single secret reference
 * Example: "anthropic" -> "ANTHROPIC_API_KEY_SECRET_REF"
 */
export declare function deriveProviderApiKeySecretRefEnvName(providerId: string): string;
/**
 * Derives the environment variable name for a provider's JSON-encoded secret references
 * Example: "anthropic" -> "ANTHROPIC_API_KEY_SECRET_REFS_JSON"
 */
export declare function deriveProviderApiKeySecretRefsJsonEnvName(providerId: string): string;
export declare function throwProviderCredentialValidation(provider: string, suffix: string, details?: Record<string, unknown>): never;
export declare function throwProviderCredentialRuntimeError(provider: string, suffix: string, details?: Record<string, unknown>): never;
/**
 * Normalizes a credential input record to internal format
 * Validates and sanitizes string fields, sets defaults
 */
export declare function normalizeCredentialRecord(input: ProviderCredentialRecordInput): ProviderCredentialRecord;
export declare function addMilliseconds(timestamp: string, deltaMs: number): string;
/**
 * Computes the effective status of a credential considering cooldown
 */
export declare function computeEffectiveStatus(record: ProviderCredentialRecord, now: string): ProviderCredentialStatus;
/**
 * Determines if a failure is retryable within the credential pool
 * Returns true if the error should trigger failover to another credential
 */
export declare function isRetryableCredentialFailure(statusCode: number, retryAfterMs: number | null, resetAt: string | null): boolean;
export declare function requireResolvedSecretValue(provider: string, secretRef: string, resolver: ((secretRef: string) => string) | null | undefined): string;
/**
 * Loads credential records from environment variables
 *
 * Supports four environment variable formats:
 * 1. {PROVIDER}_API_KEY - single API key
 * 2. {PROVIDER}_API_KEYS_JSON - JSON array of credentials
 * 3. {PROVIDER}_API_KEY_SECRET_REF - single secret reference
 * 4. {PROVIDER}_API_KEY_SECRET_REFS_JSON - JSON array of secret references
 */
export declare function loadProviderCredentialRecordsFromEnv(provider: string, providerEnv: NodeJS.ProcessEnv, options?: ProviderCredentialEnvLoadOptions): ProviderCredentialRecordInput[];
/**
 * Credential Pool - manages multiple credentials for a provider with failover
 *
 * Features:
 * - Maintains credential state (active, cooling_down, disabled)
 * - Selects credentials with retry-aware failover
 * - Supports managed secrets with lease-based access
 * - Tracks failure history for cooldown decisions
 */
