/**
 * @fileoverview Workspace Types - Workspace, organization, tenant, and data namespace records.
 *
 * Contains records related to multi-tenancy, workspace organization,
 * and data namespace management.
 *
 * Part of the domain.ts split (see src/core/types/domain/index.ts).
 */

import type {
  TenantIsolationMode,
  DeploymentMode,
  DataNamespacePlane,
  Timestamp,
} from "./primitives.js";

// ---------------------------------------------------------------------------
// Workspace records
// ---------------------------------------------------------------------------

export interface WorkspaceRecord {
  workspaceId: string;
  ownerId: string;
  displayName: string;
  planId: string;
  defaultPolicySet: string;
  organizationId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface WorkspaceMembershipRecord {
  workspaceId: string;
  userId: string;
  role: string;
  joinedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Organization records
// ---------------------------------------------------------------------------

export interface OrganizationRecord {
  organizationId: string;
  displayName: string;
  billingAccountId: string | null;
  defaultTenantId: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface OrganizationMembershipRecord {
  organizationId: string;
  userId: string;
  role: string;
  joinedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Tenant record
// ---------------------------------------------------------------------------

/**
 * Tenant quotas for resource limits.
 */
export interface TenantQuotas {
  /** Monthly token limit for LLM usage */
  monthlyTokenLimit?: number | null;
  /** Monthly cost limit in USD */
  monthlyCostLimitUsd?: number | null;
  /** Maximum concurrent executions */
  maxConcurrentExecutions?: number;
  /** Maximum storage in bytes */
  maxStorageBytes?: number | null;
  /** API rate limit per minute */
  rateLimitPerMinute?: number;
}

/**
 * SLA tier for the tenant.
 */
export type SlaTier = "platinum" | "gold" | "silver" | "bronze";

/**
 * Tenant record - represents an isolated tenant in the multi-tenant platform.
 *
 * Extended with quotas, billing, SLA, and regional settings for
 * comprehensive tenant management per §18 cost management and §37 domain modeling.
 */
export interface TenantRecord {
  tenantId: string;
  organizationId: string;
  displayName?: string;
  storageScope: string;
  identityScope: string;
  policyScope: string;
  artifactScope: string;
  isolationMode: TenantIsolationMode;
  deploymentMode: DeploymentMode;
  /** Resource quotas for the tenant */
  quotas?: TenantQuotas;
  /** Billing plan identifier */
  billingPlan?: string;
  /** SLA tier */
  slaLevel?: SlaTier;
  /** Allowed deployment regions */
  allowedRegions?: readonly string[];
  /** Tenant status */
  status?: "active" | "suspended" | "terminated";
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Deployment binding record
// ---------------------------------------------------------------------------

export interface DeploymentBindingRecord {
  bindingId: string;
  tenantId: string;
  environmentId: string;
  deploymentMode: DeploymentMode;
  region: string;
  networkBoundary: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Data namespace record
// ---------------------------------------------------------------------------

export interface DataNamespaceRecord {
  namespaceId: string;
  plane: DataNamespacePlane;
  tenantId: string | null;
  organizationId: string | null;
  workspaceId: string | null;
  retentionPolicy: string;
  encryptionPolicy: string;
  residencyPolicy: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
