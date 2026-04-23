/**
 * External Secret Provider
 *
 * Reads secrets from external configuration sources (JSON files or inline JSON)
 * when primary providers (Vault, KMS, GCP) are not available.
 *
 * ## Purpose
 *
 * This provider serves as a fallback when:
 * - Vault/KMS/GCP are not configured in the deployment
 * - Development/testing without cloud provider access
 * - Migration path from file-based secrets to cloud providers
 *
 * ## Configuration
 *
 * Secrets are loaded from environment variables containing JSON:
 *
 * For Vault:
 *   AA_VAULT_SECRETS_JSON={"mykey":"value"} OR AA_VAULT_SECRETS_FILE=/path/to/secrets.json
 *
 * For KMS:
 *   AA_KMS_SECRETS_JSON={"mykey":"value"} OR AA_KMS_SECRETS_FILE=/path/to/secrets.json
 *
 * For GCP Secret Manager:
 *   AA_SECRET_MANAGER_SECRETS_JSON={"mykey":"value"} OR AA_SECRET_MANAGER_SECRETS_FILE=/path/to/secrets.json
 *
 * ## Secret Reference Format
 *
 * References like "secret://mykey" look up "mykey" in the JSON object.
 * References like "secret://folder/mykey" look up "folder.mykey" in the JSON object.
 *
 * @see EnvSecretProvider for the interface this implements
 */
import type { SecretProviderKind } from "../../contracts/types/domain.js";
import { type ManagedSecretProvider, type SecretProviderIssuedLease, type SecretProviderMetadata, type SecretProviderValue } from "./env-secret-provider.js";
/**
 * Provider kinds supported by ExternalSecretProvider.
 * Excludes "environment" since that's handled by EnvSecretProvider directly.
 */
type ExternalSecretProviderKind = Exclude<SecretProviderKind, "environment">;
/**
 * Configuration options for ExternalSecretProvider.
 */
interface ExternalSecretProviderOptions {
    providerKind: ExternalSecretProviderKind;
    env?: NodeJS.ProcessEnv;
}
/**
 * External Secret Provider
 *
 * Retrieves secrets from JSON configuration in environment variables
 * or JSON files. Used as fallback when primary providers are unavailable.
 */
export declare class ExternalSecretProvider {
    private readonly env;
    readonly providerKind: ExternalSecretProviderKind;
    constructor(options: ExternalSecretProviderOptions);
    /**
     * Describes a secret without revealing its value.
     * Checks if the secret exists in the configured source.
     *
     * @param secretRef - Secret reference to describe
     * @returns Metadata about the secret
     */
    describeSecret(secretRef: string): Promise<SecretProviderMetadata>;
    /**
     * Retrieves the actual secret value from the configured source.
     *
     * @param secretRef - Secret reference to retrieve
     * @returns Metadata with the secret value
     * @throws ValidationError if the secret is not found
     */
    requireSecret(secretRef: string): Promise<SecretProviderValue>;
    /**
     * Issues a secret lease from external configuration.
     * Returns null if the secret has no lease configuration.
     *
     * @param secretRef - Secret reference
     * @returns Lease information or null
     */
    issueSecretLease(secretRef: string): Promise<SecretProviderIssuedLease | null>;
    /**
     * Checks if a secrets source is configured.
     *
     * @returns true if inline JSON or secrets file is configured
     */
    hasConfiguredSource(): boolean;
    /**
     * Reads and parses the configured secrets source.
     * Checks file path first, then inline JSON.
     *
     * @returns Parsed secrets or null if not configured
     */
    private readConfiguredSecrets;
}
/**
 * Async adapter that wraps ExternalSecretProvider to implement ManagedSecretProvider interface.
 * This allows ExternalSecretProvider to be used where async secret providers are expected.
 */
export declare class ExternalSecretProviderAdapter implements ManagedSecretProvider {
    private readonly provider;
    readonly providerKind: ExternalSecretProviderKind;
    constructor(provider: ExternalSecretProvider);
    describeSecret(secretRef: string): Promise<SecretProviderMetadata>;
    requireSecret(secretRef: string): Promise<SecretProviderMetadata & {
        value: string;
    }>;
    refreshSecret(secretRef: string): Promise<SecretProviderMetadata>;
    issueSecretLease?(secretRef: string): Promise<SecretProviderIssuedLease | null>;
    isConfigured(): boolean;
}
export {};
