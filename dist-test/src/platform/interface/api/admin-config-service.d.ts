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
export declare class AdminConfigService {
    private readonly records;
    applyUpdate(input: ApplyAdminConfigInput): AdminConfigRecord;
    listUpdates(limit?: number, tenantId?: string | null): AdminConfigRecord[];
}
