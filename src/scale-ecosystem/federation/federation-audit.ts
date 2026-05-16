/**
 * Federation Audit
 * Audit trail for federation operations
 */

import { randomUUID } from "crypto";

// Types
export interface FederationAuditRecord {
  id: string;
  timestamp: Date;
  orgId: string;
  actor?: string;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  targetOrgId?: string;
  status: AuditStatus;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

export type AuditAction =
  | "org.registered"
  | "org.deactivated"
  | "org.capabilities_updated"
  | "trust.established"
  | "trust.modified"
  | "trust.revoked"
  | "capability.granted"
  | "capability.suspended"
  | "capability.revoked"
  | "delegation.requested"
  | "delegation.approved"
  | "delegation.rejected"
  | "access.checked"
  | "access.denied";

export type ResourceType = "organization" | "trust" | "capability" | "delegation" | "audit";

export type AuditStatus = "success" | "failure" | "pending" | "denied";

export interface AuditQuery {
  orgId?: string;
  actor?: string;
  action?: AuditAction;
  resourceType?: ResourceType;
  resourceId?: string;
  targetOrgId?: string;
  status?: AuditStatus;
  startTime?: Date;
  endTime?: Date;
  correlationId?: string;
  limit?: number;
  offset?: number;
}

export interface AuditSummary {
  totalRecords: number;
  byAction: Record<string, number>;
  byStatus: Record<string, number>;
  byOrg: Record<string, number>;
  timeRange: { start: Date; end: Date };
}

export interface AuditRetentionPolicy {
  maxAgeDays: number;
  minRetentionDays: number;
  archiveBeforeDelete: boolean;
  compressArchives: boolean;
}

// Default retention: 7 years for compliance
const DEFAULT_RETENTION_POLICY: AuditRetentionPolicy = {
  maxAgeDays: 2555,
  minRetentionDays: 2555,
  archiveBeforeDelete: true,
  compressArchives: true,
};

/**
 * FederationAudit provides comprehensive audit trail for all
 * federation operations including trust relationships and capability delegation.
 */
export class FederationAudit {
  private readonly records: Map<string, FederationAuditRecord> = new Map();
  private readonly retentionPolicy: AuditRetentionPolicy;
  private readonly indexByOrg: Map<string, Set<string>> = new Map();
  private readonly indexByActor: Map<string, Set<string>> = new Map();
  private readonly indexByAction: Map<string, Set<string>> = new Map();
  private readonly indexByResource: Map<string, Set<string>> = new Map();
  private readonly indexByCorrelation: Map<string, Set<string>> = new Map();

  constructor(retentionPolicy?: Partial<AuditRetentionPolicy>) {
    this.retentionPolicy = { ...DEFAULT_RETENTION_POLICY, ...retentionPolicy };
  }

  // Record Operations
  record(entry: Omit<FederationAuditRecord, "id" | "timestamp">): FederationAuditRecord {
    const record: FederationAuditRecord = {
      ...entry,
      id: randomUUID(),
      timestamp: new Date(),
    };

    this.records.set(record.id, record);
    this.indexRecord(record);

    return record;
  }

  private indexRecord(record: FederationAuditRecord): void {
    // Index by organization
    this.getOrCreateIndexSet(this.indexByOrg, record.orgId).add(record.id);

    if (record.targetOrgId) {
      this.getOrCreateIndexSet(this.indexByOrg, record.targetOrgId).add(record.id);
    }

    // Index by actor
    if (record.actor) {
      this.getOrCreateIndexSet(this.indexByActor, record.actor).add(record.id);
    }

    // Index by action
    this.getOrCreateIndexSet(this.indexByAction, record.action).add(record.id);

    // Index by resource
    if (record.resourceId) {
      const resourceKey = `${record.resourceType}:${record.resourceId}`;
      this.getOrCreateIndexSet(this.indexByResource, resourceKey).add(record.id);
    }

    // Index by correlation ID
    if (record.correlationId) {
      this.getOrCreateIndexSet(this.indexByCorrelation, record.correlationId).add(record.id);
    }
  }

  private getOrCreateIndexSet(index: Map<string, Set<string>>, key: string): Set<string> {
    const existing = index.get(key);
    if (existing) {
      return existing;
    }
    const created = new Set<string>();
    index.set(key, created);
    return created;
  }

  // Query Operations
  query(query: AuditQuery): FederationAuditRecord[] {
    let recordIds: Set<string> | null = null;

    // Build initial record set from first available index
    if (query.orgId) {
      recordIds = this.indexByOrg.get(query.orgId) ?? new Set();
    } else if (query.actor) {
      recordIds = this.indexByActor.get(query.actor) ?? new Set();
    } else if (query.action) {
      recordIds = this.indexByAction.get(query.action) ?? new Set();
    } else if (query.correlationId) {
      recordIds = this.indexByCorrelation.get(query.correlationId) ?? new Set();
    }

    const allRecordIds = recordIds ?? new Set(this.records.keys());
    const results: FederationAuditRecord[] = [];

    for (const id of allRecordIds) {
      const record = this.records.get(id);
      if (!record) continue;

      // Apply filters
      if (query.targetOrgId && record.targetOrgId !== query.targetOrgId) continue;
      if (query.resourceType && record.resourceType !== query.resourceType) continue;
      if (query.resourceId && record.resourceId !== query.resourceId) continue;
      if (query.status && record.status !== query.status) continue;
      if (query.startTime && record.timestamp < query.startTime) continue;
      if (query.endTime && record.timestamp > query.endTime) continue;

      results.push(record);
    }

    // Sort by timestamp descending (most recent first)
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  getRecord(id: string): FederationAuditRecord | undefined {
    return this.records.get(id);
  }

  getRecordsForResource(resourceType: ResourceType, resourceId: string): FederationAuditRecord[] {
    const resourceKey = `${resourceType}:${resourceId}`;
    const recordIds = this.indexByResource.get(resourceKey);
    if (!recordIds) return [];

    return Array.from(recordIds)
      .map((id) => this.records.get(id))
      .filter((r): r is FederationAuditRecord => r !== undefined)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getRecordsForOrg(orgId: string, limit?: number): FederationAuditRecord[] {
    const recordIds = this.indexByOrg.get(orgId);
    if (!recordIds) return [];

    const records = Array.from(recordIds)
      .map((id) => this.records.get(id))
      .filter((r): r is FederationAuditRecord => r !== undefined)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return limit ? records.slice(0, limit) : records;
  }

  // Summary
  getSummary(query?: Partial<AuditQuery>): AuditSummary {
    // Build query without limit/offset to get all matching records
    const queryParams: AuditQuery = {
      ...(query?.orgId !== undefined && { orgId: query.orgId }),
      ...(query?.actor !== undefined && { actor: query.actor }),
      ...(query?.action !== undefined && { action: query.action }),
      ...(query?.resourceType !== undefined && { resourceType: query.resourceType }),
      ...(query?.resourceId !== undefined && { resourceId: query.resourceId }),
      ...(query?.targetOrgId !== undefined && { targetOrgId: query.targetOrgId }),
      ...(query?.status !== undefined && { status: query.status }),
      ...(query?.startTime !== undefined && { startTime: query.startTime }),
      ...(query?.endTime !== undefined && { endTime: query.endTime }),
      ...(query?.correlationId !== undefined && { correlationId: query.correlationId }),
    };
    const records = this.query(queryParams);

    const byAction: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const byOrg: Record<string, number> = {};

    for (const record of records) {
      byAction[record.action] = (byAction[record.action] ?? 0) + 1;
      byStatus[record.status] = (byStatus[record.status] ?? 0) + 1;
      byOrg[record.orgId] = (byOrg[record.orgId] ?? 0) + 1;
    }

    const timestamps = records.map((r) => r.timestamp.getTime());
    return {
      totalRecords: records.length,
      byAction,
      byStatus,
      byOrg,
      timeRange: {
        start: timestamps.length ? new Date(Math.min(...timestamps)) : new Date(),
        end: timestamps.length ? new Date(Math.max(...timestamps)) : new Date(),
      },
    };
  }

  // Retention Management
  getExpiredRecordIds(): string[] {
    const maxAgeMs = this.retentionPolicy.maxAgeDays * 24 * 60 * 60 * 1000;
    const cutoff = new Date(Date.now() - maxAgeMs);
    const expired: string[] = [];

    for (const [id, record] of this.records) {
      if (record.timestamp < cutoff) {
        expired.push(id);
      }
    }

    return expired;
  }

  async applyRetentionPolicy(): Promise<{ deleted: number; archived: number }> {
    const expiredIds = this.getExpiredRecordIds();
    let deleted = 0;
    let archived = 0;

    for (const id of expiredIds) {
      const record = this.records.get(id);
      if (!record) continue;

      if (this.retentionPolicy.archiveBeforeDelete) {
        // Archive logic would go here (e.g., write to cold storage)
        archived++;
      }

      this.records.delete(id);
      deleted++;
    }

    // Rebuild indices
    this.rebuildIndices();

    return { deleted, archived };
  }

  private rebuildIndices(): void {
    this.indexByOrg.clear();
    this.indexByActor.clear();
    this.indexByAction.clear();
    this.indexByResource.clear();
    this.indexByCorrelation.clear();

    for (const record of this.records.values()) {
      this.indexRecord(record);
    }
  }

  // Compliance
  exportForCompliance(orgId: string, startDate: Date, endDate: Date): FederationAuditRecord[] {
    return this.query({
      orgId,
      startTime: startDate,
      endTime: endDate,
    });
  }

  verifyIntegrity(): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    for (const [id, record] of this.records) {
      if (!record.id || record.id !== id) {
        issues.push(`Record ID mismatch: expected ${id}, got ${record.id}`);
      }
      if (!record.timestamp || !(record.timestamp instanceof Date)) {
        issues.push(`Invalid timestamp for record ${id}`);
      }
      if (!record.orgId) {
        issues.push(`Missing orgId for record ${id}`);
      }
      if (!record.action) {
        issues.push(`Missing action for record ${id}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  getRecordCount(): number {
    return this.records.size;
  }
}

export function createFederationAudit(retentionPolicy?: Partial<AuditRetentionPolicy>): FederationAudit {
  return new FederationAudit(retentionPolicy);
}
