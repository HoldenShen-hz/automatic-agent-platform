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

import { createHash, randomBytes } from "node:crypto";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";

export interface ApiKeyRecord {
  keyId: string;
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
  scopes?: readonly string[];
  expiresAt?: string | null;
  createdBy: string;
}

export interface ApiKeyValidationResult {
  valid: boolean;
  keyId: string | null;
  ownerId: string | null;
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

const KEY_PREFIX_LENGTH = 8;

export class ApiKeyService {
  private readonly keys = new Map<string, ApiKeyRecord>();
  private readonly keyHashIndex = new Map<string, string>();
  private readonly auditLog: Array<{ action: "revoke"; keyId: string; actorId: string; occurredAt: string }> = [];

  public generateApiKey(input: CreateApiKeyInput): { record: ApiKeyRecord; rawKey: string } {
    const rawKey = this.generateRawKey();
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, KEY_PREFIX_LENGTH);

    const record: ApiKeyRecord = {
      keyId: newId("apikey"),
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
    this.keyHashIndex.set(keyHash, record.keyId);

    return { record, rawKey };
  }

  public validateApiKey(rawKey: string): ApiKeyValidationResult {
    const keyHash = this.hashKey(rawKey);
    const keyId = this.keyHashIndex.get(keyHash);

    if (!keyId) {
      return { valid: false, keyId: null, ownerId: null, scopes: [], reason: "invalid_key" };
    }

    const record = this.keys.get(keyId);
    if (!record) {
      return { valid: false, keyId: null, ownerId: null, scopes: [], reason: "key_not_found" };
    }

    if (record.status !== "active") {
      return { valid: false, keyId: record.keyId, ownerId: null, scopes: [], reason: `key_${record.status}` };
    }

    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      record.status = "expired";
      return { valid: false, keyId: record.keyId, ownerId: null, scopes: [], reason: "key_expired" };
    }

    record.lastUsedAt = nowIso();

    return { valid: true, keyId: record.keyId, ownerId: record.ownerId, scopes: record.scopes };
  }

  public revokeApiKey(keyId: string, revokedBy: string): boolean {
    const record = this.keys.get(keyId);
    if (!record || record.status !== "active") {
      return false;
    }

    record.status = "revoked";
    record.revokedAt = nowIso();
    record.revokedBy = revokedBy;
    this.auditLog.push({
      action: "revoke",
      keyId,
      actorId: revokedBy,
      occurredAt: record.revokedAt,
    });
    return true;
  }

  public listAuditLog(): ReadonlyArray<{ action: "revoke"; keyId: string; actorId: string; occurredAt: string }> {
    return [...this.auditLog];
  }

  public listApiKeysForOwner(ownerId: string): ApiKeyRecord[] {
    return [...this.keys.values()].filter((k) => k.ownerId === ownerId);
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
      existing.status = "expired";
      return { record: null, rawKey: null, reason: "key_expired" };
    }

    existing.status = "revoked";

    return this.generateApiKey({
      name: existing.name,
      ownerId: existing.ownerId,
      scopes: existing.scopes,
      expiresAt: existing.expiresAt,
      createdBy: rotatedBy,
    });
  }

  private generateRawKey(): string {
    return `aa_${randomBytes(32).toString("hex")}`;
  }

  private hashKey(rawKey: string): string {
    return createHash("sha256").update(rawKey).digest("hex");
  }
}
