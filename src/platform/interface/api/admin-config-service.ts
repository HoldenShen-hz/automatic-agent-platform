import { newId, nowIso } from "../../contracts/types/ids.js";

export interface AdminConfigRecord {
  readonly updateId: string;
  readonly key: string;
  readonly value: unknown;
  readonly tenantId: string | null;
  readonly updatedBy: string;
  readonly updatedAt: string;
}

export interface ApplyAdminConfigInput {
  readonly key: string;
  readonly value: unknown;
  readonly tenantId?: string | null;
  readonly updatedBy: string;
}

export class AdminConfigService {
  private readonly records = new Map<string, AdminConfigRecord>();

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
    return record;
  }

  public listUpdates(limit = 50, tenantId?: string | null): AdminConfigRecord[] {
    return [...this.records.values()]
      .filter((record) => tenantId == null || record.tenantId === tenantId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, Math.max(0, limit));
  }
}
