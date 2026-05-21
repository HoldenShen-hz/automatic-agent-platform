/**
 * Federation Gateway
 * Cross-org trust and capability delegation
 */

import { randomUUID } from "crypto";
import { TrustLevel } from "./trust-level.js";
import { AppError, ValidationError } from "../../platform/contracts/errors.js";
import { LocalTypedEventEmitter } from "../../platform/shared/events/local-typed-event-emitter.js";

export { TrustLevel } from "./trust-level.js";

// Types
export interface FederationOrg {
  id: string;
  name: string;
  domain: string;
  tier: "standard" | "enterprise" | "strategic";
  capabilities: Set<string>;
  enabled: boolean;
}

export interface TrustRelationship {
  id: string;
  sourceOrgId: string;
  targetOrgId: string;
  level: TrustLevel;
  capabilities: string[];
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface CapabilityGrant {
  id: string;
  orgId: string;
  targetOrgId: string;
  capability: string;
  permissions: CapabilityPermission[];
  constraints: CapabilityConstraint[];
  grantedAt: Date;
  expiresAt?: Date;
  status: "active" | "suspended" | "revoked";
}

export type CapabilityPermission = "invoke" | "configure" | "delegate" | "audit";

export interface CapabilityConstraint {
  type: "rate_limit" | "quota" | "geography" | "custom";
  value: unknown;
  description?: string;
}

export interface DelegationRequest {
  id: string;
  sourceOrgId: string;
  targetOrgId: string;
  capabilities: string[];
  requestedPermissions: CapabilityPermission[];
  constraints: CapabilityConstraint[];
  reason?: string;
  requestedBy: string;
  requestedAt: Date;
  expiresAt?: Date;
}

export interface DelegationResult {
  success: boolean;
  grant?: CapabilityGrant;
  error?: string;
  errorCode?: string;
}

export interface FederationEvent {
  type: string;
  sourceOrgId: string;
  targetOrgId?: string;
  timestamp: Date;
  actor?: string;
  data: Record<string, unknown>;
}

/**
 * Federation region priority for multi-region routing and failover.
 * Higher priority values indicate preferred regions for routing.
 */
export interface FederationRegionPriority {
  readonly regionId: string;
  readonly federationId: string;
  readonly priority: number;
  readonly isPreferred: boolean;
  readonly failoverWeight: number;
}

/**
 * Result of comparing two federation topologies for reconciliation.
 */
export interface FederationTopologyDiff {
  readonly addedRegions: readonly string[];
  readonly removedRegions: readonly string[];
  readonly modifiedRegions: readonly { regionId: string; changes: readonly string[] }[];
  readonly unchangedRegions: readonly string[];
  readonly diffTimestamp: string;
}

/**
 * Region descriptor for federation topology.
 */
export interface FederationTopologyRegion {
  readonly regionId: string;
  readonly endpoint: string;
  readonly priority: number;
  readonly status: "active" | "standby" | "draining";
  readonly metadata?: Record<string, unknown>;
}

/**
 * Federation topology representing all regions in a federation.
 */
export interface FederationTopology {
  readonly federationId: string;
  readonly regions: readonly FederationTopologyRegion[];
  readonly version: string;
  readonly lastUpdated: string;
}

/**
 * Compares two federation topologies and returns the differences.
 * Used for reconciliation when topologies diverge across regions.
 */
export function computeFederationTopologyDiff(
  left: FederationTopology,
  right: FederationTopology,
): FederationTopologyDiff {
  const leftRegionIds = new Set(left.regions.map((r) => r.regionId));
  const rightRegionIds = new Set(right.regions.map((r) => r.regionId));

  const addedRegions: string[] = [];
  const removedRegions: string[] = [];
  const modifiedRegions: { regionId: string; changes: string[] }[] = [];
  const unchangedRegions: string[] = [];

  // Find added and unchanged regions
  for (const regionId of rightRegionIds) {
    if (!leftRegionIds.has(regionId)) {
      addedRegions.push(regionId);
    }
  }

  // Find removed regions
  for (const regionId of leftRegionIds) {
    if (!rightRegionIds.has(regionId)) {
      removedRegions.push(regionId);
    }
  }

  // Find modified and unchanged regions
  const rightRegionMap = new Map(right.regions.map((r) => [r.regionId, r]));
  for (const leftRegion of left.regions) {
    const rightRegion = rightRegionMap.get(leftRegion.regionId);
    if (!rightRegion) continue; // Already handled as removed

    if (leftRegionIds.has(leftRegion.regionId) && rightRegionIds.has(leftRegion.regionId)) {
      const changes: string[] = [];

      if (leftRegion.endpoint !== rightRegion.endpoint) {
        changes.push(`endpoint: ${leftRegion.endpoint} -> ${rightRegion.endpoint}`);
      }
      if (leftRegion.priority !== rightRegion.priority) {
        changes.push(`priority: ${leftRegion.priority} -> ${rightRegion.priority}`);
      }
      if (leftRegion.status !== rightRegion.status) {
        changes.push(`status: ${leftRegion.status} -> ${rightRegion.status}`);
      }

      if (changes.length > 0) {
        modifiedRegions.push({ regionId: leftRegion.regionId, changes });
      } else {
        unchangedRegions.push(leftRegion.regionId);
      }
    }
  }

  return {
    addedRegions,
    removedRegions,
    modifiedRegions,
    unchangedRegions,
    diffTimestamp: new Date().toISOString(),
  };
}

/**
 * Federation catalog entry describing a single federation.
 */
export interface FederationCatalogEntry {
  readonly federationId: string;
  readonly name: string;
  readonly description: string;
  readonly regionCount: number;
  readonly orgCount: number;
  readonly trustLevel: TrustLevel;
  readonly capabilities: readonly string[];
  readonly status: "active" | "inactive" | "suspended";
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Federation catalog containing all federations.
 */
export interface FederationCatalog {
  readonly catalogId: string;
  readonly entries: readonly FederationCatalogEntry[];
  readonly totalCount: number;
  readonly generatedAt: string;
}

/**
 * Builds a catalog of all federations in the gateway.
 */
export function buildFederationCatalog(
  gateway: FederationGateway,
  options?: { status?: FederationCatalogEntry["status"] },
): FederationCatalog {
  const entries: FederationCatalogEntry[] = [];
  const snapshot = gateway.snapshotCatalogState();

  // Get all organizations registered in the gateway
  const orgs = snapshot.organizations;

  for (const org of orgs) {
    if (options?.status && org.enabled !== (options.status === "active")) {
      continue;
    }

    // Get trust relationships for this org
    const trusts = snapshot.trustRelationships
      .filter((t) => t.sourceOrgId === org.id || t.targetOrgId === org.id);

    const firstTrust = trusts[0];
    const entry: FederationCatalogEntry = {
      federationId: snapshot.federationId,
      name: org.name,
      description: `Federation for ${org.domain}`,
      regionCount: 1, // Placeholder - would be derived from region tracking
      orgCount: orgs.length,
      trustLevel: firstTrust !== undefined ? firstTrust.level : TrustLevel.NONE,
      capabilities: Array.from(org.capabilities),
      status: org.enabled ? "active" : "inactive",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    entries.push(entry);
  }

  return {
    catalogId: `federation-catalog-${Date.now()}`,
    entries,
    totalCount: entries.length,
    generatedAt: new Date().toISOString(),
  };
}

// Gateway configuration
export interface FederationGatewayConfig {
  /** Unique identifier for this federation */
  federationId: string;
  enableAudit: boolean;
  maxDelegationDepth: number;
  requireApproval: boolean;
  autoExpiryDays?: number;
}

const DEFAULT_CONFIG: FederationGatewayConfig = {
  federationId: "default-federation",
  enableAudit: true,
  maxDelegationDepth: 3,
  requireApproval: true,
  autoExpiryDays: 365,
};

/**
 * FederationGateway manages cross-organization trust relationships
 * and capability delegation for the federation mesh.
 */
export class FederationGateway extends LocalTypedEventEmitter<Record<string, unknown>> {
  private readonly config: FederationGatewayConfig;
  private readonly organizations: Map<string, FederationOrg> = new Map();
  private readonly trustRelationships: Map<string, TrustRelationship> = new Map();
  private readonly capabilityGrants: Map<string, CapabilityGrant> = new Map();
  private readonly pendingRequests: Map<string, DelegationRequest> = new Map();
  private readonly auditLog: FederationEvent[] = [];

  constructor(config: Partial<FederationGatewayConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Organization Management
  async registerOrganization(org: Omit<FederationOrg, "capabilities" | "enabled">): Promise<FederationOrg> {
    const federationOrg: FederationOrg = {
      ...org,
      capabilities: new Set<string>(),
      enabled: true,
    };
    this.organizations.set(org.id, federationOrg);
    this.emitAudit({
      type: "org.registered",
      sourceOrgId: org.id,
      timestamp: new Date(),
      data: { orgId: org.id, name: org.name, domain: org.domain },
    });
    return federationOrg;
  }

  async getOrganization(orgId: string): Promise<FederationOrg | undefined> {
    return this.organizations.get(orgId);
  }

  snapshotCatalogState(): {
    readonly federationId: string;
    readonly organizations: readonly FederationOrg[];
    readonly trustRelationships: readonly TrustRelationship[];
  } {
    return {
      federationId: this.config.federationId,
      organizations: Array.from(this.organizations.values()),
      trustRelationships: Array.from(this.trustRelationships.values()),
    };
  }

  async updateOrganizationCapabilities(orgId: string, capabilities: string[]): Promise<void> {
    const org = this.organizations.get(orgId);
    if (!org) {
      throw new Error(`Organization not found: ${orgId}`);
    }
    org.capabilities = new Set(capabilities);
    this.emitAudit({
      type: "org.capabilities_updated",
      sourceOrgId: orgId,
      timestamp: new Date(),
      data: { orgId, capabilities },
    });
  }

  async enableOrganization(orgId: string, enabled: boolean): Promise<void> {
    const org = this.organizations.get(orgId);
    if (!org) {
      throw new Error(`Organization not found: ${orgId}`);
    }
    org.enabled = enabled;
    this.emitAudit({
      type: "org.status_changed",
      sourceOrgId: orgId,
      timestamp: new Date(),
      data: { orgId, enabled },
    });
  }

  // Trust Relationship Management
  async establishTrust(request: {
    sourceOrgId: string;
    targetOrgId: string;
    level: TrustLevel;
    capabilities: string[];
    grantedBy: string;
    expiresAt?: Date;
    metadata?: Record<string, unknown>;
  }): Promise<TrustRelationship> {
    const sourceOrg = this.organizations.get(request.sourceOrgId);
    const targetOrg = this.organizations.get(request.targetOrgId);
    if (!sourceOrg || !targetOrg) {
      throw new ValidationError("federation_gateway.organization_not_found", "Source or target organization not found");
    }
    if (!sourceOrg.enabled || !targetOrg.enabled) {
      throw new ValidationError(
        "federation_gateway.organization_disabled",
        "Cannot establish trust with disabled organization",
      );
    }

    // Validate trust level hierarchy
    if (!this.isValidTrustLevel(request.level, sourceOrg, request.capabilities)) {
      throw new ValidationError(
        "federation_gateway.invalid_trust_level",
        "Invalid trust level for organization capabilities",
      );
    }

    const trustRelationship: TrustRelationship = {
      id: randomUUID(),
      sourceOrgId: request.sourceOrgId,
      targetOrgId: request.targetOrgId,
      level: request.level,
      capabilities: request.capabilities,
      grantedBy: request.grantedBy,
      grantedAt: new Date(),
      ...(request.expiresAt !== undefined && { expiresAt: request.expiresAt }),
      ...(request.metadata !== undefined && { metadata: request.metadata }),
    };

    this.trustRelationships.set(trustRelationship.id, trustRelationship);
    this.emitAudit({
      type: "trust.established",
      sourceOrgId: request.sourceOrgId,
      targetOrgId: request.targetOrgId,
      timestamp: new Date(),
      actor: request.grantedBy,
      data: {
        trustId: trustRelationship.id,
        level: request.level,
        capabilities: request.capabilities,
      },
    });

    return trustRelationship;
  }

  async getTrustRelationship(trustId: string): Promise<TrustRelationship | undefined> {
    return this.trustRelationships.get(trustId);
  }

  async getTrustsForOrg(orgId: string): Promise<TrustRelationship[]> {
    return Array.from(this.trustRelationships.values()).filter(
      (trust) => trust.sourceOrgId === orgId || trust.targetOrgId === orgId
    );
  }

  async revokeTrust(trustId: string, revokedBy: string): Promise<void> {
    const trust = this.trustRelationships.get(trustId);
    if (!trust) {
      throw new AppError("federation_gateway.trust_not_found", `Trust relationship not found: ${trustId}`, {
        statusCode: 404,
        category: "business-rule",
        source: "policy",
        details: { trustId },
      });
    }
    if (trust.expiresAt && trust.expiresAt < new Date()) {
      throw new ValidationError("federation_gateway.trust_expired", "Trust relationship already expired");
    }

    // Set expiry to now to effectively revoke
    trust.expiresAt = new Date();
    this.emitAudit({
      type: "trust.revoked",
      sourceOrgId: trust.sourceOrgId,
      targetOrgId: trust.targetOrgId,
      timestamp: new Date(),
      actor: revokedBy,
      data: { trustId, originalExpiry: trust.expiresAt },
    });
  }

  // Capability Delegation
  async requestDelegation(request: Omit<DelegationRequest, "id" | "requestedAt">): Promise<DelegationResult> {
    const sourceOrg = this.organizations.get(request.sourceOrgId);
    const targetOrg = this.organizations.get(request.targetOrgId);
    if (!sourceOrg || !targetOrg) {
      return { success: false, error: "Organization not found", errorCode: "ORG_NOT_FOUND" };
    }

    // Check if there's an existing trust relationship
    const existingTrust = this.findExistingTrust(request.sourceOrgId, request.targetOrgId);
    if (!existingTrust) {
      return { success: false, error: "No trust relationship exists", errorCode: "NO_TRUST" };
    }

    // Verify requested capabilities are covered by trust
    const allowedCapabilities = existingTrust.capabilities;
    const requestedAllowed = request.capabilities.every((cap) => allowedCapabilities.includes(cap));
    if (!requestedAllowed) {
      return { success: false, error: "Requested capabilities not in trust", errorCode: "CAP_NOT_IN_TRUST" };
    }

    const delegationRequest: DelegationRequest = {
      ...request,
      id: randomUUID(),
      requestedAt: new Date(),
    };

    if (this.config.requireApproval) {
      this.pendingRequests.set(delegationRequest.id, delegationRequest);
      return { success: true, error: "Request pending approval", errorCode: "PENDING_APPROVAL" };
    }

    return this.createCapabilityGrant(delegationRequest);
  }

  async approveDelegation(requestId: string, approverId: string): Promise<DelegationResult> {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      return { success: false, error: "Delegation request not found", errorCode: "REQUEST_NOT_FOUND" };
    }

    this.pendingRequests.delete(requestId);
    return this.createCapabilityGrant(request, approverId);
  }

  async createCapabilityGrant(
    request: DelegationRequest,
    approverId?: string
  ): Promise<DelegationResult> {
    const sourceOrg = this.organizations.get(request.sourceOrgId);
    const targetOrg = this.organizations.get(request.targetOrgId);
    if (!sourceOrg || !targetOrg) {
      return { success: false, error: "Organization not found", errorCode: "ORG_NOT_FOUND" };
    }

    // Check delegation depth
    const currentDepth = await this.getDelegationDepth(request.targetOrgId, request.sourceOrgId);
    if (currentDepth >= this.config.maxDelegationDepth) {
      return { success: false, error: "Maximum delegation depth exceeded", errorCode: "DEPTH_EXCEEDED" };
    }

    const capability = request.capabilities[0];
    if (!capability) {
      return { success: false, error: "No capabilities requested", errorCode: "NO_CAPABILITY" };
    }

    const grant: CapabilityGrant = {
      id: randomUUID(),
      orgId: request.sourceOrgId,
      targetOrgId: request.targetOrgId,
      capability: capability,
      permissions: request.requestedPermissions,
      constraints: request.constraints,
      grantedAt: new Date(),
      ...(request.expiresAt !== undefined && { expiresAt: request.expiresAt }),
      status: "active",
    };

    this.capabilityGrants.set(grant.id, grant);
    this.emitAudit({
      type: "capability.granted",
      sourceOrgId: request.sourceOrgId,
      targetOrgId: request.targetOrgId,
      timestamp: new Date(),
      actor: approverId ?? "system",
      data: {
        grantId: grant.id,
        capability: grant.capability,
        permissions: grant.permissions,
      },
    });

    return { success: true, grant };
  }

  async revokeCapabilityGrant(grantId: string, revokedBy: string): Promise<void> {
    const grant = this.capabilityGrants.get(grantId);
    if (!grant) {
      throw new Error(`Capability grant not found: ${grantId}`);
    }
    grant.status = "revoked";
    this.emitAudit({
      type: "capability.revoked",
      sourceOrgId: grant.orgId,
      targetOrgId: grant.targetOrgId,
      timestamp: new Date(),
      actor: revokedBy,
      data: { grantId },
    });
  }

  async getCapabilityGrantsForOrg(orgId: string): Promise<CapabilityGrant[]> {
    return Array.from(this.capabilityGrants.values()).filter(
      (grant) => grant.orgId === orgId || grant.targetOrgId === orgId
    );
  }

  async checkCapabilityAccess(
    orgId: string,
    targetOrgId: string,
    capability: string,
    permission: CapabilityPermission
  ): Promise<boolean> {
    const grant = this.findActiveGrant(orgId, targetOrgId, capability);
    if (!grant) {
      return false;
    }
    return grant.permissions.includes(permission);
  }

  // Audit
  private emitAudit(event: FederationEvent): void {
    if (this.config.enableAudit) {
      this.auditLog.push(event);
    }
    this.emit("federation:event", event);
  }

  getAuditLog(orgId?: string, limit?: number): FederationEvent[] {
    let events = orgId
      ? this.auditLog.filter((e) => e.sourceOrgId === orgId || e.targetOrgId === orgId)
      : [...this.auditLog];
    if (limit) {
      events = events.slice(-limit);
    }
    return events;
  }

  // Helper methods
  private findExistingTrust(sourceOrgId: string, targetOrgId: string): TrustRelationship | undefined {
    return Array.from(this.trustRelationships.values()).find(
      (trust) =>
        trust.sourceOrgId === sourceOrgId &&
        trust.targetOrgId === targetOrgId &&
        (!trust.expiresAt || trust.expiresAt > new Date())
    );
  }

  private findActiveGrant(
    orgId: string,
    targetOrgId: string,
    capability: string
  ): CapabilityGrant | undefined {
    return Array.from(this.capabilityGrants.values()).find(
      (grant) =>
        grant.orgId === orgId &&
        grant.targetOrgId === targetOrgId &&
        grant.capability === capability &&
        grant.status === "active" &&
        (!grant.expiresAt || grant.expiresAt > new Date())
    );
  }

  private isValidTrustLevel(level: TrustLevel, org: FederationOrg, capabilities: string[]): boolean {
    // Validate that org has the capabilities it's trying to delegate
    for (const cap of capabilities) {
      if (!org.capabilities.has(cap)) {
        return false;
      }
    }

    // Tier-based constraints
    const tierTrustLevels: Record<FederationOrg["tier"], TrustLevel[]> = {
      standard: [TrustLevel.READ, TrustLevel.AUDIT_ONLY],
      enterprise: [TrustLevel.READ, TrustLevel.WRITE, TrustLevel.AUDIT_ONLY],
      strategic: [TrustLevel.READ, TrustLevel.WRITE, TrustLevel.ADMIN, TrustLevel.AUDIT_ONLY],
    };

    return tierTrustLevels[org.tier]?.includes(level) ?? false;
  }

  private async getDelegationDepth(orgId: string, originalOrgId: string, depth = 0): Promise<number> {
    if (orgId === originalOrgId) {
      return depth;
    }
    const grants = await this.getCapabilityGrantsForOrg(orgId);
    const delegatedGrants = grants.filter((g) => g.permissions.includes("delegate"));
    if (delegatedGrants.length === 0) {
      return depth;
    }
    let maxDepth = depth;
    for (const grant of delegatedGrants) {
      const grantDepth = await this.getDelegationDepth(grant.targetOrgId, originalOrgId, depth + 1);
      maxDepth = Math.max(maxDepth, grantDepth);
    }
    return maxDepth;
  }
}

export function createFederationGateway(config?: Partial<FederationGatewayConfig>): FederationGateway {
  return new FederationGateway(config);
}
