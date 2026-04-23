/**
 * Vault HTTP API Secret Provider
 *
 * Implements HashiCorp Vault KV v2 integration using native HTTP.
 * No external SDK dependencies - uses built-in fetch API.
 *
 * ## Purpose
 *
 * Allows the secret management system to retrieve secrets from
 * HashiCorp Vault instead of environment variables or static files.
 *
 * ## Configuration
 *
 * Configure via environment variables:
 * - AA_VAULT_ADDR: Vault server address (e.g., https://vault.internal:8200)
 * - AA_VAULT_TOKEN: Static token auth (takes precedence over AppRole)
 * - AA_VAULT_APPROLE_ROLE: AppRole role name for authentication
 * - AA_VAULT_APPROLE_SECRET: AppRole secret_id
 * - AA_VAULT_MOUNT: KV v2 mount point (default: secret)
 * - AA_VAULT_TIMEOUT_MS: Request timeout in ms (default: 5000)
 *
 * ## Secret Reference Format
 *
 * References like "secret://mykey" map to:
 *   KV v2 mount point: {mount}/data/{path}
 *
 * @see https://www.vaultproject.io/docs/secrets/kv/kv-v2
 */
import { type SecretProviderIssuedLease, type SecretProviderMetadata } from "./env-secret-provider.js";
import type { ManagedSecretProvider } from "./secret-management-support.js";
/**
 * Configuration options for Vault HTTP provider.
 */
export interface VaultHttpProviderOptions {
    /** Environment to read config from (defaults to process.env) */
    env?: NodeJS.ProcessEnv;
}
/**
 * Vault HTTP Secret Provider
 *
 * Retrieves secrets from HashiCorp Vault KV v2 using native HTTP.
 * Supports both token and AppRole authentication methods.
 */
export declare class VaultHttpSecretProvider implements ManagedSecretProvider {
    readonly providerKind: "vault";
    private readonly env;
    private readonly mount;
    private readonly timeoutMs;
    private _cachedToken;
    private _tokenExpiry;
    constructor(options?: VaultHttpProviderOptions);
    isConfigured(): boolean;
    /**
     * Returns the Vault server address, throwing if not configured.
     */
    private get addr();
    /**
     * Performs a fetch with a timeout.
     * Aborts the request if it takes too long.
     *
     * @param url - URL to fetch
     * @param init - Fetch options
     * @returns Response object
     */
    private fetchWithTimeout;
    /**
     * Gets an authentication token for Vault.
     * Uses cached token if still valid, otherwise authenticates via
     * AppRole or static token.
     *
     * @returns Valid Vault token
     * @throws ValidationError if no valid auth method is configured
     */
    private getToken;
    /**
     * Performs an authenticated Vault API request.
     *
     * @param path - Vault API path (e.g., "secret/data/mykey")
     * @returns Response from Vault
     */
    private vaultGet;
    /**
     * Extracts the Vault path from a secret reference.
     * Maps "secret://mykey" to the KV v2 data path.
     *
     * @param secretRef - The secret reference
     * @returns Vault KV v2 path
     */
    private extractSecretPath;
    /**
     * Extracts the secret key name from a reference.
     *
     * @param secretRef - The secret reference
     * @returns The key name
     */
    private extractSecretKey;
    /**
     * Checks if Vault is available and configured.
     *
     * @returns true if Vault address is set and responds
     */
    isAvailable(): Promise<boolean>;
    /**
     * Describes a secret without retrieving its value.
     *
     * @param secretRef - Secret reference
     * @returns Metadata about the secret
     */
    describeSecret(secretRef: string): Promise<SecretProviderMetadata>;
    refreshSecret(secretRef: string): Promise<SecretProviderMetadata>;
    /**
     * Retrieves the secret value from Vault.
     *
     * @param secretRef - Secret reference
     * @returns Metadata with secret value
     * @throws ValidationError if secret not found or key missing
     * @throws ProviderError for Vault API errors
     */
    requireSecret(secretRef: string): Promise<SecretProviderMetadata & {
        value: string;
    }>;
    /**
     * Vault KV v2 doesn't support native dynamic leases.
     * This method always returns null.
     *
     * @returns null (not supported)
     */
    issueSecretLease(_secretRef: string): Promise<SecretProviderIssuedLease | null>;
}
