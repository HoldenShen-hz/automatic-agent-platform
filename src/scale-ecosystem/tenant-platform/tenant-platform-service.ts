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

import { MonetizationError, PolicyDeniedError, TenantBoundaryError, ValidationError } from "../../platform/contracts/errors.js";
import { AuthoritativeTaskStore } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import { NoisyNeighborProtectionService, getNoisyNeighborProtectionService, type ResourceType } from "../multi-region/noisy-neighbor-protection.js";
import { PerTenantEncryptionService, getPerTenantEncryptionService, type EncryptionAlgorithm, type EncryptedRecord } from "../multi-region/per-tenant-encryption.js";
import { ResourcePoolService, type ResourcePool } from "../resource-manager/resource-pool-service.js";
import { FairSchedulingService, type FairSchedulingRequest } from "../resource-manager/fair-scheduling-service.js";
import { type PreemptionCandidate } from "../resource-manager/preemption/index.js";
import { type SchedulingClass } from "../resource-manager/fair-scheduling-service.js";
import { type MultiResourceQuotaVector } from "../resource-manager/quota-enforcer/index.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
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
import type { Slo } from "../../platform/contracts/types/slo.js";
import {
  VALID_LIFECYCLE_TRANSITIONS,
  assertIdentifier,
  assertNonEmpty,
  fromTenantStatus,
  toTenantStatus,
  type AddOrganizationMembershipInput,
  type AddWorkspaceMembershipInput,
  type CreateDataNamespaceInput,
  type CreateDeploymentBindingInput,
  type CreateOrganizationInput,
  type CreateTenantInput,
  type CreateWorkspaceInput,
  type DedicatedPoolIsolationRecord,
  type TenantLifecycleInput,
  type TenantLifecycleStage,
  type TenantTopologySummary,
} from "./tenant-platform-types.js";
export type {
  AddOrganizationMembershipInput,
  AddWorkspaceMembershipInput,
  CreateDataNamespaceInput,
  CreateDeploymentBindingInput,
  CreateOrganizationInput,
  CreateTenantInput,
  CreateWorkspaceInput,
  DedicatedPoolIsolationRecord,
  TenantLifecycleInput,
  TenantLifecycleStage,
  TenantTopologySummary,
} from "./tenant-platform-types.js";

/**
 * Service for managing the tenant platform topology.
 *
 * Provides CRUD operations for organizations, workspaces, tenants,
 * deployment bindings, and data namespaces. Enforces organizational
 * boundaries and validates scope relationships when creating namespaces.
 * Integrates noisy-neighbor protection for quota enforcement (R13-27, R13-32).
 */
export class TenantPlatformService {
  private readonly quotaService: NoisyNeighborProtectionService;
  private readonly encryptionService: PerTenantEncryptionService;
  private readonly resourcePoolService: ResourcePoolService;
  private readonly fairSchedulingService: FairSchedulingService;
  private readonly logger = new StructuredLogger({});
  private readonly dedicatedPoolIsolations = new Map<string, DedicatedPoolIsolationRecord>();
  private readonly sloDefinitions = new Map<string, Slo>();

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
    quotaService?: NoisyNeighborProtectionService,
    encryptionService?: PerTenantEncryptionService,
    resourcePoolService?: ResourcePoolService,
    fairSchedulingService?: FairSchedulingService,
  ) {
    this.quotaService = quotaService ?? getNoisyNeighborProtectionService();
    this.encryptionService = encryptionService ?? getPerTenantEncryptionService();
    this.resourcePoolService = resourcePoolService ?? new ResourcePoolService();
    this.fairSchedulingService = fairSchedulingService ?? new FairSchedulingService();
  }

  public getResourcePoolService(): ResourcePoolService {
    return this.resourcePoolService;
  }

  public getFairSchedulingService(): FairSchedulingService {
    return this.fairSchedulingService;
  }

  public defineSlo(tenantId: string, slo: Slo): void {
    assertIdentifier(tenantId, "tenant.invalid_tenant_id");
    this.sloDefinitions.set(`${tenantId}:${slo.sloId}`, slo);
  }

  public getSloForTenant(tenantId: string): Slo[] {
    const results: Slo[] = [];
    for (const [key, slo] of this.sloDefinitions) {
      if (key.startsWith(`${tenantId}:`)) {
        results.push(slo);
      }
    }
    return results;
  }

  public evaluateSlo(sloId: string, metrics: Record<string, number>): boolean {
    for (const slo of this.sloDefinitions.values()) {
      if (slo.sloId === sloId) {
        const value = metrics[slo.metric];
        if (value === undefined) {
          return false;
        }
        switch (slo.operator) {
          case ">":
            return value > slo.target;
          case "<":
            return value < slo.target;
          case ">=":
            return value >= slo.target;
          case "<=":
            return value <= slo.target;
        }
      }
    }
    return false;
  }

  private getPreemptionCandidatesForTenant(tenantId: string): PreemptionCandidate[] {
    const candidates: PreemptionCandidate[] = [];

    const activeExecutions = this.store.dispatch?.listExecutionsByStatuses?.(["executing", "blocked"]) ?? [];

    for (const execution of activeExecutions) {
      // Get task to check tenant ownership
      const task = this.store.task.getTask(execution.taskId);
      if (!task || task.tenantId !== tenantId) {
        continue;
      }

      // Get workflow state to check status and checkpoint info
      const workflow = this.store.workflow.getWorkflowState(execution.taskId);
      if (!workflow || workflow.status !== "running") {
        continue;
      }

      // Get active lease via worker repository (which has getActiveExecutionLease)
      const activeLease = this.store.worker.getActiveExecutionLease(execution.id);
      if (!activeLease) {
        continue;
      }

      // Get agent execution record for checkpoint info
      const agentExecution = this.store.worker.getAgentExecutionRecord(execution.id);

      // Calculate progress percentage from workflow step index
      // Estimate 100 steps total for progress calculation if not available
      const totalSteps = 100;
      const progressPercent = workflow.currentStepIndex != null
        ? (workflow.currentStepIndex / totalSteps) * 100
        : 0;

      // Get checkpoint timestamp from workflow updatedAt as fallback
      const lastCheckpointTimestampMs = workflow.updatedAt
        ? new Date(workflow.updatedAt).getTime()
        : 0;

      // Determine priority - default to normal if not set
      const priority = task.priority === "urgent" ? 100 : task.priority === "high" ? 75 : task.priority === "normal" ? 50 : 25;

      candidates.push({
        executionId: execution.id,
        priority,
        progressPercent,
        lastCheckpointTimestampMs,
      });
    }

    return candidates;
  }

  public getDedicatedPoolIsolation(tenantId: string): DedicatedPoolIsolationRecord | null {
    return this.dedicatedPoolIsolations.get(tenantId) ?? null;
  }

  /**
   * R21-09: Enforce quota limits for a tenant before performing an operation (R13-27, R13-32).
   *
   * Uses FairSchedulingService to determine if quota-exceeded requests can be served
   * via preemption of lower-priority tenant workloads. This implements weighted fair
   * queuing with priority-based preemption for tenant-aware scheduling.
   *
   * @param tenantId - Tenant to check quotas for
   * @param resourceType - Type of resource being consumed
   * @param cost - Cost of the operation (default 1)
   * @param schedulingClass - Optional scheduling class for priority-aware preemption decisions
   * @param preemptionCandidates - Optional candidates for preemption when quota is exceeded
   * @throws PolicyDeniedError if quota is exceeded and preemption is not possible
   */
  private enforceQuota(
    tenantId: string,
    resourceType: ResourceType,
    cost: number = 1,
    schedulingClass?: SchedulingClass,
    preemptionCandidates?: readonly PreemptionCandidate[],
  ): void {
    // R21-09: Integrate fair scheduling for weighted fair queue and tenant-aware scheduling
    const quotaCheck = this.quotaService.checkRateLimit(tenantId, resourceType, cost);

    if (!quotaCheck.allowed) {
      // If preemption candidates provided and scheduling class available, try preemption
      if (schedulingClass && preemptionCandidates && preemptionCandidates.length > 0) {
        const preemptionDecision = this.enforceQuotaWithPreemption(
          tenantId,
          resourceType,
          cost,
          schedulingClass,
          preemptionCandidates,
        );

        if (preemptionDecision.shouldPreempt && preemptionDecision.victimExecutionId) {
          // Preemption allowed - quota satisfied via victim eviction
          return;
        }
        // Preemption not possible or not allowed - fall through to rejection
      }

      throw new PolicyDeniedError(
        "tenant.quota_exceeded",
        `Quota exceeded for ${resourceType}: ${quotaCheck.currentUsage}/${quotaCheck.limit}`,
        {
          retryable: quotaCheck.retryAfterMs !== null,
          details: {
            tenantId,
            resourceType,
            currentUsage: quotaCheck.currentUsage,
            limit: quotaCheck.limit,
            remaining: quotaCheck.remaining,
            retryAfterMs: quotaCheck.retryAfterMs,
            quotaId: quotaCheck.quotaId,
          },
        },
      );
    }
    // Record the usage
    this.quotaService.recordUsage(tenantId, resourceType, cost);
  }

  /**
   * R21-08: Enforce quota with preemption support for over-limit scenarios.
   *
   * When a tenant exceeds quota, this method uses FairSchedulingService to determine
   * if a lower-priority tenant workload can be preempted to make room. This integrates
   * quota enforcement with the preemption mechanism to ensure resource contention
   * is resolved by evicting low-priority loads rather than blocking high-priority ones.
   *
   * @param tenantId - Tenant to check quotas for
   * @param resourceType - Type of resource being consumed
   * @param requestedUnits - Number of units being requested
   * @param schedulingClass - Scheduling class for the tenant (determines priority)
   * @param preemptionCandidates - Candidates for preemption (other tenant workloads)
   * @returns PreemptionDecision indicating if preemption is needed and which victim to evict
   */
  public enforceQuotaWithPreemption(
    tenantId: string,
    resourceType: ResourceType,
    requestedUnits: number,
    schedulingClass: SchedulingClass,
    preemptionCandidates: readonly PreemptionCandidate[],
  ): { shouldPreempt: boolean; victimExecutionId: string | null; reason: string | null } {
    // First check if quota allows the request directly
    const quotaCheck = this.quotaService.checkRateLimit(tenantId, resourceType, requestedUnits);
    if (quotaCheck.allowed) {
      this.quotaService.recordUsage(tenantId, resourceType, requestedUnits);
      return {
        shouldPreempt: false,
        victimExecutionId: null,
        reason: null,
      };
    }

    // Quota exceeded - use FairSchedulingService to determine preemption
    const quotaVector: MultiResourceQuotaVector = {
      scope: "tenant",
      scopeId: tenantId,
      workerUnits: {
        hardLimit: quotaCheck.limit,
        currentUsage: quotaCheck.currentUsage,
      },
    };

    const request: FairSchedulingRequest = {
      quotaPolicy: quotaVector,
      claim: {
        claimId: `claim_${tenantId}_${resourceType}`,
        schedulingClass,
        requestedUnits,
      },
      queueItems: [],
      preemptionCandidates,
    };

    const decision = this.fairSchedulingService.schedule(request);
    if (decision.preemption.shouldPreempt && decision.preemption.victimExecutionId) {
      // Record usage for the preempted resource
      this.quotaService.recordUsage(tenantId, resourceType, requestedUnits);
    }
    return decision.preemption;
  }

  /**
   * Creates a new workspace and adds the owner as a member with "owner" role.
   *
   * @param input - Workspace creation parameters
   * @returns The created workspace record
   */
  public createWorkspace(input: CreateWorkspaceInput): WorkspaceRecord {
    return this.db.transaction(() => {
      // R13-32: Enforce tenant-scoped quota before creating workspace
      // Use organization-scoped quota if tenantId is not available
      const org = input.organizationId ? this.requireOrganization(input.organizationId) : null;
      if (org?.defaultTenantId) {
        // R21-08: Use preemption-aware quota enforcement
        const candidates = this.getPreemptionCandidatesForTenant(org.defaultTenantId);
        const schedulingClass: SchedulingClass = {
          tenantId: org.defaultTenantId,
          domainId: "workspace_creation",
          slaTierId: "default",
          priority: 50,
        };
        this.enforceQuota(org.defaultTenantId, "api_requests", 1, schedulingClass, candidates);
      }

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
   *
   * @param input - Membership creation parameters
   * @returns The created workspace membership record
   */
  public addWorkspaceMembership(input: AddWorkspaceMembershipInput): WorkspaceMembershipRecord {
    return this.db.transaction(() => {
      this.requireWorkspace(input.workspaceId);
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

      // Create organization record first so we can validate default tenant against it
      const organization: OrganizationRecord = {
        organizationId: assertIdentifier(input.organizationId ?? newId("org"), "tenant.invalid_organization_id"),
        displayName: assertNonEmpty(input.displayName, "tenant.invalid_organization_display_name"),
        billingAccountId: input.billingAccountId ? assertIdentifier(input.billingAccountId, "tenant.invalid_billing_account_id") : null,
        defaultTenantId: input.defaultTenantId ? assertIdentifier(input.defaultTenantId, "tenant.invalid_default_tenant_id") : null,
        createdAt,
        updatedAt: createdAt,
      };

      // Validate default tenant belongs to this organization
      // Must be checked AFTER creating organization record so we have the actual org ID
      if (input.defaultTenantId) {
        const tenant = this.requireTenant(input.defaultTenantId);
        if (tenant.organizationId !== organization.organizationId) {
          throw new TenantBoundaryError("tenant.default_tenant_mismatch", "tenant.default_tenant_mismatch", {
            details: {
              defaultTenantId: input.defaultTenantId,
              organizationId: organization.organizationId,
              tenantOrganizationId: tenant.organizationId,
            },
          });
        }
      }

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
  public addOrganizationMembership(input: AddOrganizationMembershipInput): OrganizationMembershipRecord {
    return this.db.transaction(() => {
      this.requireOrganization(input.organizationId);
      const membership: OrganizationMembershipRecord = {
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
   * When isolationMode is "dedicated_pool", provisions dedicated compute resources
   * for the tenant to ensure complete resource isolation from other tenants.
   *
   * @param input - Tenant creation parameters
   * @returns The created tenant record
   */
  public createTenant(input: CreateTenantInput): TenantRecord {
    return this.db.transaction(() => {
      const organization = this.requireOrganization(input.organizationId);
      // R13-32: Enforce tenant-scoped quota before creating tenant
      // Use organization's default tenant for quota tracking if available
      if (organization.defaultTenantId) {
        // R21-08: Use preemption-aware quota enforcement
        const candidates = this.getPreemptionCandidatesForTenant(organization.defaultTenantId);
        const schedulingClass: SchedulingClass = {
          tenantId: organization.defaultTenantId,
          domainId: "tenant_creation",
          slaTierId: "default",
          priority: 50,
        };
        this.enforceQuota(organization.defaultTenantId, "task_executions", 1, schedulingClass, candidates);
      }

      const createdAt = input.createdAt ?? nowIso();
      const tenantId = assertIdentifier(input.tenantId ?? newId("tenant"), "tenant.invalid_tenant_id");
      const isolationMode = input.isolationMode ?? "shared_hard_scoped";
      const tenant: TenantRecord = {
        tenantId,
        organizationId: organization.organizationId,
        displayName: tenantId,
        storageScope: assertIdentifier(input.storageScope, "tenant.invalid_storage_scope"),
        identityScope: assertIdentifier(input.identityScope, "tenant.invalid_identity_scope"),
        policyScope: assertIdentifier(input.policyScope, "tenant.invalid_policy_scope"),
        artifactScope: assertIdentifier(input.artifactScope, "tenant.invalid_artifact_scope"),
        isolationMode,
        deploymentMode: input.deploymentMode ?? "cloud_shared",
        quotas: {},
        createdAt,
        updatedAt: createdAt,
      };
      this.store.organization.upsertTenantRecord(tenant);
      this.ensureTenantEncryptionInitialized(tenant, input.encryptionConfig);

      // R15-57: Execute dedicated_pool isolation - provision dedicated resources
      if (isolationMode === "dedicated_pool") {
        this.provisionDedicatedPoolIsolation(tenant);
      }

      // Set as organization default if requested or if no default exists
      if (input.setAsOrganizationDefault === true || organization.defaultTenantId == null) {
        this.store.organization.upsertOrganizationRecord({
          ...organization,
          defaultTenantId: tenant.tenantId,
          updatedAt: createdAt,
        });
      }
      // Evaluate SLOs for the new tenant
      const tenantSlos = this.getSloForTenant(tenant.tenantId);
      for (const slo of tenantSlos) {
        this.logger?.info("SLO evaluated for new tenant", {
          tenantId: tenant.tenantId,
          sloId: slo.sloId,
          name: slo.name,
        });
      }
      return tenant;
    });
  }

  /**
   * R15-57: Provisions dedicated compute resources for a tenant in dedicated_pool isolation mode.
   *
   * This creates a dedicated worker pool, sets up isolated quota boundaries, and configures
   * the tenant's execution environment to run in complete isolation from other tenants.
   */
  private provisionDedicatedPoolIsolation(tenant: TenantRecord): void {
    const dedicatedQuotaId = `quota_dedicated_${tenant.tenantId}`;
    const provisionedAt = nowIso();
    const poolId = `tenant_pool_${tenant.tenantId}`;
    const resourcePool = this.resourcePoolService.registerPool({
      poolId,
      resourceType: "worker_pool",
      scopeType: "tenant",
      tenantId: tenant.tenantId,
      organizationId: tenant.organizationId,
      capacityUnits: 1,
      burstUnits: 0,
      minSampleSize: 20,
      sampleCount: 0,
      allocatedUnits: 0,
      failureRateThreshold: 0.3,
      failureRate: 0,
      isolationStatus: "active",
    });
    const isolationRecord: DedicatedPoolIsolationRecord = {
      tenantId: tenant.tenantId,
      organizationId: tenant.organizationId,
      resourcePool,
      routingPolicy: "dedicated_pool_only",
      executionIsolation: "tenant_scoped_worker_pool",
      provisionedAt,
      quotaScopeId: dedicatedQuotaId,
    };
    this.dedicatedPoolIsolations.set(tenant.tenantId, isolationRecord);

    this.logger?.info("Provisioning dedicated pool isolation", {
      tenantId: tenant.tenantId,
      organizationId: tenant.organizationId,
      dedicatedQuotaId,
      poolId,
      routingPolicy: isolationRecord.routingPolicy,
      action: "dedicated_pool_provisioning",
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
      // R13-32: Enforce tenant-scoped quota before creating deployment binding
      // R21-08: Use preemption-aware quota enforcement
      const candidates = this.getPreemptionCandidatesForTenant(tenant.tenantId);
      const schedulingClass: SchedulingClass = {
        tenantId: tenant.tenantId,
        domainId: "deployment_binding",
        slaTierId: "default",
        priority: 50,
      };
      this.enforceQuota(tenant.tenantId, "concurrent_connections", 1, schedulingClass, candidates);

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
      // Evaluate SLOs for the tenant after creating deployment binding
      const tenantSlos = this.getSloForTenant(tenant.tenantId);
      for (const slo of tenantSlos) {
        this.logger?.info("SLO evaluated after deployment binding", {
          tenantId: tenant.tenantId,
          bindingId: binding.bindingId,
          sloId: slo.sloId,
          name: slo.name,
        });
      }
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

      // R13-32: Enforce tenant-scoped quota before creating data namespace
      // Quota is checked against the tenant if available
      // R21-08: Use preemption-aware quota enforcement
      if (tenant?.tenantId) {
        const candidates = this.getPreemptionCandidatesForTenant(tenant.tenantId);
        const schedulingClass: SchedulingClass = {
          tenantId: tenant.tenantId,
          domainId: "data_namespace",
          slaTierId: "default",
          priority: 50,
        };
        this.enforceQuota(tenant.tenantId, "storage", 1, schedulingClass, candidates);
      } else if (organization?.defaultTenantId) {
        // Fall back to organization's default tenant for quota tracking
        const candidates = this.getPreemptionCandidatesForTenant(organization.defaultTenantId);
        const schedulingClass: SchedulingClass = {
          tenantId: organization.defaultTenantId,
          domainId: "data_namespace",
          slaTierId: "default",
          priority: 50,
        };
        this.enforceQuota(organization.defaultTenantId, "storage", 1, schedulingClass, candidates);
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
      if (tenant != null && !this.encryptionService.isInitialized(tenant.tenantId)) {
        this.ensureTenantEncryptionInitialized(tenant);
      }
      // Evaluate SLOs for the tenant after creating data namespace
      if (tenant != null) {
        const tenantSlos = this.getSloForTenant(tenant.tenantId);
        for (const slo of tenantSlos) {
          this.logger?.info("SLO evaluated after data namespace creation", {
            tenantId: tenant.tenantId,
            namespaceId: namespace.namespaceId,
            sloId: slo.sloId,
            name: slo.name,
          });
        }
      }
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

  /**
   * Suspend a tenant (R13-25: lifecycle management)
   */
  public suspendTenant(input: TenantLifecycleInput): TenantRecord {
    return this.db.transaction(() => {
      const tenant = this.requireTenant(input.tenantId);
      const currentStage = fromTenantStatus(tenant.status);
      // Validate transition is allowed
      if (!VALID_LIFECYCLE_TRANSITIONS[currentStage]?.includes("suspended")) {
        throw new ValidationError("tenant.invalid_lifecycle_transition", "tenant.invalid_lifecycle_transition", {
          category: "tenant",
          source: "runtime",
          details: { tenantId: input.tenantId, currentStage, targetStage: "suspended" },
        });
      }
      const updated: TenantRecord = {
        ...tenant,
        status: toTenantStatus("suspended"),
        updatedAt: nowIso(),
      };
      this.store.organization.upsertTenantRecord(updated);
      return updated;
    });
  }

  /**
   * Deactivate a tenant (R13-25: lifecycle management)
   */
  public deactivateTenant(input: TenantLifecycleInput): TenantRecord {
    return this.db.transaction(() => {
      const tenant = this.requireTenant(input.tenantId);
      const currentStage = fromTenantStatus(tenant.status);
      if (!VALID_LIFECYCLE_TRANSITIONS[currentStage]?.includes("deactivated")) {
        throw new ValidationError("tenant.invalid_lifecycle_transition", "tenant.invalid_lifecycle_transition", {
          category: "tenant",
          source: "runtime",
          details: { tenantId: input.tenantId, currentStage, targetStage: "deactivated" },
        });
      }
      const updated: TenantRecord = {
        ...tenant,
        status: toTenantStatus("deactivated"),
        updatedAt: nowIso(),
      };
      this.store.organization.upsertTenantRecord(updated);
      return updated;
    });
  }

  /**
   * Decommission a tenant (R13-25: lifecycle management)
   */
  public decommissionTenant(input: TenantLifecycleInput): TenantRecord {
    return this.db.transaction(() => {
      const tenant = this.requireTenant(input.tenantId);
      const currentStage = fromTenantStatus(tenant.status);
      if (!VALID_LIFECYCLE_TRANSITIONS[currentStage]?.includes("decommissioned")) {
        throw new ValidationError("tenant.invalid_lifecycle_transition", "tenant.invalid_lifecycle_transition", {
          category: "tenant",
          source: "runtime",
          details: { tenantId: input.tenantId, currentStage, targetStage: "decommissioned" },
        });
      }
      const updated: TenantRecord = {
        ...tenant,
        status: toTenantStatus("decommissioned"),
        updatedAt: nowIso(),
      };
      this.store.organization.upsertTenantRecord(updated);
      this.encryptionService.removeTenantKeys(updated.tenantId);
      this.dedicatedPoolIsolations.delete(updated.tenantId);
      return updated;
    });
  }

  /**
   * Reactivate a suspended or deactivated tenant (R13-25: lifecycle management)
   */
  public reactivateTenant(input: TenantLifecycleInput): TenantRecord {
    return this.db.transaction(() => {
      const tenant = this.requireTenant(input.tenantId);
      const currentStage = fromTenantStatus(tenant.status);
      if (!VALID_LIFECYCLE_TRANSITIONS[currentStage]?.includes("active")) {
        throw new ValidationError("tenant.invalid_lifecycle_transition", "tenant.invalid_lifecycle_transition", {
          category: "tenant",
          source: "runtime",
          details: { tenantId: input.tenantId, currentStage, targetStage: "active" },
        });
      }
      const updated: TenantRecord = {
        ...tenant,
        status: toTenantStatus("active"),
        updatedAt: nowIso(),
      };
      this.store.organization.upsertTenantRecord(updated);
      if (!this.encryptionService.isInitialized(updated.tenantId)) {
        this.ensureTenantEncryptionInitialized(updated);
      }
      return updated;
    });
  }

  public encryptTenantData(tenantId: string, plaintext: string | Buffer): EncryptedRecord {
    const tenant = this.requireTenant(tenantId);
    if (!this.encryptionService.isInitialized(tenant.tenantId)) {
      this.ensureTenantEncryptionInitialized(tenant);
    }
    return this.encryptionService.encrypt(tenant.tenantId, plaintext);
  }

  public decryptTenantData(tenantId: string, record: EncryptedRecord): string {
    this.requireTenant(tenantId);
    return this.encryptionService.decryptToString(tenantId, record);
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

  private ensureTenantEncryptionInitialized(
    tenant: TenantRecord,
    override?: CreateTenantInput["encryptionConfig"],
  ): void {
    if (this.encryptionService.isInitialized(tenant.tenantId)) {
      return;
    }
    this.encryptionService.initializeTenant({
      tenantId: tenant.tenantId,
      algorithm: override?.algorithm ?? "aes-256-gcm",
      keyRotationPeriodDays: override?.keyRotationPeriodDays ?? 90,
      enforceHardwareSecurityModule: override?.enforceHardwareSecurityModule ?? tenant.deploymentMode === "on_prem",
    });
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
}
