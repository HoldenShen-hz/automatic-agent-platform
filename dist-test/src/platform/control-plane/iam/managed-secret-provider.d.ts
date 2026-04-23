/**
 * Managed Secret Provider Interface
 *
 * Defines the contract for secret providers used by SecretManagementService.
 * All providers (environment variables, Vault, AWS KMS, GCP Secret Manager)
 * implement this interface to provide a consistent API for secret operations.
 *
 * ## Why This Interface Exists
 *
 * Different secrets come from different sources:
 * - Environment variables (development, simple deployments)
 * - HashiCorp Vault (enterprise, dynamic secrets)
 * - AWS KMS (encryption keys, AWS-native)
 * - GCP Secret Manager (GCP-native deployments)
 *
 * This interface abstracts over these providers so SecretManagementService
 * can work with any of them uniformly.
 *
 * @see SecretManagementService for the service that uses this interface
 */
import type { SecretProviderIssuedLease } from "./env-secret-provider.js";
import type { SecretProviderKind } from "../../contracts/types/domain.js";
import type { SecretProviderMetadata } from "./env-secret-provider.js";
/**
 * Core interface for secret providers used by SecretManagementService.
 * All providers (env, vault, kms, gcp) implement this interface.
 *
 * ## Implemented By
 * - EnvSecretProvider: Environment variable-based secrets
 * - VaultHttpSecretProvider: HashiCorp Vault KV v2
 * - AwsKmsHttpSecretProvider: AWS KMS-encrypted secrets
 * - GcpSecretManagerHttpSecretProvider: GCP Secret Manager
 * - ExternalSecretProvider: JSON/config-file based external secrets
 */
export interface ManagedSecretProvider {
    /** The type/kind of this provider */
    readonly providerKind: SecretProviderKind;
    /**
     * Describes a secret without revealing its value.
     * Use this to check if a secret exists and get metadata.
     *
     * @param secretRef - Secret reference (e.g., "secret://mykey")
     * @returns Metadata about the secret including whether it's resolved
     */
    describeSecret(secretRef: string): Promise<SecretProviderMetadata>;
    /**
     * Retrieves the actual secret value.
     * Use this when you need the actual secret content.
     *
     * @param secretRef - Secret reference (e.g., "secret://mykey")
     * @returns Metadata with the secret value included
     */
    requireSecret(secretRef: string): Promise<SecretProviderMetadata & {
        value: string;
    }>;
    /**
     * Issues a time-limited lease for a secret.
     * Some providers support dynamic secrets with automatic expiration.
     *
     * @param secretRef - Secret reference
     * @returns Lease information if supported, null otherwise
     */
    issueSecretLease?(secretRef: string): Promise<SecretProviderIssuedLease | null>;
}
