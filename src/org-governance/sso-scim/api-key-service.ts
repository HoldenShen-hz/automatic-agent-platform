/**
 * @fileoverview API Key Management Service
 *
 * Provides:
 * - API Key CRUD operations
 * - Key validation and lookup
 * - Usage tracking and expiration
 * - Owner-based key management
 *
 * §58 Authentication system - API Key management interface
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";

export interface ApiKeyRecord {
  keyId: string;
  tenantId: string;
  keyHash: string;
  keyPrefix: string;
  name: string;
  ownerId: string;
  scopes: readonly string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  status: "active" | "revoked" | "expired";
  createdBy: string;
  revokedAt?: string | null;
  revokedBy?: string | null;
}

export interface CreateApiKeyInput {
  name: string;
  ownerId: string;
  tenantId?: string;
  scopes?: readonly string[];
  expiresAt?: string | null;
  createdBy: string;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  keyId: string | null;
  ownerId: string | null;
  tenantId: string | null;
  scopes: readonly string[];
  reason?: string;
}

export type ApiKeyRotationResult =
  | {
      readonly record: ApiKeyRecord;
      readonly rawKey: string;
      readonly reason?: undefined;
    }
  | {
      readonly record: null;
      readonly rawKey: null;
      readonly reason: "key_not_found" | "key_expired" | "key_revoked";
    };

export interface ApiKeyServiceOptions {
  readonly keyPrefixLength?: number;
  readonly hashPepper?: string;
}

type ApiKeyAuditAction = "generate" | "revoke" | "rotate" | "validate_fail" | "expire";

interface ApiKeyAuditEntry {
  readonly action: ApiKeyAuditAction;
  readonly keyId: string;
  readonly actorId: string;
  readonly occurredAt: string;
}

export class ApiKeyService {
  private readonly keys = new Map<string, ApiKeyRecord>();
  private readonly keyHashIndex = new Map<string, Set<string>>();
  private readonly auditLog: ApiKeyAuditEntry[] = [];
  private readonly keyPrefixLength: number;
  private readonly hashPepper: string;

  public constructor(options: ApiKeyServiceOptions = {}) {
    this.keyPrefixLength = options.keyPrefixLength ?? 8;
    this.hashPepper = options.hashPepper ?? randomBytes(32).toString("hex");
  }

  public generateApiKey(input: CreateApiKeyInput): { record: ApiKeyRecord; rawKey: string } {
    const rawKey = this.generateRawKey();
    const tenantId = input.tenantId ?? "tenant:global";
    const keyHash = this.hashKey(rawKey, tenantId);
    const keyPrefix = rawKey.substring(0, this.keyPrefixLength);

    const record: ApiKeyRecord = {
      keyId: newId("apikey"),
      tenantId,
      keyHash,
      keyPrefix,
      name: input.name,
      ownerId: input.ownerId,
      scopes: input.scopes ?? [],
      expiresAt: input.expiresAt ?? null,
      lastUsedAt: null,
      createdAt: nowIso(),
      status: "active",
      createdBy: input.createdBy,
      revokedAt: null,
      revokedBy: null,
    };

    this.keys.set(record.keyId, record);
    const existingKeyIds = this.keyHashIndex.get(keyHash) ?? new Set<string>();
    existingKeyIds.add(record.keyId);
    this.keyHashIndex.set(keyHash, existingKeyIds);
    this.appendAudit("generate", record.keyId, input.createdBy, record.createdAt);

    return { record, rawKey };
  }

  public validateApiKey(rawKey: string, tenantId?: string): ApiKeyValidationResult {
    const matchingRecords = this.findMatchingRecords(rawKey, tenantId);
    if (matchingRecords.length === 0) {
      this.appendAudit("validate_fail", "api_key:unknown", "system", nowIso());
      return { valid: false, keyId: null, ownerId: null, tenantId: null, scopes: [], reason: "invalid_key" };
    }
    if (tenantId == null && matchingRecords.length > 1) {
      this.appendAudit("validate_fail", matchingRecords[0]?.keyId ?? "api_key:unknown", "system", nowIso());
      return { valid: false, keyId: null, ownerId: null, tenantId: null, scopes: [], reason: "tenant_context_required" };
    }
    const record = matchingRecords[0]!;

    if (record.status !== "active") {
      this.appendAudit("validate_fail", record.keyId, "system", nowIso());
      return { valid: false, keyId: record.keyId, ownerId: null, tenantId: record.tenantId, scopes: [], reason: `key_${record.status}` };
    }

    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      this.markExpired(record, "system");
      return { valid: false, keyId: record.keyId, ownerId: null, tenantId: record.tenantId, scopes: [], reason: "key_expired" };
    }

    record.lastUsedAt = nowIso();

    return { valid: true, keyId: record.keyId, ownerId: record.ownerId, tenantId: record.tenantId, scopes: record.scopes };
  }

  public revokeApiKey(keyId: string, revokedBy: string): boolean {
    const record = this.keys.get(keyId);
    if (!record || record.status !== "active") {
      return false;
    }

    record.status = "revoked";
    record.revokedAt = nowIso();
    record.revokedBy = revokedBy;
    this.removeKeyHashIndexEntry(record.keyHash, record.keyId);
    this.appendAudit("revoke", keyId, revokedBy, record.revokedAt);
    return true;
  }

  public listAuditLog(): ReadonlyArray<ApiKeyAuditEntry> {
    return [...this.auditLog];
  }

  public listApiKeysForOwner(ownerId: string, tenantId?: string): ApiKeyRecord[] {
    return [...this.keys.values()].filter((k) => k.ownerId === ownerId && (tenantId == null || k.tenantId === tenantId));
  }

  public getApiKey(keyId: string): ApiKeyRecord | null {
    return this.keys.get(keyId) ?? null;
  }

  public rotateApiKey(keyId: string, rotatedBy: string): ApiKeyRotationResult {
    const existing = this.keys.get(keyId);
    if (!existing) {
      return { record: null, rawKey: null, reason: "key_not_found" };
    }
    if (existing.status !== "active") {
      return {
        record: null,
        rawKey: null,
        reason: existing.status === "expired" ? "key_expired" : "key_revoked",
      };
    }
    if (existing.expiresAt && new Date(existing.expiresAt) < new Date()) {
      this.markExpired(existing, "system");
      return { record: null, rawKey: null, reason: "key_expired" };
    }

    existing.status = "revoked";
    existing.revokedAt = nowIso();
    existing.revokedBy = rotatedBy;
    this.removeKeyHashIndexEntry(existing.keyHash, existing.keyId);
    this.appendAudit("revoke", existing.keyId, rotatedBy, existing.revokedAt);
    const rotated = this.generateApiKey({
      name: existing.name,
      ownerId: existing.ownerId,
      tenantId: existing.tenantId,
      scopes: existing.scopes,
      expiresAt: existing.expiresAt,
      createdBy: rotatedBy,
    });
    this.appendAudit("rotate", existing.keyId, rotatedBy, existing.revokedAt);
    return rotated;
  }

  private generateRawKey(): string {
    return `aa_${randomBytes(32).toString("hex")}`;
  }

  private hashKey(rawKey: string, tenantId: string): string {
    return createHmac("sha256", this.hashPepper)
      .update(tenantId)
      .update("\u0000")
      .update(rawKey)
      .digest("hex");
  }

  private findMatchingRecords(rawKey: string, tenantId?: string): ApiKeyRecord[] {
    if (tenantId != null) {
      const keyHash = this.hashKey(rawKey, tenantId);
      return [...(this.keyHashIndex.get(keyHash) ?? [])]
        .map((keyId) => this.keys.get(keyId))
        .filter((record): record is ApiKeyRecord => record != null)
        .filter((record) => record.tenantId === tenantId);
    }
    const rawKeyBuffer = Buffer.from(rawKey, "utf8");
    return [...this.keys.values()].filter((record) => {
      const candidateHash = this.hashKey(rawKey, record.tenantId);
      const expected = Buffer.from(record.keyHash, "hex");
      const actual = Buffer.from(candidateHash, "hex");
      return expected.length === actual.length && timingSafeEqual(expected, actual) && rawKeyBuffer.length > 0;
    });
  }

  private markExpired(record: ApiKeyRecord, actorId: string): void {
    record.status = "expired";
    this.removeKeyHashIndexEntry(record.keyHash, record.keyId);
    this.appendAudit("expire", record.keyId, actorId, nowIso());
  }

  private removeKeyHashIndexEntry(keyHash: string, keyId: string): void {
    const keyIds = this.keyHashIndex.get(keyHash);
    if (!keyIds) {
      return;
    }
    keyIds.delete(keyId);
    if (keyIds.size === 0) {
      this.keyHashIndex.delete(keyHash);
    }
  }

  private appendAudit(action: ApiKeyAuditAction, keyId: string, actorId: string, occurredAt: string): void {
    this.auditLog.push({ action, keyId, actorId, occurredAt });
  }
}
