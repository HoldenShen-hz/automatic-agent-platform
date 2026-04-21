export type AuditActorType = "user" | "agent" | "system" | "scheduler" | "admin" | "webhook" | "recovery";
export interface AuditRecord {
    auditId: string;
    actorType: AuditActorType;
    actorId: string;
    tenantId: string | null;
    taskId: string | null;
    executionId: string | null;
    action: string;
    resourceRef: string;
    decisionRef: string | null;
    versionRef: string | null;
    createdAt: string;
    metadata: Record<string, unknown>;
}
export declare class AuditTrailService {
    private readonly records;
    record(input: Omit<AuditRecord, "auditId" | "createdAt"> & {
        createdAt?: string;
    }): AuditRecord;
    exportForTask(taskId: string): AuditRecord[];
    exportForTenant(tenantId: string): AuditRecord[];
    listRecords(): AuditRecord[];
}
