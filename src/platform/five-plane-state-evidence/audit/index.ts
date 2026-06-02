import { createHash, createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { newId, nowIso } from "../../contracts/types/ids.js";

export type AuditActorType = "user" | "agent" | "system" | "scheduler" | "admin" | "webhook" | "recovery";

export interface AuditRecord {
  auditId: string;
  sequence: number;
  actorType: AuditActorType;
  actorId: string;
  tenantId: string | null;
  taskId: string | null;
  executionId: string | null;
  action: string;
  resourceRef: string;
  decisionRef: string | null;
  versionRef: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
  prevHash: string | null;
  integrityHash: string;
  integritySignature: string;
}

export class AuditTrailService {
  private readonly maxRecords: number;
  private readonly signingKey: Buffer;
  private readonly persistencePath: string | null;
  private readonly records: AuditRecord[];

  public constructor(options: { maxRecords?: number; signingKey?: string; persistencePath?: string } = {}) {
    this.maxRecords = Math.max(1, options.maxRecords ?? 10_000);
    this.signingKey = Buffer.from(
      options.signingKey?.trim() || randomBytes(32).toString("hex"),
      "utf8",
    );
    this.persistencePath = options.persistencePath == null ? null : resolve(options.persistencePath);
    this.records = this.loadRecords();
  }

  public record(input: Omit<AuditRecord, "auditId" | "createdAt"> & { createdAt?: string }): AuditRecord {
    const previous = this.records[this.records.length - 1] ?? null;
    const metadata = cloneMetadata(input.metadata);
    const payload = {
      actorType: input.actorType,
      actorId: input.actorId,
      tenantId: input.tenantId,
      taskId: input.taskId,
      executionId: input.executionId,
      action: input.action,
      resourceRef: input.resourceRef,
      decisionRef: input.decisionRef,
      versionRef: input.versionRef,
      createdAt: input.createdAt ?? nowIso(),
      metadata,
      prevHash: previous?.integrityHash ?? null,
    };
    const integrityHash = createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
    const record: AuditRecord = {
      auditId: newId("audit"),
      sequence: (previous?.sequence ?? 0) + 1,
      ...payload,
      integrityHash,
      integritySignature: createHmac("sha256", this.signingKey).update(integrityHash, "utf8").digest("hex"),
    };
    this.records.push(Object.freeze(record));
    const overflow = this.records.length - this.maxRecords;
    if (overflow > 0) {
      this.records.splice(0, overflow);
    }
    this.persistRecords();
    return cloneRecord(record);
  }

  public exportForTask(taskId: string): AuditRecord[] {
    return this.records.filter((record) => record.taskId === taskId).map(cloneRecord);
  }

  public exportForTenant(tenantId: string): AuditRecord[] {
    return this.records.filter((record) => record.tenantId === tenantId).map(cloneRecord);
  }

  public listRecords(): AuditRecord[] {
    return this.records.map(cloneRecord);
  }

  private loadRecords(): AuditRecord[] {
    if (this.persistencePath == null || !existsSync(this.persistencePath)) {
      return [];
    }
    try {
      const parsed = JSON.parse(readFileSync(this.persistencePath, "utf8")) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .filter((candidate): candidate is AuditRecord => candidate != null && typeof candidate === "object")
        .map((candidate) => Object.freeze({
          ...candidate,
          metadata: cloneMetadata(candidate.metadata),
        }));
    } catch {
      return [];
    }
  }

  private persistRecords(): void {
    if (this.persistencePath == null) {
      return;
    }
    mkdirSync(dirname(this.persistencePath), { recursive: true });
    writeFileSync(
      this.persistencePath,
      JSON.stringify(this.records.map(cloneRecord), null, 2),
      "utf8",
    );
  }
}

function cloneMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(metadata);
}

function cloneRecord(record: AuditRecord): AuditRecord {
  return {
    ...record,
    metadata: cloneMetadata(record.metadata),
  };
}
