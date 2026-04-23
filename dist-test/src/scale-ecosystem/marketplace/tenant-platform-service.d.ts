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
import { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { DataNamespacePlane, DataNamespaceRecord, DeploymentBindingRecord, DeploymentMode, OrganizationMembershipRecord, OrganizationRecord, TenantIsolationMode, TenantRecord, WorkspaceMembershipRecord, WorkspaceRecord } from "../../platform/contracts/types/domain.js";
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
    workspaces: Array<WorkspaceRecord & {
        memberships: WorkspaceMembershipRecord[];
    }>;
    /** Organizations with their memberships included */
    organizations: Array<OrganizationRecord & {
        memberships: OrganizationMembershipRecord[];
    }>;
    /** All tenant records */
    tenants: TenantRecord[];
    /** All deployment bindings */
    deploymentBindings: DeploymentBindingRecord[];
    /** All data namespaces */
    dataNamespaces: DataNamespaceRecord[];
}
/**
 * Service for managing the tenant platform topology.
 *
 * Provides CRUD operations for organizations, workspaces, tenants,
 * deployment bindings, and data namespaces. Enforces organizational
 * boundaries and validates scope relationships when creating namespaces.
 */
export declare class TenantPlatformService {
    private readonly db;
    private readonly store;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore);
    /**
     * Creates a new workspace and adds the owner as a member with "owner" role.
     *
     * @param input - Workspace creation parameters
     * @returns The created workspace record
     */
    createWorkspace(input: CreateWorkspaceInput): WorkspaceRecord;
    /**
     * Adds a user membership to a workspace.
     *
     * @param input - Membership creation parameters
     * @returns The created workspace membership record
     */
    addWorkspaceMembership(input: AddWorkspaceMembershipInput): WorkspaceMembershipRecord;
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
    createOrganization(input: CreateOrganizationInput): OrganizationRecord;
    /**
     * Adds a user membership to an organization.
     *
     * @param input - Membership creation parameters
     * @returns The created organization membership record
     */
    addOrganizationMembership(input: AddOrganizationMembershipInput): OrganizationMembershipRecord;
    /**
     * Creates a new tenant within an organization.
     *
     * A tenant represents an isolated execution context with its own scopes
     * for storage, identity, policy, and artifacts. If setAsOrganizationDefault
     * is true or the organization has no default tenant yet, this tenant
     * becomes the organization's default.
     *
     * @param input - Tenant creation parameters
     * @returns The created tenant record
     */
    createTenant(input: CreateTenantInput): TenantRecord;
    /**
     * Creates a deployment binding for a tenant.
     *
     * A deployment binding represents a specific runtime deployment of a tenant
     * in a particular environment, region, and network boundary.
     *
     * @param input - Deployment binding creation parameters
     * @returns The created deployment binding record
     */
    createDeploymentBinding(input: CreateDeploymentBindingInput): DeploymentBindingRecord;
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
    createDataNamespace(input: CreateDataNamespaceInput): DataNamespaceRecord;
    /**
     * Builds a complete summary of the tenant topology.
     *
     * Collects all organizations, workspaces, tenants, deployment bindings,
     * and data namespaces with their associated memberships.
     *
     * @returns Complete topology summary with counts and entity lists
     */
    buildTopologySummary(): TenantTopologySummary;
    /** Validates and returns a workspace record, throwing if not found */
    private requireWorkspace;
    /** Validates and returns an organization record, throwing if not found */
    private requireOrganization;
    /** Validates and returns a tenant record, throwing if not found */
    private requireTenant;
}
