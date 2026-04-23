import type { DataNamespaceRecord, DeploymentBindingRecord, OrganizationMembershipRecord, OrganizationRecord, TenantRecord, WorkspaceMembershipRecord, WorkspaceRecord } from "../../../../contracts/types/domain.js";
import type { AuthoritativeSqlDatabase } from "../sqlite-database.js";
/**
 * Standalone repository boundary for workspace / organization / tenant /
 * namespace / deployment-binding records.
 */
export declare class OrganizationRepository {
    private readonly db;
    constructor(db: AuthoritativeSqlDatabase);
    upsertWorkspaceRecord(record: WorkspaceRecord): void;
    upsertWorkspaceMembershipRecord(record: WorkspaceMembershipRecord): void;
    upsertOrganizationRecord(record: OrganizationRecord): void;
    upsertOrganizationMembershipRecord(record: OrganizationMembershipRecord): void;
    upsertTenantRecord(record: TenantRecord): void;
    upsertDeploymentBindingRecord(record: DeploymentBindingRecord): void;
    upsertDataNamespaceRecord(record: DataNamespaceRecord): void;
    getWorkspaceRecord(workspaceId: string): WorkspaceRecord | null;
    listWorkspaceRecords(options?: {
        organizationId?: string | null;
        limit?: number;
    }): WorkspaceRecord[];
    listWorkspaceMemberships(workspaceId: string): WorkspaceMembershipRecord[];
    getOrganizationRecord(organizationId: string): OrganizationRecord | null;
    listOrganizationRecords(limit?: number): OrganizationRecord[];
    listOrganizationMemberships(organizationId: string): OrganizationMembershipRecord[];
    getTenantRecord(tenantId: string): TenantRecord | null;
    listTenantRecords(options?: {
        organizationId?: string | null;
        limit?: number;
    }): TenantRecord[];
    getDeploymentBindingRecord(bindingId: string): DeploymentBindingRecord | null;
    listDeploymentBindings(options?: {
        tenantId?: string | null;
        limit?: number;
    }): DeploymentBindingRecord[];
    getDataNamespaceRecord(namespaceId: string): DataNamespaceRecord | null;
    listDataNamespaces(options?: {
        plane?: DataNamespaceRecord["plane"] | null;
        tenantId?: string | null;
        organizationId?: string | null;
        workspaceId?: string | null;
        limit?: number;
    }): DataNamespaceRecord[];
}
