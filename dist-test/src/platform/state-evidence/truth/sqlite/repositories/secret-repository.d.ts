import type { SecretLeaseRecord, SecretRegistryRecord, SecretRotationEventRecord, SecretUsageAuditRecord } from "../../../../contracts/types/domain.js";
import type { AuthoritativeSqlDatabase } from "../sqlite-database.js";
/**
 * Standalone repository boundary for secret registry / lease / rotation / audit.
 */
export declare class SecretRepository {
    private readonly db;
    constructor(db: AuthoritativeSqlDatabase);
    upsertSecretRegistryRecord(record: SecretRegistryRecord): void;
    insertSecretUsageAudit(record: SecretUsageAuditRecord): void;
    insertSecretRotationEvent(record: SecretRotationEventRecord): void;
    upsertSecretLeaseRecord(record: SecretLeaseRecord): void;
    getSecretRegistryRecord(secretRef: string): SecretRegistryRecord | null;
    listSecretRegistryRecords(): SecretRegistryRecord[];
    listSecretUsageAuditsBySecretRef(secretRef: string): SecretUsageAuditRecord[];
    listSecretRotationEventsBySecretRef(secretRef: string): SecretRotationEventRecord[];
    getSecretLeaseRecord(leaseId: string): SecretLeaseRecord | null;
    listSecretLeasesBySecretRef(secretRef: string): SecretLeaseRecord[];
}
