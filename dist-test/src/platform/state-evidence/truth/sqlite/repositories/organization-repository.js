import { execute, queryAll, queryOne } from "../query-helper.js";
/**
 * Standalone repository boundary for workspace / organization / tenant /
 * namespace / deployment-binding records.
 */
export class OrganizationRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    upsertWorkspaceRecord(record) {
        execute(this.db.connection, `INSERT INTO workspaces (
        workspace_id, owner_id, display_name, plan_id, default_policy_set, organization_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(workspace_id) DO UPDATE SET
        owner_id = excluded.owner_id,
        display_name = excluded.display_name,
        plan_id = excluded.plan_id,
        default_policy_set = excluded.default_policy_set,
        organization_id = excluded.organization_id,
        updated_at = excluded.updated_at`, record.workspaceId, record.ownerId, record.displayName, record.planId, record.defaultPolicySet, record.organizationId, record.createdAt, record.updatedAt);
    }
    upsertWorkspaceMembershipRecord(record) {
        execute(this.db.connection, `INSERT INTO workspace_memberships (
        workspace_id, user_id, role, joined_at
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(workspace_id, user_id) DO UPDATE SET
        role = excluded.role,
        joined_at = excluded.joined_at`, record.workspaceId, record.userId, record.role, record.joinedAt);
    }
    upsertOrganizationRecord(record) {
        execute(this.db.connection, `INSERT INTO organizations (
        organization_id, display_name, billing_account_id, default_tenant_id, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(organization_id) DO UPDATE SET
        display_name = excluded.display_name,
        billing_account_id = excluded.billing_account_id,
        default_tenant_id = excluded.default_tenant_id,
        updated_at = excluded.updated_at`, record.organizationId, record.displayName, record.billingAccountId, record.defaultTenantId, record.createdAt, record.updatedAt);
    }
    upsertOrganizationMembershipRecord(record) {
        execute(this.db.connection, `INSERT INTO organization_memberships (
        organization_id, user_id, role, joined_at
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(organization_id, user_id) DO UPDATE SET
        role = excluded.role,
        joined_at = excluded.joined_at`, record.organizationId, record.userId, record.role, record.joinedAt);
    }
    upsertTenantRecord(record) {
        const displayName = record.displayName ?? record.tenantId;
        execute(this.db.connection, `INSERT INTO tenants (
        tenant_id, organization_id, display_name, storage_scope, identity_scope, policy_scope, artifact_scope,
        isolation_mode, deployment_mode, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenant_id) DO UPDATE SET
        organization_id = excluded.organization_id,
        display_name = excluded.display_name,
        storage_scope = excluded.storage_scope,
        identity_scope = excluded.identity_scope,
        policy_scope = excluded.policy_scope,
        artifact_scope = excluded.artifact_scope,
        isolation_mode = excluded.isolation_mode,
        deployment_mode = excluded.deployment_mode,
        updated_at = excluded.updated_at`, record.tenantId, record.organizationId, displayName, record.storageScope, record.identityScope, record.policyScope, record.artifactScope, record.isolationMode, record.deploymentMode, record.createdAt, record.updatedAt);
    }
    upsertDeploymentBindingRecord(record) {
        execute(this.db.connection, `INSERT INTO deployment_bindings (
        binding_id, tenant_id, environment_id, deployment_mode, region, network_boundary, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(binding_id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        environment_id = excluded.environment_id,
        deployment_mode = excluded.deployment_mode,
        region = excluded.region,
        network_boundary = excluded.network_boundary,
        updated_at = excluded.updated_at`, record.bindingId, record.tenantId, record.environmentId, record.deploymentMode, record.region, record.networkBoundary, record.createdAt, record.updatedAt);
    }
    upsertDataNamespaceRecord(record) {
        execute(this.db.connection, `INSERT INTO data_namespaces (
        namespace_id, plane, tenant_id, organization_id, workspace_id, retention_policy,
        encryption_policy, residency_policy, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(namespace_id) DO UPDATE SET
        plane = excluded.plane,
        tenant_id = excluded.tenant_id,
        organization_id = excluded.organization_id,
        workspace_id = excluded.workspace_id,
        retention_policy = excluded.retention_policy,
        encryption_policy = excluded.encryption_policy,
        residency_policy = excluded.residency_policy,
        updated_at = excluded.updated_at`, record.namespaceId, record.plane, record.tenantId, record.organizationId, record.workspaceId, record.retentionPolicy, record.encryptionPolicy, record.residencyPolicy, record.createdAt, record.updatedAt);
    }
    getWorkspaceRecord(workspaceId) {
        return queryOne(this.db.connection, `SELECT
         workspace_id AS workspaceId,
         owner_id AS ownerId,
         display_name AS displayName,
         plan_id AS planId,
         default_policy_set AS defaultPolicySet,
         organization_id AS organizationId,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM workspaces
       WHERE workspace_id = ?`, workspaceId) ?? null;
    }
    listWorkspaceRecords(options = {}) {
        const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 50)) : 50;
        if (options.organizationId !== undefined) {
            return queryAll(this.db.connection, `SELECT
           workspace_id AS workspaceId,
           owner_id AS ownerId,
           display_name AS displayName,
           plan_id AS planId,
           default_policy_set AS defaultPolicySet,
           organization_id AS organizationId,
           created_at AS createdAt,
           updated_at AS updatedAt
         FROM workspaces
         WHERE organization_id IS ?
         ORDER BY updated_at DESC, workspace_id ASC
         LIMIT ?`, options.organizationId, safeLimit);
        }
        return queryAll(this.db.connection, `SELECT
         workspace_id AS workspaceId,
         owner_id AS ownerId,
         display_name AS displayName,
         plan_id AS planId,
         default_policy_set AS defaultPolicySet,
         organization_id AS organizationId,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM workspaces
       ORDER BY updated_at DESC, workspace_id ASC
       LIMIT ?`, safeLimit);
    }
    listWorkspaceMemberships(workspaceId) {
        return queryAll(this.db.connection, `SELECT
         workspace_id AS workspaceId,
         user_id AS userId,
         role,
         joined_at AS joinedAt
       FROM workspace_memberships
       WHERE workspace_id = ?
       ORDER BY joined_at ASC, user_id ASC`, workspaceId);
    }
    getOrganizationRecord(organizationId) {
        return queryOne(this.db.connection, `SELECT
         organization_id AS organizationId,
         display_name AS displayName,
         billing_account_id AS billingAccountId,
         default_tenant_id AS defaultTenantId,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM organizations
       WHERE organization_id = ?`, organizationId) ?? null;
    }
    listOrganizationRecords(limit = 50) {
        const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 50;
        return queryAll(this.db.connection, `SELECT
         organization_id AS organizationId,
         display_name AS displayName,
         billing_account_id AS billingAccountId,
         default_tenant_id AS defaultTenantId,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM organizations
       ORDER BY updated_at DESC, organization_id ASC
       LIMIT ?`, safeLimit);
    }
    listOrganizationMemberships(organizationId) {
        return queryAll(this.db.connection, `SELECT
         organization_id AS organizationId,
         user_id AS userId,
         role,
         joined_at AS joinedAt
       FROM organization_memberships
       WHERE organization_id = ?
       ORDER BY joined_at ASC, user_id ASC`, organizationId);
    }
    getTenantRecord(tenantId) {
        return queryOne(this.db.connection, `SELECT
         tenant_id AS tenantId,
         organization_id AS organizationId,
         display_name AS displayName,
         storage_scope AS storageScope,
         identity_scope AS identityScope,
         policy_scope AS policyScope,
         artifact_scope AS artifactScope,
         isolation_mode AS isolationMode,
         deployment_mode AS deploymentMode,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM tenants
       WHERE tenant_id = ?`, tenantId) ?? null;
    }
    listTenantRecords(options = {}) {
        const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 50)) : 50;
        if (options.organizationId !== undefined) {
            return queryAll(this.db.connection, `SELECT
           tenant_id AS tenantId,
           organization_id AS organizationId,
           display_name AS displayName,
           storage_scope AS storageScope,
           identity_scope AS identityScope,
           policy_scope AS policyScope,
           artifact_scope AS artifactScope,
           isolation_mode AS isolationMode,
           deployment_mode AS deploymentMode,
           created_at AS createdAt,
           updated_at AS updatedAt
         FROM tenants
         WHERE organization_id IS ?
         ORDER BY updated_at DESC, tenant_id ASC
         LIMIT ?`, options.organizationId, safeLimit);
        }
        return queryAll(this.db.connection, `SELECT
         tenant_id AS tenantId,
         organization_id AS organizationId,
         display_name AS displayName,
         storage_scope AS storageScope,
         identity_scope AS identityScope,
         policy_scope AS policyScope,
         artifact_scope AS artifactScope,
         isolation_mode AS isolationMode,
         deployment_mode AS deploymentMode,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM tenants
       ORDER BY updated_at DESC, tenant_id ASC
       LIMIT ?`, safeLimit);
    }
    getDeploymentBindingRecord(bindingId) {
        return queryOne(this.db.connection, `SELECT
         binding_id AS bindingId,
         tenant_id AS tenantId,
         environment_id AS environmentId,
         deployment_mode AS deploymentMode,
         region,
         network_boundary AS networkBoundary,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM deployment_bindings
       WHERE binding_id = ?`, bindingId) ?? null;
    }
    listDeploymentBindings(options = {}) {
        const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 50)) : 50;
        if (options.tenantId !== undefined) {
            return queryAll(this.db.connection, `SELECT
           binding_id AS bindingId,
           tenant_id AS tenantId,
           environment_id AS environmentId,
           deployment_mode AS deploymentMode,
           region,
           network_boundary AS networkBoundary,
           created_at AS createdAt,
           updated_at AS updatedAt
         FROM deployment_bindings
         WHERE tenant_id IS ?
         ORDER BY updated_at DESC, binding_id ASC
         LIMIT ?`, options.tenantId, safeLimit);
        }
        return queryAll(this.db.connection, `SELECT
         binding_id AS bindingId,
         tenant_id AS tenantId,
         environment_id AS environmentId,
         deployment_mode AS deploymentMode,
         region,
         network_boundary AS networkBoundary,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM deployment_bindings
       ORDER BY updated_at DESC, binding_id ASC
       LIMIT ?`, safeLimit);
    }
    getDataNamespaceRecord(namespaceId) {
        return queryOne(this.db.connection, `SELECT
         namespace_id AS namespaceId,
         plane,
         tenant_id AS tenantId,
         organization_id AS organizationId,
         workspace_id AS workspaceId,
         retention_policy AS retentionPolicy,
         encryption_policy AS encryptionPolicy,
         residency_policy AS residencyPolicy,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM data_namespaces
       WHERE namespace_id = ?`, namespaceId) ?? null;
    }
    listDataNamespaces(options = {}) {
        const conditions = [];
        const parameters = [];
        if (options.plane != null) {
            conditions.push("plane = ?");
            parameters.push(options.plane);
        }
        if (options.tenantId !== undefined) {
            conditions.push("tenant_id IS ?");
            parameters.push(options.tenantId);
        }
        if (options.organizationId !== undefined) {
            conditions.push("organization_id IS ?");
            parameters.push(options.organizationId);
        }
        if (options.workspaceId !== undefined) {
            conditions.push("workspace_id IS ?");
            parameters.push(options.workspaceId);
        }
        const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 100)) : 100;
        parameters.push(safeLimit);
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        return queryAll(this.db.connection, `SELECT
         namespace_id AS namespaceId,
         plane,
         tenant_id AS tenantId,
         organization_id AS organizationId,
         workspace_id AS workspaceId,
         retention_policy AS retentionPolicy,
         encryption_policy AS encryptionPolicy,
         residency_policy AS residencyPolicy,
         created_at AS createdAt,
         updated_at AS updatedAt
       FROM data_namespaces
       ${whereClause}
       ORDER BY updated_at DESC, namespace_id ASC
       LIMIT ?`, ...parameters);
    }
}
//# sourceMappingURL=organization-repository.js.map