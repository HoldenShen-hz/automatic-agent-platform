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

export interface TenantRecord {
  tenantId: string;
  organizationId: string;
  storageScope: string;
  identityScope: string;
  policyScope: string;
  artifactScope: string;
  isolationMode: TenantIsolationMode;
  deploymentMode: DeploymentMode;
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
