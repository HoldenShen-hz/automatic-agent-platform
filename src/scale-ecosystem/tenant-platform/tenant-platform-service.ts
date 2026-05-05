/**
 * Tenant Platform Service
 *
 * Manages the hierarchical tenant topology: Organizations contain Workspaces,
 * Workspaces contain Tenants, and Tenants are bound to Deployments with
 * DataNamespaces. This service provides CRUD operations for all topology
 * entities and enforces organizational boundaries and data residency rules.
 *
 * The hierarchy is:
 * - Organization: Top-level billing and policy container
 * - Workspace: Team-level resource grouping with membership
 * - Tenant: Isolated execution context with scopes for storage, identity, policy, and artifacts
 * - DeploymentBinding: Runtime deployment of a tenant in a specific environment/region
 * - DataNamespace: Data plane namespace scoped to a specific plane (transactional, analytics, etc.)
 *
 * @see docs_zh/architecture/00-platform-architecture.md for topology architecture
 * @see docs_zh/contracts/billing_contract.md for billing-account binding rules
 */

import { MonetizationError, TenantBoundaryError, ValidationError } from "../../platform/contracts/errors.js";
import { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
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
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { QuotaEnforcerService, type QuotaPolicy, type MultiResourceQuotaVector, type MultiDimensionalQuotaDecision } from "../../scale-ecosystem/resource-manager/quota-enforcer/index.js";
import { orderFairQueue, type FairQueueItem } from "../../scale-ecosystem/resource-manager/fair-queue/index.js";
import { FairSchedulingService, type ResourceClaim } from "../../scale-ecosystem/resource-manager/fair-scheduling-service.js";
import { ResourcePoolService, type ResourcePool } from "../../scale-ecosystem/resource-manager/resource-pool-service.js";
import { choosePreemptionVictim, type PreemptionCandidate, type PreemptionDecision } from "../../scale-ecosystem/resource-manager/preemption/index.js";

// R13-25: Tenant lifecycle state for tracking suspension, deactivation, and decommission
export type TenantLifecycleState = "active" | "suspended" | "deactivated" | "decommissioned";

/**
 * Validates an identifier string against the allowed pattern.
 * Throws if the value contains invalid characters or is too short/long.
 */
function assertIdentifier(value: string, code: string): string {
  if (!/^[a-zA-Z0-9._:-]{2,128}$/.test(value)) {
    throw new ValidationError(code, code, {
      category: "tenant",
      source: "runtime",
      details: { value },
    });
  }
  return value;
}

/**
 * Validates a non-empty string after trimming whitespace.
 * Throws if the trimmed value is empty.
 */
function assertNonEmpty(value: string, code: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new ValidationError(code, code, {
      category: "tenant",
      source: "runtime",
    });
  }
  return normalized;
}

/** Input for creating a new workspace */
export interface CreateWorkspaceInput {
  /** Optional workspace ID (auto-generated if not provided) */
  workspaceId?: string;
  /** Owner user ID */
  ownerId: string;
  /** Human-readable display name */
  displayName: string;
  /** Plan identifier for this workspace */
  planId: string;
  /** Default policy set identifier */
  defaultPolicySet?: string;
  /** Optional parent organization ID */
  organizationId?: string | null;
  /** Creation timestamp override */
  createdAt?: string;
}

/** Input for adding a user to a workspace */
export interface AddWorkspaceMembershipInput {
  /** Workspace to add membership to */
  workspaceId: string;
  /** Authenticated caller issuing the request */
  callerUserId: string;
  /** User ID to add */
  userId: string;
  /** Role identifier for this membership */
  role: string;
  /** Join timestamp override */
  joinedAt?: string;
}

/** Input for creating a new organization */
export interface CreateOrganizationInput {
  /** Optional organization ID (auto-generated if not provided) */
  organizationId?: string;
  /** Owner user ID used to bootstrap authoritative membership */
  ownerId: string;
  /** Human-readable display name */
  displayName: string;
  /** Optional billing account binding */
  billingAccountId?: string | null;
  /** Optional default tenant for this organization */
  defaultTenantId?: string | null;
  /** Creation timestamp override */
  createdAt?: string;
}

/** Input for adding a user to an organization */
export interface AddOrganizationMembershipInput {
  /** Organization to add membership to */
  organizationId: string;
  /** Authenticated caller issuing the request */
  callerUserId: string;
  /** User ID to add */
  userId: string;
  /** Role identifier for this membership */
  role: string;
  /** Join timestamp override */
  joinedAt?: string;
}

/** Input for creating a new tenant */
export interface CreateTenantInput {
  /** Optional tenant ID (auto-generated if not provided) */
  tenantId?: string;
  /** Parent organization ID */
  organizationId: string;
  /** Storage scope identifier */
  storageScope: string;
  /** Identity scope identifier */
  identityScope: string;
  /** Policy scope identifier */
  policyScope: string;
  /** Artifact scope identifier */
  artifactScope: string;
  /** Tenant isolation mode (defaults to shared_hard_scoped) */
  isolationMode?: TenantIsolationMode;
  /** Deployment mode (defaults to cloud_shared) */
  deploymentMode?: DeploymentMode;
  /** Creation timestamp override */
  createdAt?: string;
  /** Whether to set this tenant as the organization's default */
  setAsOrganizationDefault?: boolean;
}

/** Input for creating a deployment binding */
export interface CreateDeploymentBindingInput {
  /** Optional binding ID (auto-generated if not provided) */
  bindingId?: string;
  /** Tenant to bind */
  tenantId: string;
  /** Environment identifier */
  environmentId: string;
  /** Deployment mode for this binding */
  deploymentMode: DeploymentMode;
  /** Geographic region */
  region: string;
  /** Network boundary identifier */
  networkBoundary: string;
  /** Creation timestamp override */
  createdAt?: string;
}

/** Input for creating a data namespace */
export interface CreateDataNamespaceInput {
  /** Optional namespace ID (auto-generated if not provided) */
  namespaceId?: string;
  /** Data plane for this namespace */
  plane: DataNamespacePlane;
  /** Optional tenant scope */
  tenantId?: string | null;
  /** Optional organization scope */
  organizationId?: string | null;
  /** Optional workspace scope */
  workspaceId?: string | null;
  /** Data retention policy identifier */
  retentionPolicy: string;
  /** Encryption policy identifier */
  encryptionPolicy: string;
  /** Optional data residency policy */
  residencyPolicy?: string | null;
  /** Creation timestamp override */
  createdAt?: string;
}

/**
 * Per-tenant SLO definition per R21-10.
 * Defines availability and performance targets for each tenant.
 */
export interface TenantSloDefinition {
  /** Tenant this SLO applies to */
  tenantId: string;
  /** SLO tier determining priority in scheduling */
  sloTier: "platinum" | "gold" | "silver" | "bronze";
  /** Minimum availability target as percentage (e.g., 99.99) */
  availabilityTarget: number;
  /** Maximum p99 latency in milliseconds */
  maxLatencyMs: number;
  /** Maximum concurrent executions guaranteed */
  maxConcurrentExecutions: number;
  /** Maximum queue time in milliseconds before warning */
  maxQueueTimeMs: number;
}

/**
 * Tenant scheduling context for fair scheduling per R21-09.
 * Carries scheduling metadata used by weighted fair queuing.
 */
export interface TenantSchedulingContext {
  tenantId: string;
  orgNodeId?: string | null;
  domainId: string;
  sloTier: number;
  priority: number;
  weight: number;
  currentUsage: number;
  guaranteedQuota: number;
  borrowedQuota: number;
}

/**
 * Scheduling decision for tenant load placement per R21-08.
 */
export interface TenantSchedulingDecision {
  /** Whether the request was admitted */
  admitted: boolean;
  /** Preemption victim if load was evicted */
  victimExecutionId: string | null;
  /** Reason for admission or rejection */
  reason: string;
  /** Queue position if admitted */
  queuePosition: number | null;
}

/** Summary of the entire tenant topology with counts and entity lists */
export interface TenantTopologySummary {
  /** ISO timestamp when the summary was generated */
  generatedAt: string;
  /** Entity counts across the topology */
  counts: {
    workspaces: number;
    workspaceMemberships: number;
    organizations: number;
    organizationMemberships: number;
    tenants: number;
    deploymentBindings: number;
    dataNamespaces: number;
  };
  /** Workspaces with their memberships included */
  workspaces: Array<WorkspaceRecord & { memberships: WorkspaceMembershipRecord[] }>;
  /** Organizations with their memberships included */
  organizations: Array<OrganizationRecord & { memberships: OrganizationMembershipRecord[] }>;
  /** All tenant records */
  tenants: TenantRecord[];
  /** All deployment bindings */
  deploymentBindings: DeploymentBindingRecord[];
  /** All data namespaces */
  dataNamespaces: DataNamespaceRecord[];
}

/** Input for tenant scheduling request per R21-08 */
export interface TenantSchedulingInput {
  tenantId: string;
  requestedUnits: number;
  preemptionCandidates?: readonly PreemptionCandidate[];
  /** R15-57: Optional dedicated pool ID for isolated tenants */
  dedicatedPoolId?: string | null;
}

/**
 * Service for managing the tenant platform topology.
 *
 * Provides CRUD operations for organizations, workspaces, tenants,
 * deployment bindings, and data namespaces. Enforces organizational
 * boundaries and validates scope relationships when creating namespaces.
 */
export class TenantPlatformService {
  private readonly quotaEnforcer = new QuotaEnforcerService();
  private readonly fairScheduler = new FairSchedulingService();
  private readonly resourcePools = new ResourcePoolService();

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
  ) {}

  /**
   * Creates a new workspace and adds the owner as a member with "owner" role.
   *
   * @param input - Workspace creation parameters
   * @returns The created workspace record
   */
  public createWorkspace(input: CreateWorkspaceInput): WorkspaceRecord {
    return this.db.transaction(() => {
      const createdAt = input.createdAt ?? nowIso();
      const workspace: WorkspaceRecord = {
        workspaceId: assertIdentifier(input.workspaceId ?? newId("workspace"), "tenant.invalid_workspace_id"),
        ownerId: assertIdentifier(input.ownerId, "tenant.invalid_owner_id"),
        displayName: assertNonEmpty(input.displayName, "tenant.invalid_workspace_display_name"),
        planId: assertIdentifier(input.planId, "tenant.invalid_plan_id"),
        defaultPolicySet: assertIdentifier(
          input.defaultPolicySet?.trim() || "workspace_default",
          "tenant.invalid_policy_set",
        ),
        organizationId: input.organizationId ? this.requireOrganization(input.organizationId).organizationId : null,
        createdAt,
        updatedAt: createdAt,
      };
      this.store.organization.upsertWorkspaceRecord(workspace);

      // Automatically add the owner as a workspace member with "owner" role
      this.store.organization.upsertWorkspaceMembershipRecord({
        workspaceId: workspace.workspaceId,
        userId: workspace.ownerId,
        role: "owner",
        joinedAt: createdAt,
      });
      return workspace;
    });
  }

  /**
   * Adds a user membership to a workspace.
   * Caller must be a workspace member with appropriate role to add new members.
   *
   * @param input - Membership creation parameters
   * @returns The created workspace membership record
   */
  public addWorkspaceMembership(input: AddWorkspaceMembershipInput): WorkspaceMembershipRecord {
    return this.db.transaction(() => {
      const workspace = this.requireWorkspace(input.workspaceId);
      const callerUserId = assertIdentifier(input.callerUserId, "tenant.invalid_caller_user_id");
      const callerMembership = this.store.organization
        .listWorkspaceMemberships(workspace.workspaceId)
        .find((membership) => membership.userId === callerUserId);
      if (!callerMembership || !["owner", "admin"].includes(callerMembership.role)) {
        throw new ValidationError("tenant.add_membership_not_authorized", "Caller must be workspace owner or admin to add members", {
          category: "tenant",
          source: "runtime",
          details: { workspaceId: workspace.workspaceId, callerUserId },
        });
      }
      const membership: WorkspaceMembershipRecord = {
        workspaceId: assertIdentifier(input.workspaceId, "tenant.invalid_workspace_id"),
        userId: assertIdentifier(input.userId, "tenant.invalid_user_id"),
        role: assertIdentifier(input.role, "tenant.invalid_workspace_role"),
        joinedAt: input.joinedAt ?? nowIso(),
      };
      this.store.organization.upsertWorkspaceMembershipRecord(membership);
      return membership;
    });
  }

  /**
   * Creates a new organization.
   *
   * Optionally links a billing account and sets a default tenant.
   * Validates that the billing account exists and that any provided
   * default tenant belongs to this organization.
   *
   * @param input - Organization creation parameters
   * @returns The created organization record
   */
  public createOrganization(input: CreateOrganizationInput): OrganizationRecord {
    return this.db.transaction(() => {
      const createdAt = input.createdAt ?? nowIso();
      const organizationId = assertIdentifier(input.organizationId ?? newId("org"), "tenant.invalid_organization_id");
      const ownerId = assertIdentifier(input.ownerId, "tenant.invalid_owner_id");

      // Validate billing account exists if provided
      if (input.billingAccountId) {
        const account = this.store.billing.getBillingAccount(input.billingAccountId);
        if (account == null) {
          throw new MonetizationError(
            `tenant.billing_account_not_found:${input.billingAccountId}`,
            `tenant.billing_account_not_found:${input.billingAccountId}`,
            {
              details: { billingAccountId: input.billingAccountId },
            },
          );
        }
      }

      // Validate default tenant belongs to this organization
      // Root cause: Condition always false due to nullish coalescing - input.organizationId ?? tenant.organizationId
      // When input.organizationId is undefined, it falls back to tenant.organizationId, making comparison always equal
      // Fix: Use the actual organizationId being created (either provided or auto-generated)
      if (input.defaultTenantId) {
        const tenant = this.requireTenant(input.defaultTenantId);
        if (tenant.organizationId !== organizationId) {
          throw new TenantBoundaryError("tenant.default_tenant_mismatch", "tenant.default_tenant_mismatch", {
            details: {
              defaultTenantId: input.defaultTenantId,
              organizationId,
              tenantOrganizationId: tenant.organizationId,
            },
          });
        }
      }

      const organization: OrganizationRecord = {
        organizationId,
        displayName: assertNonEmpty(input.displayName, "tenant.invalid_organization_display_name"),
        billingAccountId: input.billingAccountId ? assertIdentifier(input.billingAccountId, "tenant.invalid_billing_account_id") : null,
        defaultTenantId: input.defaultTenantId ? assertIdentifier(input.defaultTenantId, "tenant.invalid_default_tenant_id") : null,
        createdAt,
        updatedAt: createdAt,
      };
      this.store.organization.upsertOrganizationRecord(organization);
      this.store.organization.upsertOrganizationMembershipRecord({
        organizationId,
        userId: ownerId,
        role: "owner",
        joinedAt: createdAt,
      });
      return organization;
    });
  }

  /**
   * Adds a user membership to an organization.
   * Caller must be an organization member with appropriate role to add new members.
   *
   * @param input - Membership creation parameters
   * @returns The created organization membership record
   */
  public addOrganizationMembership(input: AddOrganizationMembershipInput): OrganizationMembershipRecord {
    return this.db.transaction(() => {
      const organization = this.requireOrganization(input.organizationId);
      const callerUserId = assertIdentifier(input.callerUserId, "tenant.invalid_caller_user_id");
      const callerMembership = this.store.organization
        .listOrganizationMemberships(organization.organizationId)
        .find((membership) => membership.userId === callerUserId);
      if (!callerMembership || !["owner", "admin"].includes(callerMembership.role)) {
        throw new ValidationError("tenant.add_membership_not_authorized", "Caller must be organization owner or admin to add members", {
          category: "tenant",
          source: "runtime",
          details: { organizationId: organization.organizationId, callerUserId },
        });
      }
      const targetRole = assertIdentifier(input.role, "tenant.invalid_organization_role");
      if (targetRole === "owner" && callerMembership.role !== "owner") {
        throw new ValidationError("tenant.owner_role_requires_owner_caller", "Only an organization owner can assign the owner role", {
          category: "tenant",
          source: "runtime",
          details: { organizationId: organization.organizationId, callerUserId },
        });
      }
      const membership: OrganizationMembershipRecord = {
        organizationId: assertIdentifier(input.organizationId, "tenant.invalid_organization_id"),
        userId: assertIdentifier(input.userId, "tenant.invalid_user_id"),
        role: targetRole,
        joinedAt: input.joinedAt ?? nowIso(),
      };
      this.store.organization.upsertOrganizationMembershipRecord(membership);
      return membership;
    });
  }

  /**
   * Creates a new tenant within an organization.
   *
   * A tenant represents an isolated execution context with its own scopes
   * for storage, identity, policy, and artifacts. If setAsOrganizationDefault
   * is true or the organization has no default tenant yet, this tenant
   * becomes the organization's default.
   *
   * Per R15-57 and §9.8: dedicated_pool isolation mode creates real infrastructure isolation
   * by provisioning a dedicated deployment binding with isolated resources.
   *
   * @param input - Tenant creation parameters
   * @returns The created tenant record
   */
  public createTenant(input: CreateTenantInput): TenantRecord {
    return this.db.transaction(() => {
      const organization = this.requireOrganization(input.organizationId);
      const createdAt = input.createdAt ?? nowIso();
      const tenantId = assertIdentifier(input.tenantId ?? newId("tenant"), "tenant.invalid_tenant_id");
      const isolationMode = input.isolationMode ?? "shared_hard_scoped";

      // Per R15-57: dedicated_pool tenants need real isolation via dedicated deployment
      // When isolationMode is dedicated_pool, override deploymentMode to private_cloud
      // unless already explicitly set to a non-shared mode
      let deploymentMode = input.deploymentMode;
      if (isolationMode === "dedicated_pool") {
        if (!deploymentMode || deploymentMode === "cloud_shared") {
          deploymentMode = "private_cloud";
        }
        // Create a dedicated storage scope for true isolation
        const tenant: TenantRecord = {
          tenantId,
          organizationId: organization.organizationId,
          displayName: tenantId,
          storageScope: assertIdentifier(`${input.storageScope}-dedicated`, "tenant.invalid_storage_scope"),
          identityScope: assertIdentifier(`${input.identityScope}-dedicated`, "tenant.invalid_identity_scope"),
          policyScope: assertIdentifier(input.policyScope, "tenant.invalid_policy_scope"),
          artifactScope: assertIdentifier(`${input.artifactScope}-dedicated`, "tenant.invalid_artifact_scope"),
          isolationMode,
          deploymentMode,
          createdAt,
          updatedAt: createdAt,
        };
        this.store.organization.upsertTenantRecord(tenant);

        // Create a dedicated data namespace for this tenant's isolated data
        this.store.organization.upsertDataNamespaceRecord({
          namespaceId: assertIdentifier(`${tenantId}-dedicated-ns`, "tenant.invalid_namespace_id"),
          plane: "transactional",
          tenantId: tenant.tenantId,
          organizationId: organization.organizationId,
          workspaceId: null,
          retentionPolicy: "dedicated_retention",
          encryptionPolicy: "dedicated_encryption",
          residencyPolicy: null,
          createdAt,
          updatedAt: createdAt,
        });

        // R15-57 FIX: Create a dedicated resource pool for this isolated tenant
        // The pool is tagged with tenantId for FairSchedulingService to route tasks
        this.resourcePools.createDedicatedPool(tenantId, 100); // Default 100 capacity units

        // Set as organization default if requested or if no default exists
        if (input.setAsOrganizationDefault === true || organization.defaultTenantId == null) {
          this.store.organization.upsertOrganizationRecord({
            ...organization,
            defaultTenantId: tenant.tenantId,
            updatedAt: createdAt,
          });
        }
        return tenant;
      }

      // Standard shared tenant creation
      const tenant: TenantRecord = {
        tenantId,
        organizationId: organization.organizationId,
        displayName: tenantId,
        storageScope: assertIdentifier(input.storageScope, "tenant.invalid_storage_scope"),
        identityScope: assertIdentifier(input.identityScope, "tenant.invalid_identity_scope"),
        policyScope: assertIdentifier(input.policyScope, "tenant.invalid_policy_scope"),
        artifactScope: assertIdentifier(input.artifactScope, "tenant.invalid_artifact_scope"),
        isolationMode,
        deploymentMode: deploymentMode ?? "cloud_shared",
        createdAt,
        updatedAt: createdAt,
      };
      this.store.organization.upsertTenantRecord(tenant);

      // Set as organization default if requested or if no default exists
      if (input.setAsOrganizationDefault === true || organization.defaultTenantId == null) {
        this.store.organization.upsertOrganizationRecord({
          ...organization,
          defaultTenantId: tenant.tenantId,
          updatedAt: createdAt,
        });
      }
      return tenant;
    });
  }

  /**
   * Creates a deployment binding for a tenant.
   *
   * A deployment binding represents a specific runtime deployment of a tenant
   * in a particular environment, region, and network boundary.
   *
   * @param input - Deployment binding creation parameters
   * @returns The created deployment binding record
   */
  public createDeploymentBinding(input: CreateDeploymentBindingInput): DeploymentBindingRecord {
    return this.db.transaction(() => {
      const tenant = this.requireTenant(input.tenantId);
      const createdAt = input.createdAt ?? nowIso();
      const binding: DeploymentBindingRecord = {
        bindingId: assertIdentifier(input.bindingId ?? newId("binding"), "tenant.invalid_binding_id"),
        tenantId: tenant.tenantId,
        environmentId: assertIdentifier(input.environmentId, "tenant.invalid_environment_id"),
        deploymentMode: input.deploymentMode,
        region: assertIdentifier(input.region, "tenant.invalid_region"),
        networkBoundary: assertIdentifier(input.networkBoundary, "tenant.invalid_network_boundary"),
        createdAt,
        updatedAt: createdAt,
      };
      this.store.organization.upsertDeploymentBindingRecord(binding);
      return binding;
    });
  }

  /**
   * Creates a data namespace within the data plane.
   *
   * A data namespace provides logical isolation for data within a specific
   * plane (transactional, analytics, artifact, memory_archive, replay).
   * The namespace must be scoped to at least one of: tenant, organization,
   * or workspace. Cross-tenant and cross-organization movement is prohibited.
   *
   * @param input - Data namespace creation parameters
   * @returns The created data namespace record
   * @throws TenantBoundaryError if scope relationships are violated
   * @throws ValidationError if no scope entity is provided
   */
  public createDataNamespace(input: CreateDataNamespaceInput): DataNamespaceRecord {
    return this.db.transaction(() => {
      // Resolve scope entities from provided IDs
      const workspace = input.workspaceId ? this.requireWorkspace(input.workspaceId) : null;
      const tenant = input.tenantId ? this.requireTenant(input.tenantId) : null;
      const organization =
        input.organizationId != null
          ? this.requireOrganization(input.organizationId)
          : workspace?.organizationId
            ? this.requireOrganization(workspace.organizationId)
            : tenant != null
              ? this.requireOrganization(tenant.organizationId)
              : null;

      // §R8-34: Enforce Chinese Wall - prevent cross-tenant data movement
      // If both source and target tenant IDs are provided, they must match
      // This is called before allowing cross-tenant scope resolution
      if (tenant !== null) {
        this.assertNoCrossTenantDataMovement(tenant.tenantId, null);
      }

      // Validate workspace-tenant-organization consistency
      if (workspace != null && tenant != null && workspace.organizationId != null && workspace.organizationId !== tenant.organizationId) {
        throw new TenantBoundaryError("tenant.workspace_tenant_organization_mismatch", "tenant.workspace_tenant_organization_mismatch", {
          details: {
            workspaceId: workspace.workspaceId,
            workspaceOrganizationId: workspace.organizationId,
            tenantId: tenant.tenantId,
            tenantOrganizationId: tenant.organizationId,
          },
        });
      }

      // Validate namespace-organization consistency
      if (tenant != null && organization != null && tenant.organizationId !== organization.organizationId) {
        throw new TenantBoundaryError("tenant.namespace_organization_mismatch", "tenant.namespace_organization_mismatch", {
          details: {
            tenantId: tenant.tenantId,
            tenantOrganizationId: tenant.organizationId,
            organizationId: organization.organizationId,
          },
        });
      }

      // Require at least one scope entity
      if (workspace == null && tenant == null && organization == null) {
        throw new ValidationError("tenant.namespace_scope_required", "tenant.namespace_scope_required", {
          category: "tenant",
          source: "runtime",
        });
      }

      const createdAt = input.createdAt ?? nowIso();
      const namespace: DataNamespaceRecord = {
        namespaceId: assertIdentifier(input.namespaceId ?? newId("namespace"), "tenant.invalid_namespace_id"),
        plane: input.plane,
        tenantId: tenant?.tenantId ?? null,
        organizationId: organization?.organizationId ?? null,
        workspaceId: workspace?.workspaceId ?? null,
        retentionPolicy: assertIdentifier(input.retentionPolicy, "tenant.invalid_retention_policy"),
        encryptionPolicy: assertIdentifier(input.encryptionPolicy, "tenant.invalid_encryption_policy"),
        residencyPolicy: input.residencyPolicy ? assertIdentifier(input.residencyPolicy, "tenant.invalid_residency_policy") : null,
        createdAt,
        updatedAt: createdAt,
      };
      this.store.organization.upsertDataNamespaceRecord(namespace);
      return namespace;
    });
  }

  /**
   * Builds a complete summary of the tenant topology.
   *
   * Collects all organizations, workspaces, tenants, deployment bindings,
   * and data namespaces with their associated memberships.
   *
   * @returns Complete topology summary with counts and entity lists
   */
  public buildTopologySummary(): TenantTopologySummary {
    const generatedAt = nowIso();
    const workspaces = this.store.organization
      .listWorkspaceRecords({ limit: 500 })
      .map((workspace) => ({
        ...workspace,
        memberships: this.store.organization.listWorkspaceMemberships(workspace.workspaceId),
      }));
    const organizations = this.store.organization
      .listOrganizationRecords(500)
      .map((organization) => ({
        ...organization,
        memberships: this.store.organization.listOrganizationMemberships(organization.organizationId),
      }));
    const tenants = this.store.organization.listTenantRecords({ limit: 500 });
    const deploymentBindings = this.store.organization.listDeploymentBindings({ limit: 500 });
    const dataNamespaces = this.store.organization.listDataNamespaces({ limit: 500 });

    return {
      generatedAt,
      counts: {
        workspaces: workspaces.length,
        workspaceMemberships: workspaces.reduce((sum, workspace) => sum + workspace.memberships.length, 0),
        organizations: organizations.length,
        organizationMemberships: organizations.reduce((sum, organization) => sum + organization.memberships.length, 0),
        tenants: tenants.length,
        deploymentBindings: deploymentBindings.length,
        dataNamespaces: dataNamespaces.length,
      },
      workspaces,
      organizations,
      tenants,
      deploymentBindings,
      dataNamespaces,
    };
  }

  /** Validates and returns a workspace record, throwing if not found */
  private requireWorkspace(workspaceId: string): WorkspaceRecord {
    const workspace = this.store.organization.getWorkspaceRecord(assertIdentifier(workspaceId, "tenant.invalid_workspace_id"));
    if (workspace == null) {
      throw new ValidationError(`tenant.workspace_not_found:${workspaceId}`, `tenant.workspace_not_found:${workspaceId}`, {
        category: "tenant",
        source: "runtime",
        details: { workspaceId },
      });
    }
    return workspace;
  }

  /** Validates and returns an organization record, throwing if not found */
  private requireOrganization(organizationId: string): OrganizationRecord {
    const organization = this.store.organization.getOrganizationRecord(
      assertIdentifier(organizationId, "tenant.invalid_organization_id"),
    );
    if (organization == null) {
      throw new ValidationError(`tenant.organization_not_found:${organizationId}`, `tenant.organization_not_found:${organizationId}`, {
        category: "tenant",
        source: "runtime",
        details: { organizationId },
      });
    }
    return organization;
  }

  /** Validates and returns a tenant record, throwing if not found */
  private requireTenant(tenantId: string): TenantRecord {
    const tenant = this.store.organization.getTenantRecord(assertIdentifier(tenantId, "tenant.invalid_tenant_id"));
    if (tenant == null) {
      throw new ValidationError(`tenant.not_found:${tenantId}`, `tenant.not_found:${tenantId}`, {
        category: "tenant",
        source: "runtime",
        details: { tenantId },
      });
    }
    return tenant;
  }

  /**
   * §R8-34: Assert no cross-tenant data movement.
   * Throws TenantBoundaryError if sourceTenantId != targetTenantId.
   * This enforces the Chinese Wall between tenants.
   *
   * @param sourceTenantId - Source tenant ID
   * @param targetTenantId - Target tenant ID (null means no specific target)
   * @throws TenantBoundaryError if cross-tenant movement is detected
   */
  public assertNoCrossTenantDataMovement(sourceTenantId: string, targetTenantId: string | null): void {
    if (targetTenantId !== null && sourceTenantId !== targetTenantId) {
      throw new TenantBoundaryError(
        "tenant.cross_tenant_data_movement",
        "tenant.cross_tenant_data_movement: Cross-tenant data movement is not allowed.",
        {
          details: {
            sourceTenantId,
            targetTenantId,
          },
        },
      );
    }
  }

  /**
   * Enforces quota for a given scope and scopeId per R21-08.
   * Checks if the requested units would exceed the registered quota policy
   * and returns the multi-dimensional quota decision.
   *
   * @param scope - Scope type (e.g., "tenant", "workspace", "organization")
   * @param scopeId - Identifier within that scope
   * @param requested - Multi-resource quota vector being requested
   * @returns Multi-dimensional quota decision indicating pass/fail and warning dimensions
   */
  public enforceQuota(scope: string, scopeId: string | null, requested: MultiResourceQuotaVector): MultiDimensionalQuotaDecision {
    return this.quotaEnforcer.checkQuota(scope, scopeId, requested);
  }

  /**
   * Selects a preemption victim from a list of candidates per §53.4.
   * Only candidates with completed checkpoints are eligible.
   * Returns the lowest priority candidate that has a checkpoint.
   *
   * @param candidates - List of preemption candidates to evaluate
   * @returns PreemptionDecision with victim and reason
   */
  public selectPreemptionVictim(candidates: readonly PreemptionCandidate[]): PreemptionDecision {
    return choosePreemptionVictim(candidates);
  }

  /**
   * Schedules a tenant request using fair scheduling per R21-08.
   * Evaluates quota, checks for starvation, and optionally preempts a victim
   * if quota would be exceeded.
   *
   * @param input - Tenant scheduling input with tenantId, requestedUnits, and optional candidates
   * @returns TenantSchedulingDecision indicating admission and queue position
   */
  public scheduleTenant(input: TenantSchedulingInput): TenantSchedulingDecision {
    // R13-32 FIX: Properly enforce tenant-scoped quota by using multi-resource quota check
    const requested: MultiResourceQuotaVector = {
      worker_concurrency: input.requestedUnits,
      tool_qps: 0,
      model_tpm: 0,
      model_rpm: 0,
      budget_amount: 0,
      approval_capacity: 0,
      storage_io: 0,
      promotion_budget: 0,
    };

    // Check tenant-scoped quota using the quota enforcer
    const quotaDecision = this.enforceQuota("tenant", input.tenantId, requested);

    // If quota check fails, reject immediately without scheduling
    if (!quotaDecision.passed) {
      return {
        admitted: false,
        victimExecutionId: null,
        reason: `Quota exceeded: ${quotaDecision.failedDimensions.join(", ")}`,
        queuePosition: null,
      };
    }

    // Build the claim for fair scheduling - use actual quota limits
    const claim: ResourceClaim = {
      claimId: newId("claim"),
      schedulingClass: {
        tenantId: input.tenantId,
        domainId: "default",
        slaTierId: "default",
        priority: 1,
      },
      requestedUnits: input.requestedUnits,
    };

    // Use fair scheduler for queue management and preemption
    // R15-57: Check if this tenant has a dedicated pool for isolated routing
    const dedicatedPool = this.resourcePools.getDedicatedPool(input.tenantId);
    const isIsolatedTenant = dedicatedPool != null;
    const dedicatedPoolId: string | null = dedicatedPool?.poolId ?? input.dedicatedPoolId ?? null;
    const fairDecision = this.fairScheduler.schedule({
      quotaPolicy: {
        scope: "tenant",
        scopeId: input.tenantId,
        resourceType: "runtime_units",
        hardLimit: 0, // Quota already checked above via multi-dimensional enforcement
        currentUsage: 0,
      },
      claim,
      queueItems: [],
      preemptionCandidates: input.preemptionCandidates ?? [],
      isIsolatedTenant,
      dedicatedPoolId,
    });

    return {
      admitted: !fairDecision.queue.quotaExceeded,
      victimExecutionId: fairDecision.preemption.victimExecutionId,
      reason: fairDecision.preemption.reason ?? "admitted",
      queuePosition: fairDecision.queue.orderedItemIds.length > 0 ? fairDecision.queue.orderedItemIds.length : null,
    };
  }

  // ============================================================================
  // Tenant Lifecycle Management (R13-25 FIX)
  // ============================================================================

  // Internal state to track tenant lifecycle (since isolationMode doesn't support lifecycle states)
  private readonly tenantLifecycleState = new Map<string, TenantLifecycleState>();

  /**
   * Suspends a tenant - pauses all active executions and prevents new ones.
   * R13-25 FIX: Tenant lifecycle management - suspend operation.
   *
   * @param tenantId - Tenant to suspend
   * @param reason - Reason for suspension
   * @param suspendedBy - Actor performing the suspension
   */
  public suspendTenant(tenantId: string, reason: string, suspendedBy: string): void {
    // Validate tenant exists
    this.requireTenant(tenantId);

    // Update internal lifecycle state
    this.tenantLifecycleState.set(tenantId, "suspended");

    // Emit suspension event for execution layer to pick up
    this.emitTenantLifecycleEvent(tenantId, "suspended", reason, suspendedBy);
  }

  /**
   * Deactivates a tenant - disables all capabilities but retains data.
   * R13-25 FIX: Tenant lifecycle management - deactivate operation.
   *
   * @param tenantId - Tenant to deactivate
   * @param reason - Reason for deactivation
   * @param deactivatedBy - Actor performing the deactivation
   */
  public deactivateTenant(tenantId: string, reason: string, deactivatedBy: string): void {
    // Validate tenant exists
    this.requireTenant(tenantId);

    // Update internal lifecycle state
    this.tenantLifecycleState.set(tenantId, "deactivated");

    // Clear tenant-scoped quota policies
    this.clearTenantQuotaPolicies(tenantId);

    // Emit deactivation event
    this.emitTenantLifecycleEvent(tenantId, "deactivated", reason, deactivatedBy);
  }

  /**
   * Decommissioned a tenant - marks for cleanup by downstream systems.
   * R13-25 FIX: Tenant lifecycle management - decommission operation.
   * Note: Actual record deletion is handled by downstream systems via emitted events.
   *
   * @param tenantId - Tenant to decommission
   * @param reason - Reason for decommission
   * @param decommissionedBy - Actor performing the decommission
   */
  public decommissionTenant(tenantId: string, reason: string, decommissionedBy: string): void {
    // Validate tenant exists
    this.requireTenant(tenantId);

    // Update internal lifecycle state
    this.tenantLifecycleState.set(tenantId, "decommissioned");

    // Emit decommission event for downstream cleanup systems
    this.emitTenantLifecycleEvent(tenantId, "decommissioned", reason, decommissionedBy);
  }

  /**
   * Gets the lifecycle state of a tenant.
   * R13-25 FIX: Tenant lifecycle state query.
   */
  public getTenantLifecycleState(tenantId: string): TenantLifecycleState {
    // Check internal state first
    const internalState = this.tenantLifecycleState.get(tenantId);
    if (internalState) {
      return internalState;
    }

    // Fall back to checking tenant existence
    const tenant = this.store.organization.getTenantRecord(tenantId);
    if (!tenant) {
      return "decommissioned";
    }
    return "active";
  }

  /**
   * Reactivates a previously suspended or deactivated tenant.
   * R13-25 FIX: Tenant lifecycle management - reactivate operation.
   */
  public reactivateTenant(tenantId: string, reactivatedBy: string): void {
    // Validate tenant exists
    this.requireTenant(tenantId);

    // Update internal lifecycle state
    this.tenantLifecycleState.set(tenantId, "active");

    // Emit reactivation event
    this.emitTenantLifecycleEvent(tenantId, "active", "Tenant reactivated", reactivatedBy);
  }

  /**
   * Emits a tenant lifecycle event for downstream systems.
   */
  private emitTenantLifecycleEvent(tenantId: string, state: TenantLifecycleState, reason: string, actor: string): void {
    // In production, this would emit to an event bus
    // For now, we just track it
    const event = {
      type: `tenant.${state}`,
      tenantId,
      reason,
      actor,
      timestamp: nowIso(),
    };
    // Event emission would go to event bus here
  }

  /**
   * Clears all quota policies for a tenant.
   */
  private clearTenantQuotaPolicies(tenantId: string): void {
    // In a real implementation, this would clear quota policies from the quota enforcer
    // For now, this is a placeholder that would interact with the quota enforcer service
  }
}
