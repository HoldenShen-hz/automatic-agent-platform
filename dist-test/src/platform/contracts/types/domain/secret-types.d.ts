/**
 * @fileoverview Secret Types - Secret registry, audit, and lease records.
 *
 * Contains records related to secret management including
 * secret metadata, access auditing, and temporary secret leases.
 *
 * Part of the domain.ts split (see src/core/types/domain/index.ts).
 */
import type { SecretCategory, SecretScopeType, SecretProviderKind, SecretStatus, SecretRotationMode, SecretRotationEventStatus, SecretLeaseStatus, Timestamp } from "./primitives.js";
/**
 * Secret registry record - metadata for a managed secret (API key, credential, etc.).
 *
 * Secrets are stored in external providers (Vault, AWS KMS) and referenced here.
 * The registry tracks rotation schedules, status, and the current version.
 * Actual secret values are never stored in this system.
 */
export interface SecretRegistryRecord {
    secretRef: string;
    displayName: string;
    category: SecretCategory;
    providerKind: SecretProviderKind;
    scopeType: SecretScopeType;
    scopeRef: string;
    status: SecretStatus;
    rotationPolicyJson: string;
    metadataJson: string | null;
    currentVersion: string | null;
    lastRotatedAt: Timestamp | null;
    nextRotationDueAt: Timestamp | null;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}
/**
 * Secret usage audit record - tracks when and why secrets were accessed.
 *
 * Every secret access is logged with the requestor identity, granted identity,
 * and usage purpose. This creates a complete audit trail for compliance
 * and security monitoring. Values are masked in the audit record.
 */
export interface SecretUsageAuditRecord {
    auditId: string;
    secretRef: string;
    providerKind: SecretProviderKind;
    taskId: string | null;
    executionId: string | null;
    requestedBy: string;
    grantedTo: string;
    usagePurpose: string;
    resolvedAt: Timestamp;
    expiresAt: Timestamp | null;
    maskedValue: string | null;
    metadataJson: string | null;
}
/**
 * Secret rotation event record - tracks secret version changes.
 *
 * Records rotation lifecycle events: requested, completed, failed.
 * Tracks the previous and next version identifiers for rollback capability.
 */
export interface SecretRotationEventRecord {
    eventId: string;
    secretRef: string;
    providerKind: SecretProviderKind;
    rotationMode: SecretRotationMode;
    status: SecretRotationEventStatus;
    reasonCode: string;
    requestedBy: string;
    previousVersion: string | null;
    nextVersion: string | null;
    occurredAt: Timestamp;
    metadataJson: string | null;
}
/**
 * Secret lease record - temporary access grant to a secret for a specific purpose.
 *
 * Tasks and executions can request temporary access to secrets. The lease
 * limits the access window and tracks revocation for security auditing.
 */
export interface SecretLeaseRecord {
    leaseId: string;
    secretRef: string;
    providerKind: SecretProviderKind;
    taskId: string | null;
    executionId: string | null;
    requestedBy: string;
    grantedTo: string;
    usagePurpose: string;
    issuedAt: Timestamp;
    expiresAt: Timestamp;
    status: SecretLeaseStatus;
    revokedAt: Timestamp | null;
    revokedBy: string | null;
    revocationReasonCode: string | null;
    sourceVersion: string | null;
    maskedValue: string | null;
    metadataJson: string | null;
}
