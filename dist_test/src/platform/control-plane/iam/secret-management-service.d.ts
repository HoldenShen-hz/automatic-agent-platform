/**
 * Secret Management Service
 */
export * from "./secret-management-support.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { SecretLeaseRecord, SecretRegistryRecord, SecretRotationEventRecord } from "../../contracts/types/domain.js";
import { type IssueSecretLeaseInput, type ManagedSecretDescription, type ManagedSecretLease, type ManagedSecretResolution, type ManagedSecretValue, type RecordSecretRotationInput, type ResolveManagedSecretInput, type RevokeSecretLeaseInput, type SecretAuditSummary, type SecretManagementServiceOptions, type SecretRegistryInput } from "./secret-management-support.js";
export declare class SecretManagementService {
    private readonly db;
    private readonly store;
    private readonly providers;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, options?: SecretManagementServiceOptions);
    /**
     * Registers a new secret in the registry.
     *
     * @param input - Secret registration details
     * @returns The created registry record
     */
    registerSecret(input: SecretRegistryInput): SecretRegistryRecord;
    /**
     * Resolves a secret and records the usage.
     *
     * @param input - Resolution request
     * @returns The secret value with audit record
     */
    resolveSecret(input: ResolveManagedSecretInput): Promise<ManagedSecretResolution>;
    /**
     * Requires a secret value, throwing if not available.
     */
    requireSecret(secretRef: string): Promise<ManagedSecretValue>;
    /**
     * Describes a secret without returning the value.
     */
    describeSecret(secretRef: string): Promise<ManagedSecretDescription>;
    /**
     * Records a secret rotation event.
     */
    recordRotationEvent(input: RecordSecretRotationInput): SecretRotationEventRecord;
    /**
     * Lists secrets with rotation due.
     */
    listRotationDueSecrets(asOf?: string): SecretRegistryRecord[];
    /**
     * Builds a complete audit summary for a secret.
     */
    buildAuditSummary(secretRef: string, generatedAt?: string): SecretAuditSummary;
    /**
     * Refreshes provider-backed metadata for a registered secret.
     */
    refreshSecret(secretRef: string): Promise<ManagedSecretDescription>;
    /**
     * Marks all due secrets as rotation-requested.
     */
    requestDueRotations(asOf?: string, requestedBy?: string): SecretRotationEventRecord[];
    /**
     * Issues a time-limited lease for a secret.
     */
    issueSecretLease(input: IssueSecretLeaseInput): Promise<ManagedSecretLease>;
    /**
     * Revokes a secret lease.
     */
    revokeSecretLease(input: RevokeSecretLeaseInput): SecretLeaseRecord;
    /**
     * Lists leases for a secret, normalizing status.
     */
    listSecretLeases(secretRef: string, asOf?: string): SecretLeaseRecord[];
    /**
     * Gets a registry record or throws.
     */
    private requireRegistryRecord;
    /**
     * Gets a lease record or throws.
     */
    private requireLeaseRecord;
    /**
     * Merges metadata JSON objects.
     */
    private mergeMetadataJson;
}
