import type { DeploymentBindingRecord, OrganizationMembershipRecord, OrganizationRecord, TenantRecord, WorkspaceMembershipRecord, WorkspaceRecord } from "../../contracts/types/domain.js";
export interface UserAccount {
    userId: string;
    displayName: string;
    status: "active" | "disabled";
    identityProvider: string;
    createdAt: string;
}
export interface TenantBoundaryTopologySeed {
    users?: Array<Omit<UserAccount, "createdAt"> & {
        createdAt?: string;
    }>;
    workspaces?: WorkspaceRecord[];
    workspaceMemberships?: WorkspaceMembershipRecord[];
    organizations?: OrganizationRecord[];
    organizationMemberships?: OrganizationMembershipRecord[];
    tenants?: TenantRecord[];
    deploymentBindings?: DeploymentBindingRecord[];
}
export interface TenantAccessDecision {
    decision: "allow" | "deny" | "allow_with_governance_exception";
    reasonCode: string;
    userId: string;
    tenantId: string;
    workspaceId: string | null;
    organizationId: string | null;
    governanceRef: string | null;
}
export declare class TenantBoundaryRegistryService {
    private readonly users;
    private readonly workspaces;
    private readonly workspaceMemberships;
    private readonly organizations;
    private readonly organizationMemberships;
    private readonly tenants;
    private readonly deploymentBindings;
    constructor(seed?: TenantBoundaryTopologySeed);
    registerUser(input: Omit<UserAccount, "createdAt"> & {
        createdAt?: string;
    }): UserAccount;
    registerWorkspace(record: WorkspaceRecord): WorkspaceRecord;
    registerOrganization(record: OrganizationRecord): OrganizationRecord;
    registerTenant(record: TenantRecord): TenantRecord;
    registerDeploymentBinding(record: DeploymentBindingRecord): DeploymentBindingRecord;
    addWorkspaceMembership(record: WorkspaceMembershipRecord): WorkspaceMembershipRecord;
    addOrganizationMembership(record: OrganizationMembershipRecord): OrganizationMembershipRecord;
    resolveTenantForWorkspace(workspaceId: string): TenantRecord | null;
    authorizeTenantAccess(input: {
        userId: string;
        tenantId: string;
        workspaceId?: string | null;
        governanceRef?: string | null;
    }): TenantAccessDecision;
    assertSameTenant(input: {
        sourceTenantId: string | null | undefined;
        targetTenantId: string | null | undefined;
        reasonCode?: string;
    }): void;
    listDeploymentBindingsForTenant(tenantId: string): DeploymentBindingRecord[];
    listTenantsForUser(userId: string): TenantRecord[];
    listTenants(limit?: number): TenantRecord[];
    private hasWorkspaceTenantAccess;
    private isOrganizationMember;
    private requireUser;
    private requireWorkspace;
    private requireOrganization;
    private requireTenant;
}
