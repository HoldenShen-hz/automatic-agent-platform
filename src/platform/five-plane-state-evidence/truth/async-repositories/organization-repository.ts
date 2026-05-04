/**
 * AsyncOrganizationRepository - Async data access for workspaces, organizations, tenants, and namespaces.
 */

import type {
  DataNamespaceRecord,
  DeploymentBindingRecord,
  OrganizationMembershipRecord,
  OrganizationRecord,
  TenantRecord,
  WorkspaceMembershipRecord,
  WorkspaceRecord,
} from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";

export class AsyncOrganizationRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  public async upsertWorkspaceRecord(record: WorkspaceRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO workspaces (
        workspace_id, owner_id, display_name, plan_id, default_policy_set, organization_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT(workspace_id) DO UPDATE SET
        owner_id = excluded.owner_id,
        display_name = excluded.display_name,
        plan_id = excluded.plan_id,
        default_policy_set = excluded.default_policy_set,
        organization_id = excluded.organization_id,
        updated_at = excluded.updated_at`,
      record.workspaceId,
      record.ownerId,
      record.displayName,
      record.planId,
      record.defaultPolicySet,
      record.organizationId,
      record.createdAt,
      record.updatedAt,
    );
  }

  public async upsertWorkspaceMembershipRecord(record: WorkspaceMembershipRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO workspace_memberships (
        workspace_id, user_id, role, joined_at
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT(workspace_id, user_id) DO UPDATE SET
        role = excluded.role,
        joined_at = excluded.joined_at`,
      record.workspaceId,
      record.userId,
      record.role,
      record.joinedAt,
    );
  }

  public async upsertOrganizationRecord(record: OrganizationRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO organizations (
        organization_id, display_name, billing_account_id, default_tenant_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT(organization_id) DO UPDATE SET
        display_name = excluded.display_name,
        billing_account_id = excluded.billing_account_id,
        default_tenant_id = excluded.default_tenant_id,
        updated_at = excluded.updated_at`,
      record.organizationId,
      record.displayName,
      record.billingAccountId,
      record.defaultTenantId,
      record.createdAt,
      record.updatedAt,
    );
  }

  public async upsertOrganizationMembershipRecord(record: OrganizationMembershipRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO organization_memberships (
        organization_id, user_id, role, joined_at
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT(organization_id, user_id) DO UPDATE SET
        role = excluded.role,
        joined_at = excluded.joined_at`,
      record.organizationId,
      record.userId,
      record.role,
      record.joinedAt,
    );
  }

  public async upsertTenantRecord(record: TenantRecord): Promise<void> {
    const displayName = record.displayName ?? record.tenantId;
    await asyncExecute(
      this.conn,
      `INSERT INTO tenants (
        tenant_id, organization_id, display_name, storage_scope, identity_scope, policy_scope, artifact_scope,
        isolation_mode, deployment_mode, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT(tenant_id) DO UPDATE SET
        organization_id = excluded.organization_id,
        display_name = excluded.display_name,
        storage_scope = excluded.storage_scope,
        identity_scope = excluded.identity_scope,
        policy_scope = excluded.policy_scope,
        artifact_scope = excluded.artifact_scope,
        isolation_mode = excluded.isolation_mode,
        deployment_mode = excluded.deployment_mode,
        updated_at = excluded.updated_at`,
      record.tenantId,
      record.organizationId,
      displayName,
      record.storageScope,
      record.identityScope,
      record.policyScope,
      record.artifactScope,
      record.isolationMode,
      record.deploymentMode,
      record.createdAt,
      record.updatedAt,
    );
  }

  public async upsertDeploymentBindingRecord(record: DeploymentBindingRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO deployment_bindings (
        binding_id, tenant_id, environment_id, deployment_mode, region, network_boundary, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT(binding_id) DO UPDATE SET
        tenant_id = excluded.tenant_id,
        environment_id = excluded.environment_id,
        deployment_mode = excluded.deployment_mode,
        region = excluded.region,
        network_boundary = excluded.network_boundary,
        updated_at = excluded.updated_at`,
      record.bindingId,
      record.tenantId,
      record.environmentId,
      record.deploymentMode,
      record.region,
      record.networkBoundary,
      record.createdAt,
      record.updatedAt,
    );
  }

  public async upsertDataNamespaceRecord(record: DataNamespaceRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO data_namespaces (
        namespace_id, plane, tenant_id, organization_id, workspace_id, retention_policy,
        encryption_policy, residency_policy, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT(namespace_id) DO UPDATE SET
        plane = excluded.plane,
        tenant_id = excluded.tenant_id,
        organization_id = excluded.organization_id,
        workspace_id = excluded.workspace_id,
        retention_policy = excluded.retention_policy,
        encryption_policy = excluded.encryption_policy,
        residency_policy = excluded.residency_policy,
        updated_at = excluded.updated_at`,
      record.namespaceId,
      record.plane,
      record.tenantId,
      record.organizationId,
      record.workspaceId,
      record.retentionPolicy,
      record.encryptionPolicy,
      record.residencyPolicy,
      record.createdAt,
      record.updatedAt,
    );
  }

  public async getWorkspaceRecord(workspaceId: string): Promise<WorkspaceRecord | null> {
    const result = await asyncQueryOne<WorkspaceRecord>(
      this.conn,
      `SELECT
         workspace_id AS "workspaceId",
         owner_id AS "ownerId",
         display_name AS "displayName",
         plan_id AS "planId",
         default_policy_set AS "defaultPolicySet",
         organization_id AS "organizationId",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM workspaces
       WHERE workspace_id = $1`,
      workspaceId,
    );
    return result ?? null;
  }

  public async listWorkspaceRecords(options: {
    organizationId?: string | null;
    limit?: number;
  } = {}): Promise<WorkspaceRecord[]> {
    const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 50)) : 50;
    if (options.organizationId !== undefined) {
      return asyncQueryAll<WorkspaceRecord>(
        this.conn,
        `SELECT
           workspace_id AS "workspaceId",
           owner_id AS "ownerId",
           display_name AS "displayName",
           plan_id AS "planId",
           default_policy_set AS "defaultPolicySet",
           organization_id AS "organizationId",
           created_at AS "createdAt",
           updated_at AS "updatedAt"
         FROM workspaces
         WHERE organization_id = $1
         ORDER BY updated_at DESC, workspace_id ASC
         LIMIT $2`,
        options.organizationId,
        safeLimit,
      );
    }
    return asyncQueryAll<WorkspaceRecord>(
      this.conn,
      `SELECT
         workspace_id AS "workspaceId",
         owner_id AS "ownerId",
         display_name AS "displayName",
         plan_id AS "planId",
         default_policy_set AS "defaultPolicySet",
         organization_id AS "organizationId",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM workspaces
       ORDER BY updated_at DESC, workspace_id ASC
       LIMIT $1`,
      safeLimit,
    );
  }

  public async listWorkspaceMemberships(workspaceId: string): Promise<WorkspaceMembershipRecord[]> {
    return asyncQueryAll<WorkspaceMembershipRecord>(
      this.conn,
      `SELECT
         workspace_id AS "workspaceId",
         user_id AS "userId",
         role,
         joined_at AS "joinedAt"
       FROM workspace_memberships
       WHERE workspace_id = $1
       ORDER BY joined_at ASC, user_id ASC`,
      workspaceId,
    );
  }

  public async getOrganizationRecord(organizationId: string): Promise<OrganizationRecord | null> {
    const result = await asyncQueryOne<OrganizationRecord>(
      this.conn,
      `SELECT
         organization_id AS "organizationId",
         display_name AS "displayName",
         billing_account_id AS "billingAccountId",
         default_tenant_id AS "defaultTenantId",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM organizations
       WHERE organization_id = $1`,
      organizationId,
    );
    return result ?? null;
  }

  public async listOrganizationRecords(limit = 50): Promise<OrganizationRecord[]> {
    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.trunc(limit)) : 50;
    return asyncQueryAll<OrganizationRecord>(
      this.conn,
      `SELECT
         organization_id AS "organizationId",
         display_name AS "displayName",
         billing_account_id AS "billingAccountId",
         default_tenant_id AS "defaultTenantId",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM organizations
       ORDER BY updated_at DESC, organization_id ASC
       LIMIT $1`,
      safeLimit,
    );
  }

  public async listOrganizationMemberships(organizationId: string): Promise<OrganizationMembershipRecord[]> {
    return asyncQueryAll<OrganizationMembershipRecord>(
      this.conn,
      `SELECT
         organization_id AS "organizationId",
         user_id AS "userId",
         role,
         joined_at AS "joinedAt"
       FROM organization_memberships
       WHERE organization_id = $1
       ORDER BY joined_at ASC, user_id ASC`,
      organizationId,
    );
  }

  public async getTenantRecord(tenantId: string): Promise<TenantRecord | null> {
    const result = await asyncQueryOne<TenantRecord>(
      this.conn,
      `SELECT
         tenant_id AS "tenantId",
         organization_id AS "organizationId",
         display_name AS "displayName",
         storage_scope AS "storageScope",
         identity_scope AS "identityScope",
         policy_scope AS "policyScope",
         artifact_scope AS "artifactScope",
         isolation_mode AS "isolationMode",
         deployment_mode AS "deploymentMode",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM tenants
       WHERE tenant_id = $1`,
      tenantId,
    );
    return result ?? null;
  }

  public async listTenantRecords(options: {
    organizationId?: string | null;
    limit?: number;
  } = {}): Promise<TenantRecord[]> {
    const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 50)) : 50;
    if (options.organizationId !== undefined) {
      return asyncQueryAll<TenantRecord>(
        this.conn,
        `SELECT
           tenant_id AS "tenantId",
           organization_id AS "organizationId",
           display_name AS "displayName",
           storage_scope AS "storageScope",
           identity_scope AS "identityScope",
           policy_scope AS "policyScope",
           artifact_scope AS "artifactScope",
           isolation_mode AS "isolationMode",
           deployment_mode AS "deploymentMode",
           created_at AS "createdAt",
           updated_at AS "updatedAt"
         FROM tenants
         WHERE organization_id = $1
         ORDER BY updated_at DESC, tenant_id ASC
         LIMIT $2`,
        options.organizationId,
        safeLimit,
      );
    }
    return asyncQueryAll<TenantRecord>(
      this.conn,
      `SELECT
         tenant_id AS "tenantId",
         organization_id AS "organizationId",
         display_name AS "displayName",
         storage_scope AS "storageScope",
         identity_scope AS "identityScope",
         policy_scope AS "policyScope",
         artifact_scope AS "artifactScope",
         isolation_mode AS "isolationMode",
         deployment_mode AS "deploymentMode",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM tenants
       ORDER BY updated_at DESC, tenant_id ASC
       LIMIT $1`,
      safeLimit,
    );
  }

  public async getDeploymentBindingRecord(bindingId: string): Promise<DeploymentBindingRecord | null> {
    const result = await asyncQueryOne<DeploymentBindingRecord>(
      this.conn,
      `SELECT
         binding_id AS "bindingId",
         tenant_id AS "tenantId",
         environment_id AS "environmentId",
         deployment_mode AS "deploymentMode",
         region,
         network_boundary AS "networkBoundary",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM deployment_bindings
       WHERE binding_id = $1`,
      bindingId,
    );
    return result ?? null;
  }

  public async listDeploymentBindings(options: {
    tenantId?: string | null;
    limit?: number;
  } = {}): Promise<DeploymentBindingRecord[]> {
    const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 50)) : 50;
    if (options.tenantId !== undefined) {
      return asyncQueryAll<DeploymentBindingRecord>(
        this.conn,
        `SELECT
           binding_id AS "bindingId",
           tenant_id AS "tenantId",
           environment_id AS "environmentId",
           deployment_mode AS "deploymentMode",
           region,
           network_boundary AS "networkBoundary",
           created_at AS "createdAt",
           updated_at AS "updatedAt"
         FROM deployment_bindings
         WHERE tenant_id IS $1
         ORDER BY updated_at DESC, binding_id ASC
         LIMIT $2`,
        options.tenantId,
        safeLimit,
      );
    }
    return asyncQueryAll<DeploymentBindingRecord>(
      this.conn,
      `SELECT
         binding_id AS "bindingId",
         tenant_id AS "tenantId",
         environment_id AS "environmentId",
         deployment_mode AS "deploymentMode",
         region,
         network_boundary AS "networkBoundary",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM deployment_bindings
       ORDER BY updated_at DESC, binding_id ASC
       LIMIT $1`,
      safeLimit,
    );
  }

  public async getDataNamespaceRecord(namespaceId: string): Promise<DataNamespaceRecord | null> {
    const result = await asyncQueryOne<DataNamespaceRecord>(
      this.conn,
      `SELECT
         namespace_id AS "namespaceId",
         plane,
         tenant_id AS "tenantId",
         organization_id AS "organizationId",
         workspace_id AS "workspaceId",
         retention_policy AS "retentionPolicy",
         encryption_policy AS "encryptionPolicy",
         residency_policy AS "residencyPolicy",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM data_namespaces
       WHERE namespace_id = $1`,
      namespaceId,
    );
    return result ?? null;
  }

  public async listDataNamespaces(options: {
    plane?: DataNamespaceRecord["plane"] | null;
    tenantId?: string | null;
    organizationId?: string | null;
    workspaceId?: string | null;
    limit?: number;
  } = {}): Promise<DataNamespaceRecord[]> {
    const conditions: string[] = [];
    const parameters: unknown[] = [];

    if (options.plane != null) {
      conditions.push(`plane = $${parameters.length + 1}`);
      parameters.push(options.plane);
    }
    if (options.tenantId !== undefined) {
      conditions.push(`tenant_id = $${parameters.length + 1}`);
      parameters.push(options.tenantId);
    }
    if (options.organizationId !== undefined) {
      conditions.push(`organization_id = $${parameters.length + 1}`);
      parameters.push(options.organizationId);
    }
    if (options.workspaceId !== undefined) {
      conditions.push(`workspace_id = $${parameters.length + 1}`);
      parameters.push(options.workspaceId);
    }

    const safeLimit = Number.isFinite(options.limit) ? Math.max(1, Math.trunc(options.limit ?? 100)) : 100;
    parameters.push(safeLimit);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    return asyncQueryAll<DataNamespaceRecord>(
      this.conn,
      `SELECT
         namespace_id AS "namespaceId",
         plane,
         tenant_id AS "tenantId",
         organization_id AS "organizationId",
         workspace_id AS "workspaceId",
         retention_policy AS "retentionPolicy",
         encryption_policy AS "encryptionPolicy",
         residency_policy AS "residencyPolicy",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM data_namespaces
       ${whereClause}
       ORDER BY updated_at DESC, namespace_id ASC
       LIMIT $${parameters.length}`,
      ...parameters,
    );
  }
}
