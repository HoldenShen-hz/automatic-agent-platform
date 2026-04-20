/**
 * AsyncSecretRepository - Async data access for secret registry, leases, rotation events, and usage audits.
 */

import type {
  SecretLeaseRecord,
  SecretRegistryRecord,
  SecretRotationEventRecord,
  SecretUsageAuditRecord,
} from "../../../contracts/types/domain.js";
import type { AsyncSqlConnection } from "../async-sql-database.js";
import { asyncExecute, asyncQueryAll, asyncQueryOne } from "../async-query-helper.js";

export class AsyncSecretRepository {
  public constructor(private readonly conn: AsyncSqlConnection) {}

  public async upsertSecretRegistryRecord(record: SecretRegistryRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO secret_registry (
        secret_ref, display_name, category, provider_kind, scope_type, scope_ref, status,
        rotation_policy_json, metadata_json, current_version, last_rotated_at, next_rotation_due_at,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT(secret_ref) DO UPDATE SET
        display_name = excluded.display_name,
        category = excluded.category,
        provider_kind = excluded.provider_kind,
        scope_type = excluded.scope_type,
        scope_ref = excluded.scope_ref,
        status = excluded.status,
        rotation_policy_json = excluded.rotation_policy_json,
        metadata_json = excluded.metadata_json,
        current_version = excluded.current_version,
        last_rotated_at = excluded.last_rotated_at,
        next_rotation_due_at = excluded.next_rotation_due_at,
        updated_at = excluded.updated_at`,
      record.secretRef,
      record.displayName,
      record.category,
      record.providerKind,
      record.scopeType,
      record.scopeRef,
      record.status,
      record.rotationPolicyJson,
      record.metadataJson,
      record.currentVersion,
      record.lastRotatedAt,
      record.nextRotationDueAt,
      record.createdAt,
      record.updatedAt,
    );
  }

  public async insertSecretUsageAudit(record: SecretUsageAuditRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO secret_usage_audits (
        audit_id, secret_ref, provider_kind, task_id, execution_id, requested_by, granted_to,
        usage_purpose, resolved_at, expires_at, masked_value, metadata_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      record.auditId,
      record.secretRef,
      record.providerKind,
      record.taskId,
      record.executionId,
      record.requestedBy,
      record.grantedTo,
      record.usagePurpose,
      record.resolvedAt,
      record.expiresAt,
      record.maskedValue,
      record.metadataJson,
    );
  }

  public async insertSecretRotationEvent(record: SecretRotationEventRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO secret_rotation_events (
        event_id, secret_ref, provider_kind, rotation_mode, status, reason_code, requested_by,
        previous_version, next_version, occurred_at, metadata_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      record.eventId,
      record.secretRef,
      record.providerKind,
      record.rotationMode,
      record.status,
      record.reasonCode,
      record.requestedBy,
      record.previousVersion,
      record.nextVersion,
      record.occurredAt,
      record.metadataJson,
    );
  }

  public async upsertSecretLeaseRecord(record: SecretLeaseRecord): Promise<void> {
    await asyncExecute(
      this.conn,
      `INSERT INTO secret_leases (
        lease_id, secret_ref, provider_kind, task_id, execution_id, requested_by, granted_to,
        usage_purpose, issued_at, expires_at, status, revoked_at, revoked_by, revocation_reason_code,
        source_version, masked_value, metadata_json
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT(lease_id) DO UPDATE SET
        status = excluded.status,
        revoked_at = excluded.revoked_at,
        revoked_by = excluded.revoked_by,
        revocation_reason_code = excluded.revocation_reason_code,
        masked_value = excluded.masked_value,
        metadata_json = excluded.metadata_json`,
      record.leaseId,
      record.secretRef,
      record.providerKind,
      record.taskId,
      record.executionId,
      record.requestedBy,
      record.grantedTo,
      record.usagePurpose,
      record.issuedAt,
      record.expiresAt,
      record.status,
      record.revokedAt,
      record.revokedBy,
      record.revocationReasonCode,
      record.sourceVersion,
      record.maskedValue,
      record.metadataJson,
    );
  }

  public async getSecretRegistryRecord(secretRef: string): Promise<SecretRegistryRecord | null> {
    const result = await asyncQueryOne<SecretRegistryRecord>(
      this.conn,
      `SELECT
         secret_ref AS "secretRef",
         display_name AS "displayName",
         category,
         provider_kind AS "providerKind",
         scope_type AS "scopeType",
         scope_ref AS "scopeRef",
         status,
         rotation_policy_json AS "rotationPolicyJson",
         metadata_json AS "metadataJson",
         current_version AS "currentVersion",
         last_rotated_at AS "lastRotatedAt",
         next_rotation_due_at AS "nextRotationDueAt",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM secret_registry
       WHERE secret_ref = $1`,
      secretRef,
    );
    return result ?? null;
  }

  public async listSecretRegistryRecords(): Promise<SecretRegistryRecord[]> {
    return asyncQueryAll<SecretRegistryRecord>(
      this.conn,
      `SELECT
         secret_ref AS "secretRef",
         display_name AS "displayName",
         category,
         provider_kind AS "providerKind",
         scope_type AS "scopeType",
         scope_ref AS "scopeRef",
         status,
         rotation_policy_json AS "rotationPolicyJson",
         metadata_json AS "metadataJson",
         current_version AS "currentVersion",
         last_rotated_at AS "lastRotatedAt",
         next_rotation_due_at AS "nextRotationDueAt",
         created_at AS "createdAt",
         updated_at AS "updatedAt"
       FROM secret_registry
       ORDER BY secret_ref ASC`,
    );
  }

  public async listSecretUsageAuditsBySecretRef(secretRef: string): Promise<SecretUsageAuditRecord[]> {
    return asyncQueryAll<SecretUsageAuditRecord>(
      this.conn,
      `SELECT
         audit_id AS "auditId",
         secret_ref AS "secretRef",
         provider_kind AS "providerKind",
         task_id AS "taskId",
         execution_id AS "executionId",
         requested_by AS "requestedBy",
         granted_to AS "grantedTo",
         usage_purpose AS "usagePurpose",
         resolved_at AS "resolvedAt",
         expires_at AS "expiresAt",
         masked_value AS "maskedValue",
         metadata_json AS "metadataJson"
       FROM secret_usage_audits
       WHERE secret_ref = $1
       ORDER BY resolved_at DESC, audit_id DESC`,
      secretRef,
    );
  }

  public async listSecretRotationEventsBySecretRef(secretRef: string): Promise<SecretRotationEventRecord[]> {
    return asyncQueryAll<SecretRotationEventRecord>(
      this.conn,
      `SELECT
         event_id AS "eventId",
         secret_ref AS "secretRef",
         provider_kind AS "providerKind",
         rotation_mode AS "rotationMode",
         status,
         reason_code AS "reasonCode",
         requested_by AS "requestedBy",
         previous_version AS "previousVersion",
         next_version AS "nextVersion",
         occurred_at AS "occurredAt",
         metadata_json AS "metadataJson"
       FROM secret_rotation_events
       WHERE secret_ref = $1
       ORDER BY occurred_at DESC, event_id DESC`,
      secretRef,
    );
  }

  public async getSecretLeaseRecord(leaseId: string): Promise<SecretLeaseRecord | null> {
    const result = await asyncQueryOne<SecretLeaseRecord>(
      this.conn,
      `SELECT
         lease_id AS "leaseId",
         secret_ref AS "secretRef",
         provider_kind AS "providerKind",
         task_id AS "taskId",
         execution_id AS "executionId",
         requested_by AS "requestedBy",
         granted_to AS "grantedTo",
         usage_purpose AS "usagePurpose",
         issued_at AS "issuedAt",
         expires_at AS "expiresAt",
         status,
         revoked_at AS "revokedAt",
         revoked_by AS "revokedBy",
         revocation_reason_code AS "revocationReasonCode",
         source_version AS "sourceVersion",
         masked_value AS "maskedValue",
         metadata_json AS "metadataJson"
       FROM secret_leases
       WHERE lease_id = $1`,
      leaseId,
    );
    return result ?? null;
  }

  public async listSecretLeasesBySecretRef(secretRef: string): Promise<SecretLeaseRecord[]> {
    return asyncQueryAll<SecretLeaseRecord>(
      this.conn,
      `SELECT
         lease_id AS "leaseId",
         secret_ref AS "secretRef",
         provider_kind AS "providerKind",
         task_id AS "taskId",
         execution_id AS "executionId",
         requested_by AS "requestedBy",
         granted_to AS "grantedTo",
         usage_purpose AS "usagePurpose",
         issued_at AS "issuedAt",
         expires_at AS "expiresAt",
         status,
         revoked_at AS "revokedAt",
         revoked_by AS "revokedBy",
         revocation_reason_code AS "revocationReasonCode",
         source_version AS "sourceVersion",
         masked_value AS "maskedValue",
         metadata_json AS "metadataJson"
       FROM secret_leases
       WHERE secret_ref = $1
       ORDER BY issued_at DESC, lease_id DESC`,
      secretRef,
    );
  }
}
