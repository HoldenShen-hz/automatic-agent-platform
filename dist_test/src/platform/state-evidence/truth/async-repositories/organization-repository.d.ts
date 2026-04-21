/**
 * AsyncOrganizationRepository - Async data access for workspaces, organizations, tenants, and namespaces.
 */
import type { DataNamespaceRecord, DeploymentBindingRecord, OrganizationMembershipRecord, OrganizationRecord, TenantRecord, WorkspaceMembershipRecord, WorkspaceRecord } from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
export declare class AsyncOrganizationRepository {
    private readonly conn;
    constructor(conn: AsyncSqlConnection);
    upsertWorkspaceRecord(record: WorkspaceRecord): Promise<void>;
    upsertWorkspaceMembershipRecord(record: WorkspaceMembershipRecord): Promise<void>;
    upsertOrganizationRecord(record: OrganizationRecord): Promise<void>;
    upsertOrganizationMembershipRecord(record: OrganizationMembershipRecord): Promise<void>;
    upsertTenantRecord(record: TenantRecord): Promise<void>;
    upsertDeploymentBindingRecord(record: DeploymentBindingRecord): Promise<void>;
    upsertDataNamespaceRecord(record: DataNamespaceRecord): Promise<void>;
    getWorkspaceRecord(workspaceId: string): Promise<WorkspaceRecord | null>;
    listWorkspaceRecords(options?: {
        organizationId?: string | null;
        limit?: number;
    }): Promise<WorkspaceRecord[]>;
    listWorkspaceMemberships(workspaceId: string): Promise<WorkspaceMembershipRecord[]>;
    getOrganizationRecord(organizationId: string): Promise<OrganizationRecord | null>;
    listOrganizationRecords(limit?: number): Promise<OrganizationRecord[]>;
    listOrganizationMemberships(organizationId: string): Promise<OrganizationMembershipRecord[]>;
    getTenantRecord(tenantId: string): Promise<TenantRecord | null>;
    listTenantRecords(options?: {
        organizationId?: string | null;
        limit?: number;
    }): Promise<TenantRecord[]>;
    getDeploymentBindingRecord(bindingId: string): Promise<DeploymentBindingRecord | null>;
    listDeploymentBindings(options?: {
        tenantId?: string | null;
        limit?: number;
    }): Promise<DeploymentBindingRecord[]>;
    getDataNamespaceRecord(namespaceId: string): Promise<DataNamespaceRecord | null>;
    listDataNamespaces(options?: {
        plane?: DataNamespaceRecord["plane"] | null;
        tenantId?: string | null;
        organizationId?: string | null;
        workspaceId?: string | null;
        limit?: number;
    }): Promise<DataNamespaceRecord[]>;
}
