/**
 * Capability Delegation
 * Capability granting and revocation for federation
 */

import { randomUUID } from "crypto";

// Types
export interface Capability {
  id: string;
  name: string;
  description: string;
  category: CapabilityCategory;
  permissions: CapabilityPermission[];
  constraints: CapabilityConstraintDefinition[];
  version: string;
  deprecated: boolean;
}

export type CapabilityCategory =
  | "execution"
  | "monitoring"
  | "configuration"
  | "data"
  | "audit"
  | "admin";

export type CapabilityPermission = "invoke" | "configure" | "delegate" | "audit" | "revoke";

export interface CapabilityConstraintDefinition {
  type: CapabilityConstraintType;
  name: string;
  description: string;
  defaultValue?: unknown;
  required: boolean;
}

export type CapabilityConstraintType =
  | "rate_limit"
  | "quota"
  | "geography"
  | "time_window"
  | "ip_whitelist"
  | "custom";

export interface CapabilityGrant {
  id: string;
  capabilityId: string;
  capabilityName: string;
  delegatingOrgId: string;
  delegatedOrgId: string;
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
  permissions: CapabilityPermission[];
  constraints: AppliedConstraint[];
  status: GrantStatus;
  version: string;
  metadata?: Record<string, unknown>;
}

export interface AppliedConstraint {
  type: CapabilityConstraintType;
  name: string;
  value: unknown;
  description?: string;
}

export type GrantStatus = "active" | "suspended" | "revoked" | "expired";

export interface DelegationRequest {
  id: string;
  capabilityId: string;
  delegatingOrgId: string;
  delegatedOrgId: string;
  requestedPermissions: CapabilityPermission[];
  requestedConstraints: RequestedConstraint[];
  reason?: string;
  requestedBy: string;
  requestedAt: Date;
  expiresAt?: Date;
  status: RequestStatus;
}

export interface RequestedConstraint {
  type: CapabilityConstraintType;
  value: unknown;
}

export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface DelegationAuditEntry {
  id: string;
  grantId?: string;
  requestId?: string;
  action: DelegationAction;
  orgId: string;
  targetOrgId?: string;
  capabilityId: string;
  actor: string;
  timestamp: Date;
  details: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
}

export type DelegationAction =
  | "capability.registered"
  | "capability.deprecated"
  | "grant.requested"
  | "grant.approved"
  | "grant.rejected"
  | "grant.suspended"
  | "grant.revoked"
  | "grant.renewed"
  | "access.invoked"
  | "access.denied";

export interface DelegationQuota {
  orgId: string;
  capabilityId: string;
  used: number;
  limit: number;
  windowStart: Date;
  windowType: "hourly" | "daily" | "monthly" | "unlimited";
}

export interface AccessDecision {
  allowed: boolean;
  reason: string;
  grantId?: string;
  constraints?: AppliedConstraint[];
  quotaInfo?: {
    used: number;
    remaining: number;
    resetAt?: Date;
  };
}

/**
 * CapabilityDelegation manages capability granting, revocation,
 * and access control for federated organizations.
 */
export class CapabilityDelegation {
  private readonly capabilities: Map<string, Capability> = new Map();
  private readonly grants: Map<string, CapabilityGrant> = new Map();
  private readonly requests: Map<string, DelegationRequest> = new Map();
  private readonly auditLog: DelegationAuditEntry[] = [];
  private readonly quotas: Map<string, DelegationQuota> = new Map();
  private readonly indexByOrg: Map<string, Set<string>> = new Map();
  private readonly indexByCapability: Map<string, Set<string>> = new Map();

  constructor(capabilities: Capability[] = []) {
    for (const cap of capabilities) {
      this.capabilities.set(cap.id, cap);
    }
  }

  // Capability Management
  registerCapability(capability: Omit<Capability, "id">): Capability {
    const fullCapability: Capability = {
      ...capability,
      id: randomUUID(),
    };
    this.capabilities.set(fullCapability.id, fullCapability);

    this.recordAudit({
      id: randomUUID(),
      action: "capability.registered",
      orgId: "system",
      capabilityId: fullCapability.id,
      actor: "system",
      timestamp: new Date(),
      details: { name: fullCapability.name, category: fullCapability.category },
      success: true,
    });

    return fullCapability;
  }

  getCapability(id: string): Capability | undefined {
    return this.capabilities.get(id);
  }

  getCapabilitiesByCategory(category: CapabilityCategory): Capability[] {
    return Array.from(this.capabilities.values()).filter(
      (cap) => cap.category === category && !cap.deprecated
    );
  }

  deprecateCapability(id: string): void {
    const capability = this.capabilities.get(id);
    if (!capability) {
      throw new Error(`Capability not found: ${id}`);
    }
    capability.deprecated = true;

    this.recordAudit({
      id: randomUUID(),
      action: "capability.deprecated",
      orgId: "system",
      capabilityId: id,
      actor: "system",
      timestamp: new Date(),
      details: { name: capability.name },
      success: true,
    });
  }

  // Grant Management
  async createGrant(params: {
    capabilityId: string;
    delegatingOrgId: string;
    delegatedOrgId: string;
    grantedBy: string;
    permissions: CapabilityPermission[];
    constraints?: AppliedConstraint[];
    expiresAt?: Date;
    metadata?: Record<string, unknown>;
  }): Promise<CapabilityGrant> {
    const capability = this.capabilities.get(params.capabilityId);
    if (!capability) {
      throw new Error(`Capability not found: ${params.capabilityId}`);
    }
    if (capability.deprecated) {
      throw new Error(`Capability is deprecated: ${params.capabilityId}`);
    }

    // Validate permissions are allowed by capability
    const allowedPermissions = capability.permissions;
    for (const perm of params.permissions) {
      if (!allowedPermissions.includes(perm)) {
        throw new Error(`Permission ${perm} not allowed for capability ${params.capabilityId}`);
      }
    }

    // Apply default constraints from capability definition
    const finalConstraints = this.applyDefaultConstraints(
      capability,
      params.constraints ?? []
    );

    const grant: CapabilityGrant = {
      id: randomUUID(),
      capabilityId: params.capabilityId,
      capabilityName: capability.name,
      delegatingOrgId: params.delegatingOrgId,
      delegatedOrgId: params.delegatedOrgId,
      grantedBy: params.grantedBy,
      grantedAt: new Date(),
      permissions: params.permissions,
      constraints: finalConstraints,
      status: "active",
      version: capability.version,
      ...(params.expiresAt !== undefined && { expiresAt: params.expiresAt }),
      ...(params.metadata !== undefined && { metadata: params.metadata }),
    };

    this.grants.set(grant.id, grant);
    this.indexGrant(grant);

    this.recordAudit({
      id: randomUUID(),
      grantId: grant.id,
      action: "grant.approved",
      orgId: params.delegatingOrgId,
      targetOrgId: params.delegatedOrgId,
      capabilityId: params.capabilityId,
      actor: params.grantedBy,
      timestamp: new Date(),
      details: { permissions: params.permissions },
      success: true,
    });

    return grant;
  }

  getGrant(id: string): CapabilityGrant | undefined {
    return this.grants.get(id);
  }

  getGrantsForOrg(orgId: string): CapabilityGrant[] {
    const grantIds = this.indexByOrg.get(orgId);
    if (!grantIds) return [];

    return Array.from(grantIds)
      .map((id) => this.grants.get(id))
      .filter((g): g is CapabilityGrant => g !== undefined && g.status === "active");
  }

  getGrantsForCapability(capabilityId: string): CapabilityGrant[] {
    const grantIds = this.indexByCapability.get(capabilityId);
    if (!grantIds) return [];

    return Array.from(grantIds)
      .map((id) => this.grants.get(id))
      .filter((g): g is CapabilityGrant => g !== undefined && g.status === "active");
  }

  getActiveGrantsForOrg(orgId: string, capabilityId: string): CapabilityGrant[] {
    return (this.getGrantsForOrg(orgId) as CapabilityGrant[]).filter(
      (grant) => grant.capabilityId === capabilityId && grant.status === "active"
    );
  }

  async suspendGrant(id: string, reason: string, actor: string): Promise<void> {
    const grant = this.grants.get(id);
    if (!grant) {
      throw new Error(`Grant not found: ${id}`);
    }

    grant.status = "suspended";

    this.recordAudit({
      id: randomUUID(),
      grantId: id,
      action: "grant.suspended",
      orgId: grant.delegatingOrgId,
      targetOrgId: grant.delegatedOrgId,
      capabilityId: grant.capabilityId,
      actor,
      timestamp: new Date(),
      details: { reason },
      success: true,
    });
  }

  async revokeGrant(id: string, reason: string, actor: string): Promise<void> {
    const grant = this.grants.get(id);
    if (!grant) {
      throw new Error(`Grant not found: ${id}`);
    }

    grant.status = "revoked";

    this.recordAudit({
      id: randomUUID(),
      grantId: id,
      action: "grant.revoked",
      orgId: grant.delegatingOrgId,
      targetOrgId: grant.delegatedOrgId,
      capabilityId: grant.capabilityId,
      actor,
      timestamp: new Date(),
      details: { reason },
      success: true,
    });
  }

  async renewGrant(id: string, newExpiry: Date, actor: string): Promise<CapabilityGrant> {
    const grant = this.grants.get(id);
    if (!grant) {
      throw new Error(`Grant not found: ${id}`);
    }

    grant.expiresAt = newExpiry;

    this.recordAudit({
      id: randomUUID(),
      grantId: id,
      action: "grant.renewed",
      orgId: grant.delegatingOrgId,
      targetOrgId: grant.delegatedOrgId,
      capabilityId: grant.capabilityId,
      actor,
      timestamp: new Date(),
      details: { newExpiry: newExpiry.toISOString() },
      success: true,
    });

    return grant;
  }

  // Delegation Requests
  createDelegationRequest(params: {
    capabilityId: string;
    delegatingOrgId: string;
    delegatedOrgId: string;
    requestedPermissions: CapabilityPermission[];
    requestedConstraints?: RequestedConstraint[];
    reason?: string;
    requestedBy: string;
    expiresAt?: Date;
  }): DelegationRequest {
    const request: DelegationRequest = {
      ...params,
      id: randomUUID(),
      requestedAt: new Date(),
      requestedConstraints: params.requestedConstraints ?? [],
      status: "pending",
    };

    this.requests.set(request.id, request);

    this.recordAudit({
      id: randomUUID(),
      requestId: request.id,
      action: "grant.requested",
      orgId: params.delegatingOrgId,
      targetOrgId: params.delegatedOrgId,
      capabilityId: params.capabilityId,
      actor: params.requestedBy,
      timestamp: new Date(),
      details: {
        requestedPermissions: params.requestedPermissions,
        reason: params.reason,
      },
      success: true,
    });

    return request;
  }

  getDelegationRequest(id: string): DelegationRequest | undefined {
    return this.requests.get(id);
  }

  getPendingRequestsForOrg(orgId: string): DelegationRequest[] {
    return Array.from(this.requests.values()).filter(
      (req) => req.delegatingOrgId === orgId && req.status === "pending"
    );
  }

  async approveRequest(requestId: string, approver: string): Promise<CapabilityGrant> {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Delegation request not found: ${requestId}`);
    }
    if (request.status !== "pending") {
      throw new Error(`Request is not pending: ${request.status}`);
    }

    request.status = "approved";

    const createGrantParams: {
      capabilityId: string;
      delegatingOrgId: string;
      delegatedOrgId: string;
      grantedBy: string;
      permissions: CapabilityPermission[];
      constraints?: AppliedConstraint[];
      expiresAt?: Date;
      metadata?: Record<string, unknown>;
    } = {
      capabilityId: request.capabilityId,
      delegatingOrgId: request.delegatingOrgId,
      delegatedOrgId: request.delegatedOrgId,
      grantedBy: approver,
      permissions: request.requestedPermissions,
    };
    if (request.expiresAt !== undefined) {
      createGrantParams.expiresAt = request.expiresAt;
    }

    return this.createGrant(createGrantParams);
  }

  rejectRequest(requestId: string, rejectedBy: string, reason: string): void {
    const request = this.requests.get(requestId);
    if (!request) {
      throw new Error(`Delegation request not found: ${requestId}`);
    }

    request.status = "rejected";

    this.recordAudit({
      id: randomUUID(),
      requestId: requestId,
      action: "grant.rejected",
      orgId: request.delegatingOrgId,
      targetOrgId: request.delegatedOrgId,
      capabilityId: request.capabilityId,
      actor: rejectedBy,
      timestamp: new Date(),
      details: { reason },
      success: false,
      errorMessage: reason,
    });
  }

  // Access Control
  async checkAccess(params: {
    orgId: string;
    capabilityId: string;
    permission: CapabilityPermission;
  }): Promise<AccessDecision> {
    const grants = this.getActiveGrantsForOrg(params.orgId, params.capabilityId);

    if (grants.length === 0) {
      return {
        allowed: false,
        reason: `No active grants for capability ${params.capabilityId}`,
      };
    }

    // Find a grant that allows the requested permission
    for (const grant of grants) {
      if (!grant.permissions.includes(params.permission)) {
        continue;
      }

      // Quotas belong to the delegating org that owns the granted capability.
      const quotaCheck = this.checkQuota(grant.delegatingOrgId, params.capabilityId);
      if (!quotaCheck.allowed) {
        return quotaCheck;
      }

      return {
        allowed: true,
        reason: `Access granted via ${grant.id}`,
        grantId: grant.id,
        constraints: grant.constraints,
        ...(quotaCheck.quotaInfo !== undefined && { quotaInfo: quotaCheck.quotaInfo }),
      };
    }

    return {
      allowed: false,
      reason: `No grant allows ${params.permission} permission for ${params.capabilityId}`,
    };
  }

  recordAccess(params: {
    orgId: string;
    capabilityId: string;
    permission: CapabilityPermission;
    granted: boolean;
    latencyMs?: number;
  }): void {
    const action = params.granted ? "access.invoked" : "access.denied";

    const auditEntry: {
      id: string;
      action: DelegationAction;
      orgId: string;
      capabilityId: string;
      actor: string;
      timestamp: Date;
      details: Record<string, unknown>;
      success: boolean;
      errorMessage?: string;
    } = {
      id: randomUUID(),
      action,
      orgId: params.orgId,
      capabilityId: params.capabilityId,
      actor: params.orgId,
      timestamp: new Date(),
      details: {
        permission: params.permission,
        ...(params.latencyMs !== undefined && { latencyMs: params.latencyMs }),
      },
      success: params.granted,
    };
    if (!params.granted) {
      auditEntry.errorMessage = "Access denied";
    }

    this.recordAudit(auditEntry);

    // Update quota if access was granted
    if (params.granted) {
      const grant = this.findGrantForAccess(params.orgId, params.capabilityId, params.permission);
      this.incrementQuota(grant?.delegatingOrgId ?? params.orgId, params.capabilityId);
    }
  }

  // Quota Management
  setQuota(params: {
    orgId: string;
    capabilityId: string;
    limit: number;
    windowType: "hourly" | "daily" | "monthly" | "unlimited";
  }): void {
    const key = this.quotaKey(params.orgId, params.capabilityId);
    this.quotas.set(key, {
      orgId: params.orgId,
      capabilityId: params.capabilityId,
      used: 0,
      limit: params.limit,
      windowStart: new Date(),
      windowType: params.windowType,
    });
  }

  getQuota(orgId: string, capabilityId: string): DelegationQuota | undefined {
    return this.quotas.get(this.quotaKey(orgId, capabilityId));
  }

  private checkQuota(orgId: string, capabilityId: string): AccessDecision {
    const quota = this.quotas.get(this.quotaKey(orgId, capabilityId));
    if (!quota || quota.windowType === "unlimited") {
      return { allowed: true, reason: "No quota restrictions" };
    }

    // Check if window has reset
    const now = new Date();
    const windowMs = this.getWindowMs(quota.windowType);
    const elapsed = now.getTime() - quota.windowStart.getTime();

    if (elapsed >= windowMs) {
      // Reset quota
      quota.used = 0;
      quota.windowStart = now;
    }

    if (quota.used >= quota.limit) {
      return {
        allowed: false,
        reason: `Quota exceeded for ${capabilityId}`,
        quotaInfo: {
          used: quota.used,
          remaining: 0,
          resetAt: new Date(quota.windowStart.getTime() + windowMs),
        },
      };
    }

    return {
      allowed: true,
      reason: "Within quota limits",
      quotaInfo: {
        used: quota.used,
        remaining: quota.limit - quota.used,
        resetAt: new Date(quota.windowStart.getTime() + windowMs),
      },
    };
  }

  private incrementQuota(orgId: string, capabilityId: string): void {
    const quota = this.quotas.get(this.quotaKey(orgId, capabilityId));
    if (quota) {
      quota.used++;
    }
  }

  private findGrantForAccess(
    delegatedOrgId: string,
    capabilityId: string,
    permission: CapabilityPermission,
  ): CapabilityGrant | undefined {
    return this.getActiveGrantsForOrg(delegatedOrgId, capabilityId).find(
      (grant) => grant.permissions.includes(permission),
    );
  }

  private quotaKey(orgId: string, capabilityId: string): string {
    return `${orgId}:${capabilityId}`;
  }

  private getWindowMs(windowType: "hourly" | "daily" | "monthly"): number {
    switch (windowType) {
      case "hourly":
        return 60 * 60 * 1000;
      case "daily":
        return 24 * 60 * 60 * 1000;
      case "monthly":
        return 30 * 24 * 60 * 60 * 1000;
    }
  }

  // Audit
  private recordAudit(entry: DelegationAuditEntry): void {
    this.auditLog.push(entry);
  }

  getAuditLog(params?: {
    orgId?: string;
    capabilityId?: string;
    limit?: number;
  }): DelegationAuditEntry[] {
    let entries = [...this.auditLog];

    if (params?.orgId) {
      entries = entries.filter((e) => e.orgId === params.orgId);
    }
    if (params?.capabilityId) {
      entries = entries.filter((e) => e.capabilityId === params.capabilityId);
    }

    entries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (params?.limit) {
      entries = entries.slice(0, params.limit);
    }

    return entries;
  }

  // Helper Methods
  private applyDefaultConstraints(
    capability: Capability,
    overrides: AppliedConstraint[]
  ): AppliedConstraint[] {
    const result: AppliedConstraint[] = [...overrides];
    const overrideByType = new Map(overrides.map((override) => [override.type, override]));

    for (const def of capability.constraints) {
      if (def.required && !overrideByType.has(def.type)) {
        result.push({
          type: def.type,
          name: def.name,
          value: def.defaultValue,
          description: def.description,
        });
      }
    }

    return result;
  }

  private indexGrant(grant: CapabilityGrant): void {
    // Index by delegating org
    this.getOrCreateGrantIndex(this.indexByOrg, grant.delegatingOrgId).add(grant.id);

    // Index by delegated org
    this.getOrCreateGrantIndex(this.indexByOrg, grant.delegatedOrgId).add(grant.id);

    // Index by capability
    this.getOrCreateGrantIndex(this.indexByCapability, grant.capabilityId).add(grant.id);
  }

  private getOrCreateGrantIndex(index: Map<string, Set<string>>, key: string): Set<string> {
    const existing = index.get(key);
    if (existing) {
      return existing;
    }
    const created = new Set<string>();
    index.set(key, created);
    return created;
  }
}

export function createCapabilityDelegation(capabilities?: Capability[]): CapabilityDelegation {
  return new CapabilityDelegation(capabilities);
}
