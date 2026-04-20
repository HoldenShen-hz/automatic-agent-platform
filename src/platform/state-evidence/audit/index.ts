import { newId, nowIso } from "../../contracts/types/ids.js";

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

export class AuditTrailService {
  private readonly records: AuditRecord[] = [];

  public record(input: Omit<AuditRecord, "auditId" | "createdAt"> & { createdAt?: string }): AuditRecord {
    const record: AuditRecord = {
      ...input,
      auditId: newId("audit"),
      createdAt: input.createdAt ?? nowIso(),
    };
    this.records.push(record);
    return record;
  }

  public exportForTask(taskId: string): AuditRecord[] {
    return this.records.filter((record) => record.taskId === taskId);
  }

  public exportForTenant(tenantId: string): AuditRecord[] {
    return this.records.filter((record) => record.tenantId === tenantId);
  }

  public listRecords(): AuditRecord[] {
    return [...this.records];
  }
}
