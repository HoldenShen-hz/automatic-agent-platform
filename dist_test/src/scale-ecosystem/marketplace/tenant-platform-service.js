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
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
/**
 * Validates an identifier string against the allowed pattern.
 * Throws if the value contains invalid characters or is too short/long.
 */
function assertIdentifier(value, code) {
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
function assertNonEmpty(value, code) {
    const normalized = value.trim();
    if (normalized.length === 0) {
        throw new ValidationError(code, code, {
            category: "tenant",
            source: "runtime",
        });
    }
    return normalized;
}
/**
 * Service for managing the tenant platform topology.
 *
 * Provides CRUD operations for organizations, workspaces, tenants,
 * deployment bindings, and data namespaces. Enforces organizational
 * boundaries and validates scope relationships when creating namespaces.
 */
export class TenantPlatformService {
    db;
    store;
    constructor(db, store) {
        this.db = db;
        this.store = store;
    }
    /**
     * Creates a new workspace and adds the owner as a member with "owner" role.
     *
     * @param input - Workspace creation parameters
     * @returns The created workspace record
     */
    createWorkspace(input) {
        return this.db.transaction(() => {
            const createdAt = input.createdAt ?? nowIso();
            const workspace = {
                workspaceId: assertIdentifier(input.workspaceId ?? newId("workspace"), "tenant.invalid_workspace_id"),
                ownerId: assertIdentifier(input.ownerId, "tenant.invalid_owner_id"),
                displayName: assertNonEmpty(input.displayName, "tenant.invalid_workspace_display_name"),
                planId: assertIdentifier(input.planId, "tenant.invalid_plan_id"),
                defaultPolicySet: assertIdentifier(input.defaultPolicySet?.trim() || "workspace_default", "tenant.invalid_policy_set"),
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
     *
     * @param input - Membership creation parameters
     * @returns The created workspace membership record
     */
    addWorkspaceMembership(input) {
        return this.db.transaction(() => {
            this.requireWorkspace(input.workspaceId);
            const membership = {
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
    createOrganization(input) {
        return this.db.transaction(() => {
            const createdAt = input.createdAt ?? nowIso();
            // Validate billing account exists if provided
            if (input.billingAccountId) {
                const account = this.store.billing.getBillingAccount(input.billingAccountId);
                if (account == null) {
                    throw new MonetizationError(`tenant.billing_account_not_found:${input.billingAccountId}`, `tenant.billing_account_not_found:${input.billingAccountId}`, {
                        details: { billingAccountId: input.billingAccountId },
                    });
                }
            }
            // Validate default tenant belongs to this organization
            if (input.defaultTenantId) {
                const tenant = this.requireTenant(input.defaultTenantId);
                if (tenant.organizationId !== (input.organizationId ?? tenant.organizationId)) {
                    throw new TenantBoundaryError("tenant.default_tenant_mismatch", "tenant.default_tenant_mismatch", {
                        details: {
                            defaultTenantId: input.defaultTenantId,
                            organizationId: input.organizationId ?? null,
                            tenantOrganizationId: tenant.organizationId,
                        },
                    });
                }
            }
            const organization = {
                organizationId: assertIdentifier(input.organizationId ?? newId("org"), "tenant.invalid_organization_id"),
                displayName: assertNonEmpty(input.displayName, "tenant.invalid_organization_display_name"),
                billingAccountId: input.billingAccountId ? assertIdentifier(input.billingAccountId, "tenant.invalid_billing_account_id") : null,
                defaultTenantId: input.defaultTenantId ? assertIdentifier(input.defaultTenantId, "tenant.invalid_default_tenant_id") : null,
                createdAt,
                updatedAt: createdAt,
            };
            this.store.organization.upsertOrganizationRecord(organization);
            return organization;
        });
    }
    /**
     * Adds a user membership to an organization.
     *
     * @param input - Membership creation parameters
     * @returns The created organization membership record
     */
    addOrganizationMembership(input) {
        return this.db.transaction(() => {
            this.requireOrganization(input.organizationId);
            const membership = {
                organizationId: assertIdentifier(input.organizationId, "tenant.invalid_organization_id"),
                userId: assertIdentifier(input.userId, "tenant.invalid_user_id"),
                role: assertIdentifier(input.role, "tenant.invalid_organization_role"),
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
     * @param input - Tenant creation parameters
     * @returns The created tenant record
     */
    createTenant(input) {
        return this.db.transaction(() => {
            const organization = this.requireOrganization(input.organizationId);
            const createdAt = input.createdAt ?? nowIso();
            const tenant = {
                tenantId: assertIdentifier(input.tenantId ?? newId("tenant"), "tenant.invalid_tenant_id"),
                organizationId: organization.organizationId,
                storageScope: assertIdentifier(input.storageScope, "tenant.invalid_storage_scope"),
                identityScope: assertIdentifier(input.identityScope, "tenant.invalid_identity_scope"),
                policyScope: assertIdentifier(input.policyScope, "tenant.invalid_policy_scope"),
                artifactScope: assertIdentifier(input.artifactScope, "tenant.invalid_artifact_scope"),
                isolationMode: input.isolationMode ?? "shared_hard_scoped",
                deploymentMode: input.deploymentMode ?? "cloud_shared",
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
    createDeploymentBinding(input) {
        return this.db.transaction(() => {
            const tenant = this.requireTenant(input.tenantId);
            const createdAt = input.createdAt ?? nowIso();
            const binding = {
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
    createDataNamespace(input) {
        return this.db.transaction(() => {
            // Resolve scope entities from provided IDs
            const workspace = input.workspaceId ? this.requireWorkspace(input.workspaceId) : null;
            const tenant = input.tenantId ? this.requireTenant(input.tenantId) : null;
            const organization = input.organizationId != null
                ? this.requireOrganization(input.organizationId)
                : workspace?.organizationId
                    ? this.requireOrganization(workspace.organizationId)
                    : tenant != null
                        ? this.requireOrganization(tenant.organizationId)
                        : null;
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
            const namespace = {
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
    buildTopologySummary() {
        const generatedAt = nowIso();
        const workspaces = this.store
            .listWorkspaceRecords({ limit: 500 })
            .map((workspace) => ({
            ...workspace,
            memberships: this.store.organization.listWorkspaceMemberships(workspace.workspaceId),
        }));
        const organizations = this.store
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
    requireWorkspace(workspaceId) {
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
    requireOrganization(organizationId) {
        const organization = this.store.organization.getOrganizationRecord(assertIdentifier(organizationId, "tenant.invalid_organization_id"));
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
    requireTenant(tenantId) {
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
}
//# sourceMappingURL=tenant-platform-service.js.map