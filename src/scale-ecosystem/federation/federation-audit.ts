/**
 * Federation Audit
 * Audit trail for federation operations
 */

import { randomUUID } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { dirname, join } from "node:path";

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

export interface FederationAuditStorageOptions {
  readonly persistent?: boolean;
  readonly storageDir?: string;
}

interface PersistedFederationAuditRecord {
  id: string;
  timestamp: string;
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

// Default retention: 7 years for compliance
const DEFAULT_RETENTION_POLICY: AuditRetentionPolicy = {
  maxAgeDays: 2555,
  minRetentionDays: 2555,
  archiveBeforeDelete: true,
  compressArchives: true,
};

const DEFAULT_FEDERATION_AUDIT_DIR =
  process.env.AA_FEDERATION_AUDIT_DIR?.trim() || join(process.cwd(), ".runtime", "federation", "audit");

function isTestRuntime(): boolean {
  return process.env.AA_RUNNING_TESTS === "1"
    || process.env.NODE_TEST_CONTEXT === "child-v8"
    || process.env.VITEST === "true";
}

function serializeRecord(record: FederationAuditRecord): PersistedFederationAuditRecord {
  return {
    ...record,
    timestamp: record.timestamp.toISOString(),
  };
}

function deserializeRecord(record: PersistedFederationAuditRecord): FederationAuditRecord {
  return {
    ...record,
    timestamp: new Date(record.timestamp),
  };
}

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
  private readonly persistent: boolean;
  private readonly storageDir: string;
  private readonly snapshotPath: string;
  private readonly archivePath: string;

  constructor(
    retentionPolicy?: Partial<AuditRetentionPolicy>,
    storageOptions: FederationAuditStorageOptions = {},
  ) {
    this.retentionPolicy = { ...DEFAULT_RETENTION_POLICY, ...retentionPolicy };
    this.persistent = storageOptions.persistent ?? !isTestRuntime();
    this.storageDir = storageOptions.storageDir ?? DEFAULT_FEDERATION_AUDIT_DIR;
    this.snapshotPath = join(this.storageDir, "federation-audit-records.json");
    this.archivePath = join(this.storageDir, "federation-audit-archive.ndjson");
    if (this.persistent) {
      this.loadFromDisk();
    }
  }

  private ensureStorageDir(): void {
    mkdirSync(this.storageDir, { recursive: true });
  }

  private loadFromDisk(): void {
    if (!existsSync(this.snapshotPath)) {
      return;
    }
    const raw = readFileSync(this.snapshotPath, "utf8").trim();
    if (raw.length === 0) {
      return;
    }
    const parsed = JSON.parse(raw) as PersistedFederationAuditRecord[];
    this.records.clear();
    for (const item of parsed) {
      this.records.set(item.id, deserializeRecord(item));
    }
    this.rebuildIndices();
  }

  private persistSnapshot(): void {
    if (!this.persistent) {
      return;
    }
    this.ensureStorageDir();
    const snapshot = [...this.records.values()].map(serializeRecord);
    writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2), "utf8");
  }

  private appendArchive(records: readonly FederationAuditRecord[]): void {
    if (!this.persistent || records.length === 0) {
      return;
    }
    this.ensureStorageDir();
    const payload = records.map((record) => JSON.stringify(serializeRecord(record))).join("\n");
    appendFileSync(this.archivePath, `${payload}\n`, "utf8");
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
    this.persistSnapshot();

    return record;
  }

  private indexRecord(record: FederationAuditRecord): void {
    this.getOrCreateIndexSet(this.indexByOrg, record.orgId).add(record.id);

    if (record.targetOrgId) {
      this.getOrCreateIndexSet(this.indexByOrg, record.targetOrgId).add(record.id);
    }

    if (record.actor) {
      this.getOrCreateIndexSet(this.indexByActor, record.actor).add(record.id);
    }

    this.getOrCreateIndexSet(this.indexByAction, record.action).add(record.id);

    if (record.resourceId) {
      const resourceKey = `${record.resourceType}:${record.resourceId}`;
      this.getOrCreateIndexSet(this.indexByResource, resourceKey).add(record.id);
    }

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

      if (query.orgId && record.orgId !== query.orgId && record.targetOrgId !== query.orgId) continue;
      if (query.actor && record.actor !== query.actor) continue;
      if (query.action && record.action !== query.action) continue;
      if (query.correlationId && record.correlationId !== query.correlationId) continue;
      if (query.targetOrgId && record.targetOrgId !== query.targetOrgId) continue;
      if (query.resourceType && record.resourceType !== query.resourceType) continue;
      if (query.resourceId && record.resourceId !== query.resourceId) continue;
      if (query.status && record.status !== query.status) continue;
      if (query.startTime && record.timestamp < query.startTime) continue;
      if (query.endTime && record.timestamp > query.endTime) continue;

      results.push(record);
    }

    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

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
    const queryParams: AuditQuery = {
      ...(query?.orgId !== undefined ? { orgId: query.orgId } : {}),
      ...(query?.actor !== undefined ? { actor: query.actor } : {}),
      ...(query?.action !== undefined ? { action: query.action } : {}),
      ...(query?.resourceType !== undefined ? { resourceType: query.resourceType } : {}),
      ...(query?.resourceId !== undefined ? { resourceId: query.resourceId } : {}),
      ...(query?.targetOrgId !== undefined ? { targetOrgId: query.targetOrgId } : {}),
      ...(query?.status !== undefined ? { status: query.status } : {}),
      ...(query?.startTime !== undefined ? { startTime: query.startTime } : {}),
      ...(query?.endTime !== undefined ? { endTime: query.endTime } : {}),
      ...(query?.correlationId !== undefined ? { correlationId: query.correlationId } : {}),
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
      if (record.timestamp <= cutoff) {
        expired.push(id);
      }
    }

    return expired;
  }

  async applyRetentionPolicy(): Promise<{ deleted: number; archived: number }> {
    const expiredIds = this.getExpiredRecordIds();
    const archivedRecords: FederationAuditRecord[] = [];
    let deleted = 0;
    let archived = 0;

    for (const id of expiredIds) {
      const record = this.records.get(id);
      if (!record) continue;

      if (this.retentionPolicy.archiveBeforeDelete) {
        archivedRecords.push(record);
        archived++;
      }

      this.records.delete(id);
      deleted++;
    }

    this.appendArchive(archivedRecords);
    this.rebuildIndices();
    this.persistSnapshot();

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
      if (!record.timestamp || !(record.timestamp instanceof Date) || Number.isNaN(record.timestamp.getTime())) {
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

export function createFederationAudit(
  retentionPolicy?: Partial<AuditRetentionPolicy>,
  storageOptions?: FederationAuditStorageOptions,
): FederationAudit {
  return new FederationAudit(retentionPolicy, storageOptions);
}
