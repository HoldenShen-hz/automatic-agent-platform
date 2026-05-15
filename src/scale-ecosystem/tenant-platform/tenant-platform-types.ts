import { ValidationError } from "../../platform/contracts/errors.js";
import type {
  DataNamespacePlane,
  DataNamespaceRecord,
  DeploymentBindingRecord,
  DeploymentMode,
  OrganizationMembershipRecord,
  OrganizationRecord,
  TenantIsolationMode,
  TenantRecord,
  WorkspaceMembershipRecord,
  WorkspaceRecord,
} from "../../platform/contracts/types/domain.js";
import type { EncryptionAlgorithm } from "../multi-region/per-tenant-encryption.js";
import type { ResourcePool } from "../resource-manager/resource-pool-service.js";

export function assertIdentifier(value: string, code: string): string {
  if (!/^[a-zA-Z0-9._:-]{2,128}$/.test(value)) {
    throw new ValidationError(code, code, {
      category: "tenant",
      source: "runtime",
      details: { value },
    });
  }
  return value;
}

export function assertNonEmpty(value: string, code: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new ValidationError(code, code, {
      category: "tenant",
      source: "runtime",
    });
  }
  return normalized;
}

export interface CreateWorkspaceInput {
  workspaceId?: string;
  ownerId: string;
  displayName: string;
  planId: string;
  defaultPolicySet?: string;
  organizationId?: string | null;
  createdAt?: string;
}

export interface AddWorkspaceMembershipInput {
  workspaceId: string;
  userId: string;
  role: string;
  joinedAt?: string;
}

export interface CreateOrganizationInput {
  organizationId?: string;
  displayName: string;
  billingAccountId?: string | null;
  defaultTenantId?: string | null;
  createdAt?: string;
}

export interface AddOrganizationMembershipInput {
  organizationId: string;
  userId: string;
  role: string;
  joinedAt?: string;
}

export interface CreateTenantInput {
  tenantId?: string;
  organizationId: string;
  storageScope: string;
  identityScope: string;
  policyScope: string;
  artifactScope: string;
  isolationMode?: TenantIsolationMode;
  deploymentMode?: DeploymentMode;
  createdAt?: string;
  setAsOrganizationDefault?: boolean;
  encryptionConfig?: {
    algorithm?: EncryptionAlgorithm;
    keyRotationPeriodDays?: number;
    enforceHardwareSecurityModule?: boolean;
  };
}

export interface CreateDeploymentBindingInput {
  bindingId?: string;
  tenantId: string;
  environmentId: string;
  deploymentMode: DeploymentMode;
  region: string;
  networkBoundary: string;
  createdAt?: string;
}

export interface CreateDataNamespaceInput {
  namespaceId?: string;
  plane: DataNamespacePlane;
  tenantId?: string | null;
  organizationId?: string | null;
  workspaceId?: string | null;
  retentionPolicy: string;
  encryptionPolicy: string;
  residencyPolicy?: string | null;
  createdAt?: string;
}

export interface TenantTopologySummary {
  generatedAt: string;
  counts: {
    workspaces: number;
    workspaceMemberships: number;
    organizations: number;
    organizationMemberships: number;
    tenants: number;
    deploymentBindings: number;
    dataNamespaces: number;
  };
  workspaces: Array<WorkspaceRecord & { memberships: WorkspaceMembershipRecord[] }>;
  organizations: Array<OrganizationRecord & { memberships: OrganizationMembershipRecord[] }>;
  tenants: TenantRecord[];
  deploymentBindings: DeploymentBindingRecord[];
  dataNamespaces: DataNamespaceRecord[];
}

export interface DedicatedPoolIsolationRecord {
  readonly tenantId: string;
  readonly organizationId: string;
  readonly resourcePool: ResourcePool;
  readonly routingPolicy: "dedicated_pool_only";
  readonly executionIsolation: "tenant_scoped_worker_pool";
  readonly provisionedAt: string;
  readonly quotaScopeId: string;
}

export type TenantLifecycleStage = "provisioning" | "active" | "suspended" | "deactivated" | "decommissioned";

export interface TenantLifecycleInput {
  tenantId: string;
  actor: string;
  reason: string;
}

export function toTenantStatus(stage: TenantLifecycleStage): "active" | "suspended" | "terminated" {
  switch (stage) {
    case "provisioning":
    case "active":
    case "deactivated":
      return "active";
    case "suspended":
      return "suspended";
    case "decommissioned":
      return "terminated";
  }
}

export function fromTenantStatus(status: "active" | "suspended" | "terminated" | undefined): TenantLifecycleStage {
  switch (status) {
    case "suspended":
      return "suspended";
    case "terminated":
      return "decommissioned";
    case "active":
    default:
      return "active";
  }
}

export const VALID_LIFECYCLE_TRANSITIONS: Record<TenantLifecycleStage, TenantLifecycleStage[]> = {
  provisioning: ["active", "decommissioned"],
  active: ["suspended", "deactivated", "decommissioned"],
  suspended: ["active", "deactivated", "decommissioned"],
  deactivated: ["active", "decommissioned"],
  decommissioned: [],
};
