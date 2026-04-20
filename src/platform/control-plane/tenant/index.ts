import { TenantBoundaryError, ValidationError } from "../../contracts/errors.js";
import type {
  DeploymentBindingRecord,
  OrganizationMembershipRecord,
  OrganizationRecord,
  TenantRecord,
  WorkspaceMembershipRecord,
  WorkspaceRecord,
} from "../../contracts/types/domain.js";
import { nowIso } from "../../contracts/types/ids.js";

export interface UserAccount {
  userId: string;
  displayName: string;
  status: "active" | "disabled";
  identityProvider: string;
  createdAt: string;
}

export interface TenantBoundaryTopologySeed {
  users?: Array<Omit<UserAccount, "createdAt"> & { createdAt?: string }>;
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

export class TenantBoundaryRegistryService {
  private readonly users = new Map<string, UserAccount>();
  private readonly workspaces = new Map<string, WorkspaceRecord>();
  private readonly workspaceMemberships = new Map<string, WorkspaceMembershipRecord>();
  private readonly organizations = new Map<string, OrganizationRecord>();
  private readonly organizationMemberships = new Map<string, OrganizationMembershipRecord>();
  private readonly tenants = new Map<string, TenantRecord>();
  private readonly deploymentBindings = new Map<string, DeploymentBindingRecord>();

  public constructor(seed: TenantBoundaryTopologySeed = {}) {
    seed.users?.forEach((record) => this.registerUser(record));
    seed.organizations?.forEach((record) => this.registerOrganization(record));
    seed.workspaces?.forEach((record) => this.registerWorkspace(record));
    seed.tenants?.forEach((record) => this.registerTenant(record));
    seed.workspaceMemberships?.forEach((record) => this.addWorkspaceMembership(record));
    seed.organizationMemberships?.forEach((record) => this.addOrganizationMembership(record));
    seed.deploymentBindings?.forEach((record) => this.registerDeploymentBinding(record));
  }

  public registerUser(input: Omit<UserAccount, "createdAt"> & { createdAt?: string }): UserAccount {
    const user: UserAccount = {
      ...input,
      userId: assertId(input.userId, "tenant.invalid_user_id"),
      displayName: assertText(input.displayName, "tenant.invalid_user_display_name"),
      identityProvider: assertId(input.identityProvider, "tenant.invalid_identity_provider"),
      createdAt: input.createdAt ?? nowIso(),
    };
    this.users.set(user.userId, user);
    return user;
  }

  public registerWorkspace(record: WorkspaceRecord): WorkspaceRecord {
    assertId(record.workspaceId, "tenant.invalid_workspace_id");
    if (record.organizationId != null) {
      this.requireOrganization(record.organizationId);
    }
    this.workspaces.set(record.workspaceId, record);
    return record;
  }

  public registerOrganization(record: OrganizationRecord): OrganizationRecord {
    assertId(record.organizationId, "tenant.invalid_organization_id");
    this.organizations.set(record.organizationId, record);
    return record;
  }

  public registerTenant(record: TenantRecord): TenantRecord {
    assertId(record.tenantId, "tenant.invalid_tenant_id");
    this.requireOrganization(record.organizationId);
    this.tenants.set(record.tenantId, record);
    return record;
  }

  public registerDeploymentBinding(record: DeploymentBindingRecord): DeploymentBindingRecord {
    this.requireTenant(record.tenantId);
    this.deploymentBindings.set(record.bindingId, record);
    return record;
  }

  public addWorkspaceMembership(record: WorkspaceMembershipRecord): WorkspaceMembershipRecord {
    this.requireUser(record.userId);
    this.requireWorkspace(record.workspaceId);
    this.workspaceMemberships.set(`${record.workspaceId}:${record.userId}`, record);
    return record;
  }

  public addOrganizationMembership(record: OrganizationMembershipRecord): OrganizationMembershipRecord {
    this.requireUser(record.userId);
    this.requireOrganization(record.organizationId);
    this.organizationMemberships.set(`${record.organizationId}:${record.userId}`, record);
    return record;
  }

  public resolveTenantForWorkspace(workspaceId: string): TenantRecord | null {
    const workspace = this.requireWorkspace(workspaceId);
    if (workspace.organizationId == null) {
      return null;
    }
    const organization = this.requireOrganization(workspace.organizationId);
    return organization.defaultTenantId == null ? null : this.requireTenant(organization.defaultTenantId);
  }

  public authorizeTenantAccess(input: {
    userId: string;
    tenantId: string;
    workspaceId?: string | null;
    governanceRef?: string | null;
  }): TenantAccessDecision {
    const user = this.requireUser(input.userId);
    const tenant = this.requireTenant(input.tenantId);
    const workspace = input.workspaceId == null ? null : this.requireWorkspace(input.workspaceId);
    if (user.status !== "active") {
      return buildAccessDecision(input, tenant.organizationId, "deny", "tenant.user_disabled");
    }
    if (workspace != null && workspace.organizationId !== tenant.organizationId) {
      return buildAccessDecision(input, tenant.organizationId, "deny", "tenant.workspace_tenant_mismatch");
    }
    if (this.isOrganizationMember(input.userId, tenant.organizationId) || this.hasWorkspaceTenantAccess(input.userId, tenant)) {
      return buildAccessDecision(input, tenant.organizationId, "allow", "tenant.member_allowed");
    }
    if (input.governanceRef != null && input.governanceRef.trim().length > 0) {
      return buildAccessDecision(input, tenant.organizationId, "allow_with_governance_exception", "tenant.governance_exception");
    }
    return buildAccessDecision(input, tenant.organizationId, "deny", "tenant.default_deny");
  }

  public assertSameTenant(input: {
    sourceTenantId: string | null | undefined;
    targetTenantId: string | null | undefined;
    reasonCode?: string;
  }): void {
    if (input.sourceTenantId == null || input.targetTenantId == null || input.sourceTenantId !== input.targetTenantId) {
      throw new TenantBoundaryError(input.reasonCode ?? "tenant.cross_tenant_denied", "Cross-tenant access is denied by default.", {
        details: {
          sourceTenantId: input.sourceTenantId ?? null,
          targetTenantId: input.targetTenantId ?? null,
        },
      });
    }
  }

  public listDeploymentBindingsForTenant(tenantId: string): DeploymentBindingRecord[] {
    this.requireTenant(tenantId);
    return [...this.deploymentBindings.values()].filter((binding) => binding.tenantId === tenantId);
  }

  public listTenantsForUser(userId: string): TenantRecord[] {
    this.requireUser(userId);
    const organizationIds = new Set<string>();
    for (const membership of this.organizationMemberships.values()) {
      if (membership.userId === userId) {
        organizationIds.add(membership.organizationId);
      }
    }
    for (const membership of this.workspaceMemberships.values()) {
      if (membership.userId !== userId) {
        continue;
      }
      const workspace = this.workspaces.get(membership.workspaceId);
      if (workspace?.organizationId != null) {
        organizationIds.add(workspace.organizationId);
      }
    }
    return [...this.tenants.values()].filter((tenant) => organizationIds.has(tenant.organizationId));
  }

  public listTenants(limit = 50): TenantRecord[] {
    return [...this.tenants.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, Math.max(0, limit));
  }

  private hasWorkspaceTenantAccess(userId: string, tenant: TenantRecord): boolean {
    for (const membership of this.workspaceMemberships.values()) {
      if (membership.userId !== userId) {
        continue;
      }
      const workspace = this.workspaces.get(membership.workspaceId);
      if (workspace?.organizationId === tenant.organizationId) {
        return true;
      }
    }
    return false;
  }

  private isOrganizationMember(userId: string, organizationId: string): boolean {
    return this.organizationMemberships.has(`${organizationId}:${userId}`);
  }

  private requireUser(userId: string): UserAccount {
    const user = this.users.get(assertId(userId, "tenant.invalid_user_id"));
    if (user == null) {
      throw new ValidationError("tenant.user_not_found", "User account is not registered.", {
        details: { userId },
      });
    }
    return user;
  }

  private requireWorkspace(workspaceId: string): WorkspaceRecord {
    const workspace = this.workspaces.get(assertId(workspaceId, "tenant.invalid_workspace_id"));
    if (workspace == null) {
      throw new ValidationError("tenant.workspace_not_found", "Workspace is not registered.", {
        details: { workspaceId },
      });
    }
    return workspace;
  }

  private requireOrganization(organizationId: string): OrganizationRecord {
    const organization = this.organizations.get(assertId(organizationId, "tenant.invalid_organization_id"));
    if (organization == null) {
      throw new ValidationError("tenant.organization_not_found", "Organization is not registered.", {
        details: { organizationId },
      });
    }
    return organization;
  }

  private requireTenant(tenantId: string): TenantRecord {
    const tenant = this.tenants.get(assertId(tenantId, "tenant.invalid_tenant_id"));
    if (tenant == null) {
      throw new ValidationError("tenant.not_found", "Tenant is not registered.", {
        details: { tenantId },
      });
    }
    return tenant;
  }
}

function buildAccessDecision(
  input: { userId: string; tenantId: string; workspaceId?: string | null; governanceRef?: string | null },
  organizationId: string | null,
  decision: TenantAccessDecision["decision"],
  reasonCode: string,
): TenantAccessDecision {
  return {
    decision,
    reasonCode,
    userId: input.userId,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId ?? null,
    organizationId,
    governanceRef: input.governanceRef ?? null,
  };
}

function assertId(value: string, code: string): string {
  if (!/^[a-zA-Z0-9._:-]{2,128}$/.test(value)) {
    throw new ValidationError(code, "Tenant topology identifier is invalid.", {
      details: { value },
    });
  }
  return value;
}

function assertText(value: string, code: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new ValidationError(code, "Tenant topology text value is required.");
  }
  return normalized;
}
