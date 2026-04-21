/**
 * AsyncSecretRepository - Async data access for secret registry, leases, rotation events, and usage audits.
 */
import type { SecretLeaseRecord, SecretRegistryRecord, SecretRotationEventRecord, SecretUsageAuditRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncSecretRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    upsertSecretRegistryRecord(record: SecretRegistryRecord): Promise<void>;
    insertSecretUsageAudit(record: SecretUsageAuditRecord): Promise<void>;
    insertSecretRotationEvent(record: SecretRotationEventRecord): Promise<void>;
    upsertSecretLeaseRecord(record: SecretLeaseRecord): Promise<void>;
    getSecretRegistryRecord(secretRef: string): Promise<SecretRegistryRecord | null>;
    listSecretRegistryRecords(): Promise<SecretRegistryRecord[]>;
    listSecretUsageAuditsBySecretRef(secretRef: string): Promise<SecretUsageAuditRecord[]>;
    listSecretRotationEventsBySecretRef(secretRef: string): Promise<SecretRotationEventRecord[]>;
    getSecretLeaseRecord(leaseId: string): Promise<SecretLeaseRecord | null>;
    listSecretLeasesBySecretRef(secretRef: string): Promise<SecretLeaseRecord[]>;
}
