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
export {};
//# sourceMappingURL=managed-secret-provider.js.map