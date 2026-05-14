import { newId, nowIso } from "../../contracts/types/ids.js";

export interface AdminConfigRecord {
  readonly updateId: string;
  readonly key: string;
  readonly value: unknown;
  readonly tenantId: string | null;
  readonly updatedBy: string;
  readonly updatedAt: string;
  readonly deletedAt?: string;
  readonly deletedBy?: string;
}

export interface ApplyAdminConfigInput {
  readonly key: string;
  readonly value: unknown;
  readonly tenantId?: string | null;
  readonly updatedBy: string;
}

export interface DeleteAdminConfigInput {
  readonly key: string;
  readonly tenantId?: string;
  readonly deletedBy: string;
}

export class AdminConfigService {
  private readonly records = new Map<string, AdminConfigRecord>();
  private readonly recordOrder = new Map<string, number>();
  private nextRecordOrder = 0;

  public applyUpdate(input: ApplyAdminConfigInput): AdminConfigRecord {
    const record: AdminConfigRecord = {
      updateId: newId("config_update"),
      key: input.key,
      value: input.value,
      tenantId: input.tenantId ?? null,
      updatedBy: input.updatedBy,
      updatedAt: nowIso(),
    };
    this.records.set(record.updateId, record);
    this.recordOrder.set(record.updateId, ++this.nextRecordOrder);
    return record;
  }

  public listUpdates(limit = 50, tenantId?: string | null): AdminConfigRecord[] {
    return [...this.records.values()]
      .filter((record) => !record.deletedAt && (tenantId == null || record.tenantId === tenantId))
      .sort((left, right) => {
        const timeOrder = right.updatedAt.localeCompare(left.updatedAt);
        if (timeOrder !== 0) {
          return timeOrder;
        }
        const leftOrder = this.recordOrder.get(left.updateId) ?? 0;
        const rightOrder = this.recordOrder.get(right.updateId) ?? 0;
        return rightOrder - leftOrder;
      })
      .slice(0, Math.max(0, limit));
  }

  public deleteConfig(input: DeleteAdminConfigInput): AdminConfigRecord {
    const existing = [...this.records.values()].find(
      (r) => r.key === input.key && !r.deletedAt && (input.tenantId == null || r.tenantId === input.tenantId),
    );
    if (!existing) {
      throw new Error(`AdminConfigRecord not found for key: ${input.key}`);
    }
    const updated: AdminConfigRecord = {
      ...existing,
      deletedAt: nowIso(),
      deletedBy: input.deletedBy,
    };
    this.records.set(existing.updateId, updated);
    return updated;
  }
}
