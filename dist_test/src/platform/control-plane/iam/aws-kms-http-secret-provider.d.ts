/**
 * AWS KMS HTTP Secret Provider
 *
 * Retrieves secrets encrypted with AWS KMS using native HTTP.
 * No AWS SDK dependencies - implements AWS Signature Version 4 manually.
 *
 * ## Purpose
 *
 * Allows retrieval of secrets that were encrypted with AWS KMS.
 * The encrypted ciphertext is stored in an environment variable, and
 * this provider decrypts it using the KMS API.
 *
 * ## Configuration
 *
 * - AA_AWS_KMS_KEY_ARN: KMS key ARN (e.g., arn:aws:kms:us-east-1:123456:key/xxx)
 * - AA_AWS_REGION: AWS region (e.g., us-east-1)
 * - AA_AWS_ACCESS_KEY_ID: AWS access key
 * - AA_AWS_SECRET_ACCESS_KEY: AWS secret access key
 * - AA_AWS_SESSION_TOKEN: Optional STS session token
 * - AA_AWS_KMS_ENDPOINT: Custom KMS endpoint
 * - AA_AWS_TIMEOUT_MS: Request timeout (default: 5000)
 *
 * ## Usage
 *
 * 1. Encrypt a secret using AWS KMS
 * 2. Store the base64-encoded ciphertext in an environment variable:
 *    AA_KMS_CIPHERTEXT_{KEY_ID}=base64(ciphertext)
 * 3. Reference the secret as "secret://kms/keyId"
 *
 * @see https://docs.aws.amazon.com/kms/latest/developerguide/
 */
import { type SecretProviderIssuedLease, type SecretProviderMetadata, type ManagedSecretProvider } from "./env-secret-provider.js";
/**
 * Configuration options for AWS KMS provider.
 */
export interface AwsKmsHttpProviderOptions {
    /** Environment to read config from */
    env?: NodeJS.ProcessEnv;
}
/**
 * AWS KMS HTTP Secret Provider
 *
 * Decrypts secrets encrypted with AWS KMS.
 * Uses AWS Signature Version 4 for authentication.
 */
export declare class AwsKmsHttpSecretProvider implements ManagedSecretProvider {
    readonly providerKind: "kms";
    private readonly env;
    private readonly timeoutMs;
    private readonly endpoint;
    constructor(options?: AwsKmsHttpProviderOptions);
    isConfigured(): boolean;
    refreshSecret(secretRef: string): Promise<SecretProviderMetadata>;
    /**
     * Performs a fetch with timeout.
     */
    private fetchWithTimeout;
    /**
     * Extracts the KMS key ID from a secret reference.
     */
    private extractKeyId;
    /**
     * Makes an authenticated AWS KMS API request.
     * Implements full AWS Signature Version 4 signing.
     *
     * @param method - HTTP method
     * @param action - KMS API action name
     * @param payload - Request payload
     * @returns Parsed response data
     */
    private awsRequest;
    /**
     * Checks if KMS provider is available.
     *
     * @returns true if credentials are configured and KMS responds
     */
    isAvailable(): Promise<boolean>;
    /**
     * Describes a secret without decrypting it.
     *
     * @param secretRef - Secret reference
     * @returns Metadata about the secret
     */
    describeSecret(secretRef: string): Promise<SecretProviderMetadata>;
    /**
     * Decrypts a KMS-encrypted secret.
     * The ciphertext must be stored in an environment variable.
     *
     * @param secretRef - Secret reference
     * @returns Decrypted secret value
     * @throws ValidationError if key or ciphertext not configured
     */
    requireSecret(secretRef: string): Promise<SecretProviderMetadata & {
        value: string;
    }>;
    /**
     * AWS KMS symmetric keys don't have native lease model.
     *
     * @returns null (not supported)
     */
    issueSecretLease(_secretRef: string): Promise<SecretProviderIssuedLease | null>;
}
