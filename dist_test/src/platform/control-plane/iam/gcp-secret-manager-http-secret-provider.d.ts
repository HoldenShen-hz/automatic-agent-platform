/**
 * GCP Secret Manager HTTP Secret Provider
 *
 * Retrieves secrets from GCP Secret Manager using native HTTP.
 * No GCP SDK dependencies - uses built-in fetch with OAuth2.
 *
 * ## Purpose
 *
 * Allows retrieval of secrets from GCP Secret Manager for
 * GCP-native deployments.
 *
 * ## Configuration
 *
 * - AA_GCP_PROJECT_ID: GCP project ID
 * - AA_GCP_TOKEN: OAuth2 access token (optional, uses metadata service if not set)
 * - AA_GCP_TOKEN_FETCH_URL: Token fetch URL (defaults to GCE metadata service)
 * - AA_GCP_TIMEOUT_MS: Request timeout (default: 5000)
 *
 * ## Secret Reference Format
 *
 * References like "secret://my-secret" or "secret://my-secret/versions/latest"
 * map directly to GCP Secret Manager secret names.
 *
 * @see https://cloud.google.com/secret-manager/docs
 */
import { type SecretProviderIssuedLease, type SecretProviderMetadata, type ManagedSecretProvider } from "./env-secret-provider.js";
/**
 * Configuration options for GCP Secret Manager provider.
 */
export interface GcpSecretManagerHttpProviderOptions {
    /** Environment to read config from */
    env?: NodeJS.ProcessEnv;
}
/**
 * GCP Secret Manager HTTP Secret Provider
 *
 * Retrieves secrets from GCP Secret Manager using native HTTP.
 * Supports both explicit OAuth2 tokens and GCP metadata service.
 */
export declare class GcpSecretManagerHttpSecretProvider implements ManagedSecretProvider {
    readonly providerKind: "secret_manager";
    private readonly env;
    private readonly projectId;
    private readonly timeoutMs;
    private readonly tokenFetchUrl;
    private _cachedToken;
    private _tokenExpiry;
    constructor(options?: GcpSecretManagerHttpProviderOptions);
    isConfigured(): boolean;
    refreshSecret(secretRef: string): Promise<SecretProviderMetadata>;
    /**
     * Performs a fetch with timeout.
     */
    private fetchWithTimeout;
    /**
     * Gets an OAuth2 access token.
     * Uses cached token if valid, explicit token if provided,
     * otherwise fetches from GCP metadata service.
     *
     * @returns Valid OAuth2 token
     */
    private getToken;
    /**
     * Checks if the provider is available.
     *
     * @returns true if project ID is set and token can be obtained
     */
    isAvailable(): Promise<boolean>;
    /**
     * Describes a secret without accessing its value.
     *
     * @param secretRef - Secret reference
     * @returns Metadata about the secret
     */
    describeSecret(secretRef: string): Promise<SecretProviderMetadata>;
    /**
     * Parses a secret reference into GCP secret name components.
     *
     * @param secretRef - Secret reference like "secret://my-secret" or "secret://my-secret/versions/latest"
     * @returns Object with project, secret, and version
     */
    private extractSecretName;
    /**
     * Retrieves a secret value from GCP Secret Manager.
     *
     * @param secretRef - Secret reference
     * @returns The secret value
     * @throws ValidationError if project not configured or secret not found
     * @throws ProviderError for GCP API errors
     */
    requireSecret(secretRef: string): Promise<SecretProviderMetadata & {
        value: string;
    }>;
    /**
     * GCP Secret Manager doesn't have native lease support in this implementation.
     *
     * @returns null (not supported)
     */
    issueSecretLease(_secretRef: string): Promise<SecretProviderIssuedLease | null>;
}
