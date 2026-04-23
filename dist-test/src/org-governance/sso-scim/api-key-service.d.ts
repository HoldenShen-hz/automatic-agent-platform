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
export declare class ApiKeyService {
    private readonly keys;
    private readonly keyHashIndex;
    generateApiKey(input: CreateApiKeyInput): {
        record: ApiKeyRecord;
        rawKey: string;
    };
    validateApiKey(rawKey: string): ApiKeyValidationResult;
    revokeApiKey(keyId: string, revokedBy: string): boolean;
    listApiKeysForOwner(ownerId: string): ApiKeyRecord[];
    getApiKey(keyId: string): ApiKeyRecord | null;
    rotateApiKey(keyId: string, rotatedBy: string): {
        record: ApiKeyRecord;
        rawKey: string;
    } | null;
    private generateRawKey;
    private hashKey;
}
