/**
 * Provider Credential Pool
 */
export * from "./provider-credential-pool-support.js";
import { type ProviderCredentialEnvLoadOptions, type ProviderCredentialFailureSignal, type ProviderCredentialPoolExhaustion, type ProviderCredentialPoolOptions, type ProviderCredentialPoolState, type ProviderCredentialRecord, type ProviderCredentialSelection } from "./provider-credential-pool-support.js";
export declare class ProviderCredentialPool {
    private readonly provider;
    private readonly credentials;
    private readonly orderedIds;
    private readonly defaultCooldownMs;
    private readonly managedSecretAccess;
    private disposed;
    constructor(options: ProviderCredentialPoolOptions);
    /**
     * Creates a credential pool from environment variables
     * Automatically loads credentials from standard env var patterns
     */
    static fromEnvironment(provider: string, providerEnv: NodeJS.ProcessEnv, defaultCooldownMs?: number, options?: ProviderCredentialEnvLoadOptions): ProviderCredentialPool;
    getProvider(): string;
    /**
     * Returns the current state of all credentials
     */
    getStates(now?: string): ProviderCredentialPoolState[];
    /**
     * Selects an available credential for use
     *
     * Selection priority:
     * 1. Preferred credential (if specified and available)
     * 2. First available active credential
     * 3. Credential reactivated after cooldown
     */
    selectCredential(options?: {
        preferredCredentialId?: string | null;
        excludeCredentialIds?: string[];
        now?: string;
    }): Promise<ProviderCredentialSelection | null>;
    /**
     * Marks a credential as successfully used
     * Resets cooldown and failure state
     */
    markSuccess(credentialId: string): ProviderCredentialRecord | null;
    /**
     * Marks a credential as failed with a specific error
     * Updates cooldown based on error type
     */
    markFailure(signal: ProviderCredentialFailureSignal): ProviderCredentialRecord | null;
    /**
     * Checks if failover to another credential is possible after a failure
     */
    canFailoverAfter(signal: {
        statusCode: number;
        retryAfterMs?: number | null;
        resetAt?: string | null;
        excludeCredentialIds?: string[];
        now?: string;
    }): Promise<boolean>;
    /**
     * Releases a credential after request completion
     * For managed secrets with leases, revokes the lease
     */
    releaseCredential(selection: Pick<ProviderCredentialSelection, "credentialId" | "leaseId">, reasonCode?: string): ProviderCredentialRecord | null;
    /**
     * Returns exhaustion information when no credentials are available
     */
    getExhaustion(now?: string): ProviderCredentialPoolExhaustion;
    /**
     * Releases all active managed-secret leases and rejects subsequent operations.
     */
    dispose(reasonCode?: string): void;
    /**
     * Builds a credential selection with resolved API key
     * Handles secret materialization for managed secrets
     */
    private buildSelection;
    /**
     * Materializes a credential by resolving its secret reference
     * Uses lease-based access if configured, otherwise direct resolution
     */
    private materializeCredential;
    private buildManagedSecretContext;
    private releaseLeaseState;
    private assertNotDisposed;
}
